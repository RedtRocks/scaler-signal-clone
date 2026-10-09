"""Turns ORM rows into API shapes as one viewer sees them.

Several fields depend on who is looking: a direct conversation's title is the *other*
person's name (or the viewer's nickname for them), `status` only appears on the viewer's
own messages, and unread counts, role and settings are per member. The batch methods load
everything for a list in a fixed number of queries, so the Conversation list has no N+1.
"""

from collections.abc import Callable, Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app import models, schemas
from app.models import Member, MessageKind
from app.services import receipts
from app.services.access import only_visible_to
from app.services.messages import MESSAGE_LOAD_OPTIONS


class Presenter:
    def __init__(self, db: Session, viewer_id: int, is_online: Callable[[int], bool]) -> None:
        self.db = db
        self.viewer_id = viewer_id
        self.is_online = is_online

    # --- People --------------------------------------------------------------------------

    def user(self, user: models.User) -> schemas.UserPublic:
        return schemas.UserPublic(
            id=user.id,
            phone=user.phone,
            display_name=user.display_name,
            about=user.about,
            avatar_url=user.avatar_url,
            online=self.is_online(user.id),
            last_seen_at=user.last_seen_at,
        )

    def contacts(self, contacts: Sequence[models.Contact]) -> list[schemas.Contact]:
        return [
            schemas.Contact(
                user=self.user(contact.contact_user),
                nickname=contact.nickname,
                display_name=contact.display_name,
            )
            for contact in contacts
        ]

    # --- Messages ------------------------------------------------------------------------

    def message(self, message: models.Message) -> schemas.Message:
        return self.messages([message])[0]

    def messages(self, messages: Sequence[models.Message]) -> list[schemas.Message]:
        """Serialise messages; expects `reactions` and `reply_to` to be loaded already
        (see MESSAGE_LOAD_OPTIONS) so no per-message queries happen here."""
        own_text_ids = [
            m.id for m in messages if m.sender_id == self.viewer_id and m.kind == MessageKind.TEXT
        ]
        status_by_id = receipts.statuses(self.db, own_text_ids)
        return [self._message(m, status_by_id.get(m.id)) for m in messages]

    def _message(
        self, message: models.Message, status: schemas.MessageStatus | None
    ) -> schemas.Message:
        quoted = message.reply_to
        return schemas.Message(
            id=message.id,
            conversation_id=message.conversation_id,
            client_id=message.client_id,
            sender_id=message.sender_id,
            kind=message.kind,
            body=message.body,
            system_event=message.system_event,
            reply_to=(
                schemas.ReplyPreview(
                    id=quoted.id,
                    sender_id=quoted.sender_id,
                    body=quoted.body,
                    deleted=quoted.is_deleted,
                    attachment=(
                        self.attachment(quoted.attachments[0]) if quoted.attachments else None
                    ),
                )
                if quoted is not None
                else None
            ),
            created_at=message.created_at,
            expires_at=message.expires_at,
            deleted=message.is_deleted,
            edited=message.is_edited,
            status=status,
            reactions=[
                schemas.ReactionOut(emoji=r.emoji, user_id=r.user_id) for r in message.reactions
            ],
            attachments=[self.attachment(a) for a in message.attachments],
        )

    @staticmethod
    def attachment(attachment: models.Attachment) -> schemas.Attachment:
        return schemas.Attachment(
            id=attachment.id,
            url=attachment.url,
            file_name=attachment.file_name,
            content_type=attachment.content_type,
            size=attachment.size,
            width=attachment.width,
            height=attachment.height,
            duration_ms=attachment.duration_ms,
        )

    # --- Conversations -------------------------------------------------------------------

    def summary(self, member: Member) -> schemas.ConversationSummary:
        return self.summaries([member])[0]

    def summaries(self, memberships: Sequence[Member]) -> list[schemas.ConversationSummary]:
        """Summaries for the viewer's own Member rows, in the given order."""
        if not memberships:
            return []
        ids = [m.conversation_id for m in memberships]
        member_counts = self._member_counts(ids)
        last_messages = self._last_messages(ids)
        unread_counts = self._unread_counts(ids)
        peers = self._direct_peers(ids)
        nicknames = self._nicknames([peer.id for peer in peers.values()])

        last_message_out = dict(
            zip(
                last_messages.keys(),
                self.messages(list(last_messages.values())),
                strict=True,
            )
        )

        summaries = []
        for member in memberships:
            conversation = member.conversation
            peer = peers.get(conversation.id)
            if peer is None:  # a group
                title, avatar_url = conversation.name or "", conversation.avatar_url
            else:
                title = (
                    "Note to Self"
                    if peer.id == self.viewer_id
                    else nicknames.get(peer.id) or peer.display_name or peer.phone
                )
                avatar_url = peer.avatar_url
            summaries.append(
                schemas.ConversationSummary(
                    id=conversation.id,
                    kind=conversation.kind,
                    title=title,
                    avatar_url=avatar_url,
                    peer=self.user(peer) if peer is not None else None,
                    member_count=member_counts.get(conversation.id, 0),
                    last_message=last_message_out.get(conversation.id),
                    last_message_at=conversation.last_message_at or conversation.created_at,
                    unread_count=unread_counts.get(conversation.id, 0),
                    muted=member.muted,
                    pinned=member.pinned,
                    archived=member.archived,
                    left=not member.is_active,
                    disappearing_seconds=conversation.disappearing_seconds,
                    my_role=member.role,
                )
            )
        return summaries

    def detail(self, member: Member) -> schemas.ConversationDetail:
        conversation = member.conversation
        current = self.db.scalars(
            select(Member)
            .options(selectinload(Member.user))
            .where(Member.conversation_id == conversation.id, Member.left_at.is_(None))
            .order_by(Member.joined_at, Member.id)
        )
        former = self.db.scalars(
            select(Member)
            .options(selectinload(Member.user))
            .where(Member.conversation_id == conversation.id, Member.left_at.is_not(None))
            .order_by(Member.id)
        )
        return schemas.ConversationDetail(
            **self.summary(member).model_dump(),
            description=conversation.description,
            created_at=conversation.created_at,
            members=[
                schemas.MemberOut(user=self.user(m.user), role=m.role, joined_at=m.joined_at)
                for m in current
            ],
            former_members=[self.user(m.user) for m in former],
        )

    # --- Batched lookups, each one query keyed by conversation id ------------------------

    def _member_counts(self, conversation_ids: list[int]) -> dict[int, int]:
        rows = self.db.execute(
            select(Member.conversation_id, func.count())
            .where(Member.conversation_id.in_(conversation_ids), Member.left_at.is_(None))
            .group_by(Member.conversation_id)
        )
        return {conversation_id: count for conversation_id, count in rows}

    def _last_messages(self, conversation_ids: list[int]) -> dict[int, models.Message]:
        """The newest message the viewer can see in each conversation."""
        newest_ids = (
            only_visible_to(select(func.max(models.Message.id)), self.viewer_id)
            .where(models.Message.conversation_id.in_(conversation_ids))
            .group_by(models.Message.conversation_id)
        )
        messages = self.db.scalars(
            select(models.Message)
            .options(*MESSAGE_LOAD_OPTIONS)
            .where(models.Message.id.in_(newest_ids.scalar_subquery()))
        )
        return {message.conversation_id: message for message in messages}

    def _unread_counts(self, conversation_ids: list[int]) -> dict[int, int]:
        """Text messages from others after the viewer's read pointer (contract rule)."""
        message = models.Message
        rows = self.db.execute(
            only_visible_to(select(message.conversation_id, func.count()), self.viewer_id)
            .where(
                message.conversation_id.in_(conversation_ids),
                message.id > func.coalesce(Member.last_read_message_id, 0),
                message.sender_id != self.viewer_id,
                message.kind == MessageKind.TEXT,
                message.deleted_at.is_(None),
            )
            .group_by(message.conversation_id)
        )
        return {conversation_id: count for conversation_id, count in rows}

    def _direct_peers(self, conversation_ids: list[int]) -> dict[int, models.User]:
        """For direct conversations: the member who is not the viewer."""
        rows = self.db.execute(
            select(Member.conversation_id, models.User)
            .join(models.User, models.User.id == Member.user_id)
            .join(models.Conversation, models.Conversation.id == Member.conversation_id)
            .where(
                Member.conversation_id.in_(conversation_ids),
                models.Conversation.kind == models.ConversationKind.DIRECT,
            )
        )
        peers: dict[int, models.User] = {}
        for conversation_id, user in rows:
            # Note to Self has only the viewer, who then stands in as the peer.
            if user.id != self.viewer_id or conversation_id not in peers:
                peers[conversation_id] = user
        return peers

    def _nicknames(self, user_ids: list[int]) -> dict[int, str]:
        if not user_ids:
            return {}
        rows = self.db.execute(
            select(models.Contact.contact_user_id, models.Contact.nickname).where(
                models.Contact.owner_id == self.viewer_id,
                models.Contact.contact_user_id.in_(user_ids),
                models.Contact.nickname.is_not(None),
            )
        )
        return {user_id: nickname for user_id, nickname in rows}

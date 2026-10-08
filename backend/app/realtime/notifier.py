"""Server -> client pushes. Routers call these after a service has committed a change.

Each payload is built per recipient with a `Presenter`, so titles, statuses and unread
counts are always from that recipient's point of view. Offline users are skipped.
"""

from collections import defaultdict
from collections.abc import Iterable, Sequence

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import schemas
from app.models import Member, Message, User
from app.presenter import Presenter
from app.realtime.connections import ConnectionManager
from app.services import receipts
from app.services.users import presence_audience


class Notifier:
    def __init__(self, connections: ConnectionManager) -> None:
        self.connections = connections

    def presenter(self, db: Session, viewer_id: int) -> Presenter:
        return Presenter(db, viewer_id, self.connections.is_online)

    async def messages_created(self, db: Session, messages: Sequence[Message]) -> None:
        """`message.new` to everyone who can see each message, the sender's tabs included."""
        for message in messages:
            await self._push_message(db, "message.new", message)

    async def message_updated(self, db: Session, message: Message) -> None:
        """`message.updated` after a reaction change, a delete or an expiry."""
        await self._push_message(db, "message.updated", message)

    async def receipts_changed(self, db: Session, message_ids: Sequence[int]) -> None:
        """`receipt` to each sender: the new aggregate status of their affected messages."""
        if not message_ids:
            return
        status_by_id = receipts.statuses(db, message_ids)
        grouped: dict[tuple[int, int, str], list[int]] = defaultdict(list)
        rows = db.execute(
            select(Message.id, Message.conversation_id, Message.sender_id).where(
                Message.id.in_(message_ids)
            )
        )
        for message_id, conversation_id, sender_id in rows:
            grouped[(sender_id, conversation_id, status_by_id[message_id])].append(message_id)
        for (sender_id, conversation_id, status), ids in grouped.items():
            await self.connections.send(
                sender_id,
                "receipt",
                {"conversation_id": conversation_id, "message_ids": sorted(ids), "status": status},
            )

    async def conversation_updated(
        self, db: Session, conversation_id: int, user_ids: Iterable[int]
    ) -> None:
        """`conversation.updated` with each user's own ConversationSummary."""
        for user_id in set(user_ids):
            if not self.connections.is_online(user_id):
                continue
            member = db.scalar(
                select(Member).where(
                    Member.conversation_id == conversation_id, Member.user_id == user_id
                )
            )
            if member is not None:
                summary = self.presenter(db, user_id).summary(member)
                await self.connections.send(
                    user_id, "conversation.updated", summary.model_dump(mode="json")
                )

    async def conversation_members_changed(
        self, db: Session, conversation_id: int, extra_user_ids: Iterable[int] = ()
    ) -> None:
        """`conversation.updated` to every current member, plus anyone who just left."""
        await self.conversation_updated(
            db, conversation_id, [*active_member_ids(db, conversation_id), *extra_user_ids]
        )

    async def conversation_removed(self, user_id: int, conversation_id: int) -> None:
        await self.connections.send(
            user_id, "conversation.removed", {"conversation_id": conversation_id}
        )

    async def read(self, user_id: int, conversation_id: int, up_to_message_id: int) -> None:
        """Tell the reader's other tabs to clear the unread badge."""
        await self.connections.send(
            user_id,
            "read",
            {
                "conversation_id": conversation_id,
                "user_id": user_id,
                "up_to_message_id": up_to_message_id,
            },
        )

    async def typing(
        self, db: Session, user_id: int, conversation_id: int, is_typing: bool
    ) -> None:
        recipients = [uid for uid in active_member_ids(db, conversation_id) if uid != user_id]
        await self.connections.send_many(
            recipients,
            "typing",
            {"conversation_id": conversation_id, "user_id": user_id, "is_typing": is_typing},
        )

    async def presence(self, db: Session, user: User) -> None:
        event = schemas.PresenceEvent(
            user_id=user.id,
            online=self.connections.is_online(user.id),
            last_seen_at=user.last_seen_at,
        )
        await self.connections.send_many(
            presence_audience(db, user.id), "presence", event.model_dump(mode="json")
        )

    async def _push_message(self, db: Session, event_type: str, message: Message) -> None:
        # Everyone who was a member when the message was written and has not left since;
        # this includes a member removed by this very message ("Maya removed you.").
        recipients = db.scalars(
            select(Member.user_id).where(
                Member.conversation_id == message.conversation_id,
                Member.joined_at <= message.created_at,
                or_(Member.left_at.is_(None), Member.left_at >= message.created_at),
            )
        )
        for user_id in recipients:
            if self.connections.is_online(user_id):
                payload = self.presenter(db, user_id).message(message)
                await self.connections.send(user_id, event_type, payload.model_dump(mode="json"))


def active_member_ids(db: Session, conversation_id: int) -> list[int]:
    return list(
        db.scalars(
            select(Member.user_id).where(
                Member.conversation_id == conversation_id, Member.left_at.is_(None)
            )
        )
    )

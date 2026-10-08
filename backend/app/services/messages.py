"""Messages: sending (idempotent on client id), history, reactions, editing, deletion and expiry."""

from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.db import utcnow
from app.errors import BadRequest, Conflict, Forbidden, NotFound
from app.models import (
    Attachment,
    Conversation,
    HiddenMessage,
    Member,
    Message,
    MessageKind,
    Reaction,
    Receipt,
    User,
)
from app.services import attachments as attachment_service
from app.services.access import get_membership, only_visible_to, require_active

# Load what serialising a Message needs in the same round trips as the messages themselves.
# A quote shows the first attachment of the message it points at, so load that too.
MESSAGE_LOAD_OPTIONS = (
    selectinload(Message.reactions),
    selectinload(Message.attachments),
    selectinload(Message.reply_to).selectinload(Message.attachments),
)


def list_messages(db: Session, member: Member, before_id: int | None, limit: int) -> list[Message]:
    """One page of history visible to `member`, newest first."""
    statement = only_visible_to(select(Message), member.user_id).where(
        Message.conversation_id == member.conversation_id,
        ~Message.id.in_(
            select(HiddenMessage.message_id).where(HiddenMessage.user_id == member.user_id)
        ),
    )
    if before_id is not None:
        statement = statement.where(Message.id < before_id)
    statement = statement.options(*MESSAGE_LOAD_OPTIONS).order_by(Message.id.desc()).limit(limit)
    return list(db.scalars(statement))


def send_message(
    db: Session,
    member: Member,
    body: str,
    client_id: str,
    reply_to_id: int | None,
    attachment_ids: list[int] | None = None,
    max_attachments: int = 10,
) -> tuple[Message, bool]:
    """Store a text message (caption and attachments optional) with one Receipt per recipient.

    Idempotent: resending the same `client_id` returns the stored message. The second value
    is True only when the message was created by this call.
    """
    existing = _find_by_client_id(db, member.user_id, client_id)
    if existing is not None:
        if existing.conversation_id != member.conversation_id:
            raise Conflict("client_id was already used in another conversation")
        return existing, False

    require_active(member)
    conversation = member.conversation
    if reply_to_id is not None:
        quoted = db.get(Message, reply_to_id)
        if quoted is None or quoted.conversation_id != conversation.id:
            raise BadRequest("You can only reply to a message in this conversation")

    now = utcnow()
    message = Message(
        conversation_id=conversation.id,
        sender_id=member.user_id,
        kind=MessageKind.TEXT,
        body=body,
        client_id=client_id,
        reply_to_id=reply_to_id,
        created_at=now,
        expires_at=_expiry(conversation, now),
    )
    db.add(message)
    db.flush()
    try:
        attachment_service.claim(db, member, attachment_ids or [], message, max_attachments)
    except BadRequest:
        db.rollback()
        raise
    db.add_all(
        Receipt(message_id=message.id, user_id=recipient.user_id)
        for recipient in conversation.active_members
        if recipient.user_id != member.user_id
    )
    conversation.last_message_at = now
    try:
        db.commit()
    except IntegrityError:
        # A concurrent retry with the same client_id won the race; return its message.
        db.rollback()
        stored = _find_by_client_id(db, member.user_id, client_id)
        if stored is None:
            raise
        return stored, False
    return message, True


def write_system_message(
    db: Session,
    conversation: Conversation,
    actor_id: int | None,
    event: dict[str, Any],
    at: datetime | None = None,
) -> Message:
    """Add a System message (e.g. "Maya added Kai.") to the timeline. The caller commits.
    System messages have no receipts, never count as unread and never expire."""
    created_at = at or utcnow()
    message = Message(
        conversation_id=conversation.id,
        sender_id=actor_id,
        kind=MessageKind.SYSTEM,
        body="",
        system_event=event,
        created_at=created_at,
    )
    db.add(message)
    conversation.last_message_at = created_at
    return message


def get_message_for_member(db: Session, message_id: int, user: User) -> tuple[Message, Member]:
    """Load a message the user may act on, with their (current) membership."""
    message = db.get(Message, message_id, options=MESSAGE_LOAD_OPTIONS)
    if message is None:
        raise NotFound("Message not found")
    member = get_membership(db, message.conversation_id, user.id)
    require_active(member)
    if message.created_at < member.joined_at:
        raise NotFound("Message not found")
    return message, member


def set_reaction(db: Session, user: User, message_id: int, emoji: str) -> Message:
    """Put the user's one Reaction on a message, replacing any earlier emoji."""
    message, _ = get_message_for_member(db, message_id, user)
    if message.kind != MessageKind.TEXT or message.is_deleted:
        raise BadRequest("You can't react to this message")
    reaction = next((r for r in message.reactions if r.user_id == user.id), None)
    if reaction is None:
        message.reactions.append(Reaction(user_id=user.id, emoji=emoji))
    else:
        reaction.emoji = emoji
        reaction.created_at = utcnow()
    db.commit()
    return message


def remove_reaction(db: Session, user: User, message_id: int) -> Message | None:
    """Remove the user's Reaction. Returns the message if something changed."""
    message, _ = get_message_for_member(db, message_id, user)
    reaction = next((r for r in message.reactions if r.user_id == user.id), None)
    if reaction is None:
        return None
    message.reactions.remove(reaction)
    db.commit()
    return message


def delete_for_everyone(
    db: Session, user: User, message_id: int, media_dir: Path
) -> Message | None:
    """Sender-only soft delete; its files are removed from disk. Returns the message if it
    was deleted by this call."""
    message, _ = get_message_for_member(db, message_id, user)
    if message.sender_id != user.id or message.kind != MessageKind.TEXT:
        raise Forbidden("You can only delete your own messages")
    if message.is_deleted:
        return None
    names = _soft_delete(message, utcnow())
    db.commit()
    attachment_service.remove_files(media_dir, names)
    return message


EDIT_WINDOW = timedelta(hours=24)


def edit_message(db: Session, user: User, message_id: int, body: str) -> Message | None:
    """Sender-only edit of a text message's body within 24 hours of sending. Returns the
    message if its text changed."""
    message, _ = get_message_for_member(db, message_id, user)
    if message.sender_id != user.id or message.kind != MessageKind.TEXT:
        raise Forbidden("You can only edit your own messages")
    if message.is_deleted:
        raise BadRequest("This message was deleted")
    if utcnow() - message.created_at > EDIT_WINDOW:
        raise BadRequest("Messages can only be edited within 24 hours")
    if body == message.body:
        return None
    message.body = body
    message.edited_at = utcnow()
    db.commit()
    return message


def hide_message(db: Session, user: User, message_id: int) -> None:
    """Delete for me. Idempotent."""
    message, _ = get_message_for_member(db, message_id, user)
    if db.get(HiddenMessage, (message.id, user.id)) is None:
        db.add(HiddenMessage(message_id=message.id, user_id=user.id))
        db.commit()


def expire_due_messages(db: Session, now: datetime, media_dir: Path) -> list[Message]:
    """Soft-delete every message whose disappearing timer has run out, files included."""
    due = list(
        db.scalars(
            select(Message)
            .options(*MESSAGE_LOAD_OPTIONS)
            .where(Message.expires_at <= now, Message.deleted_at.is_(None))
        )
    )
    names = [name for message in due for name in _soft_delete(message, now)]
    db.commit()
    attachment_service.remove_files(media_dir, names)
    return due


def search_messages(db: Session, viewer_id: int, query: str, limit: int = 50) -> list[Message]:
    """Text messages visible to the viewer whose body contains `query` (case-insensitive)."""
    statement = only_visible_to(select(Message), viewer_id).where(
        Message.kind == MessageKind.TEXT,
        Message.deleted_at.is_(None),
        or_(
            Message.body.icontains(query, autoescape=True),
            Message.attachments.any(Attachment.file_name.icontains(query, autoescape=True)),
        ),
    )
    statement = statement.options(*MESSAGE_LOAD_OPTIONS).order_by(Message.id.desc()).limit(limit)
    return list(db.scalars(statement))


def _find_by_client_id(db: Session, sender_id: int, client_id: str) -> Message | None:
    return db.scalar(
        select(Message)
        .options(*MESSAGE_LOAD_OPTIONS)
        .where(Message.sender_id == sender_id, Message.client_id == client_id)
    )


def _expiry(conversation: Conversation, sent_at: datetime) -> datetime | None:
    if conversation.disappearing_seconds is None:
        return None
    return sent_at + timedelta(seconds=conversation.disappearing_seconds)


def _soft_delete(message: Message, now: datetime) -> list[str]:
    """Delete for everyone: keep the row (so the timeline shows "This message was deleted")
    but drop its content, reactions and attachments. Returns the stored file names, which the
    caller deletes from disk after committing."""
    message.deleted_at = now
    message.body = ""
    message.reactions.clear()
    names = [a.storage_name for a in message.attachments]
    message.attachments.clear()
    return names

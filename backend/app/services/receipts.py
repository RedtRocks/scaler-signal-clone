"""Receipts: per-recipient delivered/read stamps and the sender-facing Message status."""

from collections.abc import Collection

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.orm import Session

from app.db import utcnow
from app.errors import NotFound
from app.models import Member, Message, Receipt
from app.schemas import MessageStatus


def statuses(db: Session, message_ids: Collection[int]) -> dict[int, MessageStatus]:
    """Aggregate status per message: the weakest state across all its receipts.

    One grouped query for any number of messages. A message with no receipts is "sent".
    """
    if not message_ids:
        return {}
    rows = db.execute(
        select(
            Receipt.message_id,
            func.count(),
            func.count(Receipt.delivered_at),
            func.count(Receipt.read_at),
        )
        .where(Receipt.message_id.in_(message_ids))
        .group_by(Receipt.message_id)
    )
    result: dict[int, MessageStatus] = {message_id: "sent" for message_id in message_ids}
    for message_id, total, delivered, read in rows:
        if read == total:
            result[message_id] = "read"
        elif delivered == total:
            result[message_id] = "delivered"
    return result


def acknowledge_delivery(db: Session, user_id: int, message_ids: Collection[int]) -> list[int]:
    """A device of the user received these messages (the WebSocket `delivered` frame).
    Returns the ids whose receipt changed."""
    changed = _mark_delivered(db, user_id, Message.id.in_(message_ids))
    db.commit()
    return changed


def deliver_conversation(db: Session, member: Member) -> list[int]:
    """The member fetched history: everything waiting for them here counts as delivered."""
    changed = _mark_delivered(db, member.user_id, Message.conversation_id == member.conversation_id)
    db.commit()
    return changed


def read_up_to(db: Session, member: Member, up_to_message_id: int) -> list[int]:
    """Move the member's read pointer forward (never back) and stamp `read_at` (and a
    missing `delivered_at`) on their receipts up to that message.
    Returns the ids whose receipt changed."""
    target = db.get(Message, up_to_message_id)
    if target is None or target.conversation_id != member.conversation_id:
        raise NotFound("Message not found in this conversation")

    member.last_read_message_id = max(member.last_read_message_id or 0, up_to_message_id)
    now = utcnow()
    unread = db.scalars(
        select(Receipt)
        .join(Message, Message.id == Receipt.message_id)
        .where(
            Receipt.user_id == member.user_id,
            Receipt.read_at.is_(None),
            Message.conversation_id == member.conversation_id,
            Message.id <= up_to_message_id,
        )
    ).all()
    for receipt in unread:
        receipt.delivered_at = receipt.delivered_at or now
        receipt.read_at = now
    db.commit()
    return [receipt.message_id for receipt in unread]


def _mark_delivered(db: Session, user_id: int, *conditions: ColumnElement[bool]) -> list[int]:
    """Stamp `delivered_at` on the user's undelivered receipts whose Message matches
    `conditions`. Returns the affected message ids."""
    now = utcnow()
    undelivered = db.scalars(
        select(Receipt)
        .join(Message, Message.id == Receipt.message_id)
        .where(Receipt.user_id == user_id, Receipt.delivered_at.is_(None), *conditions)
    ).all()
    for receipt in undelivered:
        receipt.delivered_at = now
    return [receipt.message_id for receipt in undelivered]

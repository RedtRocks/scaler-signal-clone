"""Access rules shared by the services: membership lookups and message visibility."""

from sqlalchemy import Select, and_, or_, select
from sqlalchemy.orm import Session, joinedload

from app.errors import BadRequest, Forbidden, NotFound
from app.models import Member, Message


def get_membership(db: Session, conversation_id: int, user_id: int) -> Member:
    """The user's Member row, current or past. Non-members get a 404, not a 403,
    so conversation ids don't leak."""
    member = db.scalar(
        select(Member)
        .options(joinedload(Member.conversation))
        .where(Member.conversation_id == conversation_id, Member.user_id == user_id)
    )
    if member is None:
        raise NotFound("Conversation not found")
    return member


def require_active(member: Member) -> None:
    if not member.is_active:
        raise Forbidden("You are no longer a member of this group")


def require_admin(member: Member) -> None:
    require_active(member)
    if not member.conversation.is_group:
        raise BadRequest("Only groups have admins")
    if not member.is_admin:
        raise Forbidden("Only group admins can do that")


def only_visible_to(statement: Select, viewer_id: int) -> Select:
    """Restrict a query over Message to what `viewer_id` may see: messages created while
    they were a member (from `joined_at` up to `left_at`, if they left)."""
    return statement.join(
        Member,
        and_(Member.conversation_id == Message.conversation_id, Member.user_id == viewer_id),
    ).where(
        Message.created_at >= Member.joined_at,
        or_(Member.left_at.is_(None), Message.created_at <= Member.left_at),
    )

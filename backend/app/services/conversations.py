"""Conversations and Members: who may see and change what, and the group admin rules."""

from collections.abc import Iterable

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.db import utcnow
from app.errors import BadRequest, NotFound
from app.models import Conversation, ConversationKind, Member, MemberRole, Message, User
from app.schemas import ConversationUpdate, SettingsUpdate
from app.services.access import require_active, require_admin
from app.services.messages import write_system_message


def list_memberships(db: Session, user_id: int) -> list[Member]:
    """The Conversation list: pinned first, then by last activity, newest first."""
    return list(
        db.scalars(
            select(Member)
            .join(Member.conversation)
            .options(joinedload(Member.conversation))
            .where(Member.user_id == user_id)
            .order_by(
                Member.pinned.desc(),
                func.coalesce(Conversation.last_message_at, Conversation.created_at).desc(),
                Conversation.id.desc(),
            )
        )
    )


def _require_users(db: Session, user_ids: Iterable[int]) -> list[User]:
    wanted = set(user_ids)
    users = list(db.scalars(select(User).where(User.id.in_(wanted))))
    if len(users) != len(wanted):
        raise NotFound("User not found")
    return users


# --- Direct conversations ----------------------------------------------------------------


def get_or_create_direct(db: Session, me: User, other_user_id: int) -> tuple[Conversation, bool]:
    """Return the one Direct Conversation between `me` and the other user, creating it if
    needed. The second value is True when it was just created."""
    if other_user_id != me.id:
        _require_users(db, [other_user_id])
    key = Conversation.direct_key_for(me.id, other_user_id)

    existing = db.scalar(select(Conversation).where(Conversation.direct_key == key))
    if existing is not None:
        return existing, False

    conversation = Conversation(kind=ConversationKind.DIRECT, direct_key=key, created_by=me.id)
    # Note to Self is a direct conversation with yourself: one member, key "id:id".
    user_ids = sorted({me.id, other_user_id})
    conversation.members = [Member(user_id=user_id) for user_id in user_ids]
    db.add(conversation)
    try:
        db.commit()
    except IntegrityError:
        # The other user created it at the same moment; the UNIQUE direct_key caught it.
        db.rollback()
        return db.scalars(select(Conversation).where(Conversation.direct_key == key)).one(), False
    return conversation, True


# --- Groups ------------------------------------------------------------------------------


def create_group(
    db: Session, creator: User, name: str, member_ids: list[int]
) -> tuple[Conversation, list[Message]]:
    """Create a group with `creator` as its first Admin. Returns the group and the system
    messages written (`group_created`, then `members_added` if anyone else was added)."""
    others = sorted(set(member_ids) - {creator.id})
    _require_users(db, others)

    now = utcnow()
    group = Conversation(
        kind=ConversationKind.GROUP, name=name, created_by=creator.id, created_at=now
    )
    group.members = [Member(user_id=creator.id, role=MemberRole.ADMIN, joined_at=now)]
    group.members += [Member(user_id=user_id, joined_at=now) for user_id in others]
    db.add(group)
    db.flush()

    events = [write_system_message(db, group, creator.id, {"type": "group_created"})]
    if others:
        events.append(
            write_system_message(
                db, group, creator.id, {"type": "members_added", "user_ids": others}
            )
        )
    db.commit()
    return group, events


def update_conversation(db: Session, member: Member, update: ConversationUpdate) -> list[Message]:
    """Apply the fields present in `update`. In a group every change needs an Admin; in a
    direct conversation either member may change the timer and nothing else.
    Returns the system messages written (`renamed`, `timer_changed`)."""
    conversation = member.conversation
    fields = update.model_fields_set
    require_active(member)
    if conversation.is_group:
        require_admin(member)
    elif fields - {"disappearing_seconds"}:
        raise BadRequest("A direct conversation only has a disappearing timer to change")

    events: list[Message] = []
    if "name" in fields:
        if update.name is None:
            raise BadRequest("A group needs a name")
        if update.name != conversation.name:
            conversation.name = update.name
            events.append(
                write_system_message(
                    db, conversation, member.user_id, {"type": "renamed", "name": update.name}
                )
            )
    if "description" in fields:
        conversation.description = update.description or None
    if "avatar_url" in fields:
        conversation.avatar_url = update.avatar_url or None
    if (
        "disappearing_seconds" in fields
        and update.disappearing_seconds != conversation.disappearing_seconds
    ):
        conversation.disappearing_seconds = update.disappearing_seconds
        events.append(
            write_system_message(
                db,
                conversation,
                member.user_id,
                {"type": "timer_changed", "seconds": update.disappearing_seconds},
            )
        )
    db.commit()
    return events


def update_settings(db: Session, member: Member, update: SettingsUpdate) -> None:
    """Per-member settings: muted, pinned, archived, chat colour. Left members may still tidy
    their list."""
    for field, value in update.model_dump(exclude_none=True).items():
        if field == "chat_color" and value == "default":
            value = None
        setattr(member, field, value)
    db.commit()


def add_members(db: Session, actor: Member, user_ids: list[int]) -> list[Message]:
    """Admin adds users. Past members are re-added with a fresh `joined_at`; current members
    are skipped. Returns the `members_added` system message, if anyone was added."""
    require_admin(actor)
    group = actor.conversation
    _require_users(db, user_ids)

    now = utcnow()
    by_user = {member.user_id: member for member in group.members}
    added: list[int] = []
    for user_id in sorted(set(user_ids)):
        existing = by_user.get(user_id)
        if existing is None:
            group.members.append(Member(user_id=user_id, joined_at=now))
        elif not existing.is_active:
            existing.left_at = None
            existing.joined_at = now
            existing.role = MemberRole.MEMBER
            existing.last_read_message_id = None
        else:
            continue
        added.append(user_id)

    if not added:
        return []
    db.flush()
    event = write_system_message(
        db, group, actor.user_id, {"type": "members_added", "user_ids": added}
    )
    db.commit()
    return [event]


def remove_member(db: Session, actor: Member, target_user_id: int) -> tuple[Member, list[Message]]:
    """Leave (target is the actor) or remove someone (Admin only). If no Admin remains, the
    longest-standing member becomes one. Returns the departed Member and system messages."""
    require_active(actor)
    group = actor.conversation
    if not group.is_group:
        raise BadRequest("You can't leave a direct conversation")

    if target_user_id == actor.user_id:
        target = actor
        event = {"type": "member_left"}
    else:
        require_admin(actor)
        target = _active_member(group, target_user_id)
        event = {"type": "member_removed", "user_id": target_user_id}

    now = utcnow()
    # Stamp the system message and left_at with the same instant so the departing user
    # still sees "You left" / "X removed you" as the last line of their history.
    events = [write_system_message(db, group, actor.user_id, event, at=now)]
    target.left_at = now
    target.role = MemberRole.MEMBER

    remaining = group.active_members
    if remaining and not any(member.is_admin for member in remaining):
        successor = min(remaining, key=lambda member: (member.joined_at, member.id))
        successor.role = MemberRole.ADMIN
        # No actor: the app promoted them automatically.
        events.append(
            write_system_message(
                db, group, None, {"type": "admin_granted", "user_id": successor.user_id}, at=now
            )
        )
    db.commit()
    return target, events


def set_role(db: Session, actor: Member, target_user_id: int, role: MemberRole) -> list[Message]:
    """Admin grants or revokes the Admin role. A group always keeps at least one Admin."""
    require_admin(actor)
    group = actor.conversation
    target = _active_member(group, target_user_id)
    if target.role == role:
        return []

    if role == MemberRole.MEMBER:
        if not any(m.is_admin for m in group.active_members if m is not target):
            raise BadRequest("A group needs at least one admin")
        target.role = role
        db.commit()
        return []

    target.role = role
    event = write_system_message(
        db, group, actor.user_id, {"type": "admin_granted", "user_id": target_user_id}
    )
    db.commit()
    return [event]


def _active_member(group: Conversation, user_id: int) -> Member:
    for member in group.active_members:
        if member.user_id == user_id:
            return member
    raise NotFound("That user is not a member of this group")

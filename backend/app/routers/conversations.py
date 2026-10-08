from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app import schemas
from app.auth import current_user
from app.db import get_db
from app.deps import get_notifier, get_presenter
from app.models import User
from app.presenter import Presenter
from app.realtime.notifier import Notifier
from app.services import conversations
from app.services.access import get_membership

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("")
async def list_conversations(
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    presenter: Presenter = Depends(get_presenter),
) -> list[schemas.ConversationSummary]:
    return presenter.summaries(conversations.list_memberships(db, me.id))


@router.post("/direct")
async def open_direct_conversation(
    body: schemas.DirectCreate,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    presenter: Presenter = Depends(get_presenter),
    notifier: Notifier = Depends(get_notifier),
) -> schemas.ConversationSummary:
    conversation, created = conversations.get_or_create_direct(db, me, body.user_id)
    if created:
        await notifier.conversation_members_changed(db, conversation.id)
    return presenter.summary(get_membership(db, conversation.id, me.id))


@router.post("/group", status_code=status.HTTP_201_CREATED)
async def create_group(
    body: schemas.GroupCreate,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    presenter: Presenter = Depends(get_presenter),
    notifier: Notifier = Depends(get_notifier),
) -> schemas.ConversationSummary:
    group, events = conversations.create_group(db, me, body.name, body.member_ids)
    # The conversation first, so clients know it before its first messages arrive.
    await notifier.conversation_members_changed(db, group.id)
    await notifier.messages_created(db, events)
    return presenter.summary(get_membership(db, group.id, me.id))


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: int,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    presenter: Presenter = Depends(get_presenter),
) -> schemas.ConversationDetail:
    return presenter.detail(get_membership(db, conversation_id, me.id))


@router.patch("/{conversation_id}")
async def update_conversation(
    conversation_id: int,
    body: schemas.ConversationUpdate,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    presenter: Presenter = Depends(get_presenter),
    notifier: Notifier = Depends(get_notifier),
) -> schemas.ConversationSummary:
    member = get_membership(db, conversation_id, me.id)
    events = conversations.update_conversation(db, member, body)
    await notifier.messages_created(db, events)
    await notifier.conversation_members_changed(db, conversation_id)
    return presenter.summary(member)


@router.patch("/{conversation_id}/settings")
async def update_settings(
    conversation_id: int,
    body: schemas.SettingsUpdate,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    presenter: Presenter = Depends(get_presenter),
    notifier: Notifier = Depends(get_notifier),
) -> schemas.ConversationSummary:
    member = get_membership(db, conversation_id, me.id)
    conversations.update_settings(db, member, body)
    await notifier.conversation_updated(db, conversation_id, [me.id])  # my other tabs
    return presenter.summary(member)


@router.post("/{conversation_id}/members")
async def add_members(
    conversation_id: int,
    body: schemas.MembersAdd,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    presenter: Presenter = Depends(get_presenter),
    notifier: Notifier = Depends(get_notifier),
) -> schemas.ConversationDetail:
    member = get_membership(db, conversation_id, me.id)
    events = conversations.add_members(db, member, body.user_ids)
    await notifier.conversation_members_changed(db, conversation_id)
    await notifier.messages_created(db, events)
    return presenter.detail(member)


@router.delete("/{conversation_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    conversation_id: int,
    user_id: int,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    notifier: Notifier = Depends(get_notifier),
) -> None:
    """Remove someone (admins only) or, when `user_id` is me, leave the group."""
    member = get_membership(db, conversation_id, me.id)
    departed, events = conversations.remove_member(db, member, user_id)
    await notifier.messages_created(db, events)
    await notifier.conversation_members_changed(db, conversation_id, [departed.user_id])
    if departed.user_id != me.id:
        await notifier.conversation_removed(departed.user_id, conversation_id)


@router.patch("/{conversation_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def set_member_role(
    conversation_id: int,
    user_id: int,
    body: schemas.RoleUpdate,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    notifier: Notifier = Depends(get_notifier),
) -> None:
    member = get_membership(db, conversation_id, me.id)
    events = conversations.set_role(db, member, user_id, body.role)
    await notifier.messages_created(db, events)
    await notifier.conversation_members_changed(db, conversation_id)

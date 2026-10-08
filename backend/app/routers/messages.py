from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app import schemas
from app.auth import current_user
from app.config import Settings
from app.db import get_db
from app.deps import get_notifier, get_presenter, get_settings
from app.models import User
from app.presenter import Presenter
from app.realtime.notifier import Notifier
from app.services import messages, receipts
from app.services.access import get_membership

router = APIRouter(prefix="/api", tags=["messages"])


@router.get("/conversations/{conversation_id}/messages")
async def list_messages(
    conversation_id: int,
    before_id: int | None = None,
    limit: int = Query(50, ge=1, le=100),
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    presenter: Presenter = Depends(get_presenter),
    notifier: Notifier = Depends(get_notifier),
) -> list[schemas.Message]:
    """History, newest first. Fetching also counts as delivery of anything still pending."""
    member = get_membership(db, conversation_id, me.id)
    page = messages.list_messages(db, member, before_id, limit)
    delivered = receipts.deliver_conversation(db, member)
    await notifier.receipts_changed(db, delivered)
    return presenter.messages(page)


@router.post("/conversations/{conversation_id}/messages", status_code=status.HTTP_201_CREATED)
async def send_message(
    conversation_id: int,
    body: schemas.MessageCreate,
    response: Response,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    presenter: Presenter = Depends(get_presenter),
    notifier: Notifier = Depends(get_notifier),
    settings: Settings = Depends(get_settings),
) -> schemas.Message:
    """201 with the new message, or 200 with the stored one when `client_id` is a resend."""
    member = get_membership(db, conversation_id, me.id)
    message, created = messages.send_message(
        db,
        member,
        body.body,
        body.client_id,
        body.reply_to_id,
        body.attachment_ids,
        settings.max_attachments_per_message,
    )
    if created:
        await notifier.messages_created(db, [message])
    else:
        response.status_code = status.HTTP_200_OK
    return presenter.message(message)


@router.post("/conversations/{conversation_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    conversation_id: int,
    body: schemas.ReadUpdate,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    notifier: Notifier = Depends(get_notifier),
) -> None:
    member = get_membership(db, conversation_id, me.id)
    changed = receipts.read_up_to(db, member, body.up_to_message_id)
    await notifier.receipts_changed(db, changed)
    await notifier.read(me.id, conversation_id, member.last_read_message_id or 0)


@router.put("/messages/{message_id}/reaction", status_code=status.HTTP_204_NO_CONTENT)
async def set_reaction(
    message_id: int,
    body: schemas.ReactionSet,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    notifier: Notifier = Depends(get_notifier),
) -> None:
    message = messages.set_reaction(db, me, message_id, body.emoji)
    await notifier.message_updated(db, message)


@router.delete("/messages/{message_id}/reaction", status_code=status.HTTP_204_NO_CONTENT)
async def remove_reaction(
    message_id: int,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    notifier: Notifier = Depends(get_notifier),
) -> None:
    message = messages.remove_reaction(db, me, message_id)
    if message is not None:
        await notifier.message_updated(db, message)


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    message_id: int,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    notifier: Notifier = Depends(get_notifier),
    settings: Settings = Depends(get_settings),
) -> None:
    """Delete for everyone (sender only). Its attachment files are removed from disk."""
    message = messages.delete_for_everyone(db, me, message_id, settings.media_dir)
    if message is not None:
        await notifier.message_updated(db, message)


@router.patch("/messages/{message_id}")
async def edit_message(
    message_id: int,
    body: schemas.MessageEdit,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    presenter: Presenter = Depends(get_presenter),
    notifier: Notifier = Depends(get_notifier),
) -> schemas.Message:
    """Edit your own text message within 24 hours. Everyone sees it via message.updated."""
    message = messages.edit_message(db, me, message_id, body.body)
    if message is None:
        message, _ = messages.get_message_for_member(db, message_id, me)
    else:
        await notifier.message_updated(db, message)
    return presenter.message(message)


@router.post("/messages/{message_id}/hide", status_code=status.HTTP_204_NO_CONTENT)
async def hide_message(
    message_id: int,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete for me: the message disappears from your history only."""
    messages.hide_message(db, me, message_id)

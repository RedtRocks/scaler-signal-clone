from fastapi import APIRouter, Depends, UploadFile, status
from sqlalchemy.orm import Session

from app import schemas
from app.auth import current_user
from app.config import Settings
from app.db import get_db
from app.deps import get_presenter, get_settings
from app.models import User
from app.presenter import Presenter
from app.services import attachments
from app.services.access import get_membership

router = APIRouter(prefix="/api", tags=["attachments"])


@router.post(
    "/conversations/{conversation_id}/attachments", status_code=status.HTTP_201_CREATED
)
async def upload_attachment(
    conversation_id: int,
    file: UploadFile,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> schemas.Attachment:
    """Store one file, not yet part of any message. Send a message with its id to share it."""
    member = get_membership(db, conversation_id, me.id)
    # Read one byte past the limit so an oversized upload is detected without reading it all.
    content = await file.read(settings.max_attachment_bytes + 1)
    attachment = attachments.save_upload(
        db,
        member,
        content,
        file.content_type,
        file.filename,
        settings.media_dir,
        settings.max_attachment_bytes,
    )
    return Presenter.attachment(attachment)


@router.get("/attachments/{attachment_id}")
async def get_attachment(
    attachment_id: int,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    presenter: Presenter = Depends(get_presenter),
) -> schemas.Attachment:
    return presenter.attachment(attachments.get_for_viewer(db, me.id, attachment_id))


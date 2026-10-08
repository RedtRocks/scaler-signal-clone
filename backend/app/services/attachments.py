"""Attachments: validated uploads, claiming them for a message, and removing files."""

import logging
import secrets
from collections.abc import Iterable
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import BadRequest, NotFound
from app.models import Attachment, Member, Message
from app.services.access import only_visible_to, require_active
from app.services.imageinfo import image_size

logger = logging.getLogger(__name__)

# content type -> file extension on disk. The extension never comes from the user's file name,
# so the static file server always answers with one of these (safe) types.
ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "application/zip": ".zip",
    "audio/mpeg": ".mp3",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/mp4": ".m4a",
    "audio/webm": ".weba",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
}
# Types browsers commonly send for the same files.
ALIASES = {
    "image/jpg": "image/jpeg",
    "application/x-zip-compressed": "application/zip",
    "audio/x-wav": "audio/wav",
    "audio/wave": "audio/wav",
    "audio/mp3": "audio/mpeg",
    "audio/x-m4a": "audio/mp4",
}
MAX_FILE_NAME = 255


class TooLarge(BadRequest):
    status_code = 413


def canonical_type(content_type: str | None) -> str | None:
    base = (content_type or "").split(";")[0].strip().lower()
    base = ALIASES.get(base, base)
    return base if base in ALLOWED_TYPES else None


def clean_file_name(raw: str | None, extension: str) -> str:
    """The name shown to people: path parts and control characters removed, length capped."""
    name = (raw or "").replace("\\", "/").rsplit("/", 1)[-1]
    name = "".join(ch for ch in name if ch.isprintable()).strip()
    return (name or f"file{extension}")[:MAX_FILE_NAME]


def save_upload(
    db: Session,
    member: Member,
    content: bytes,
    content_type: str | None,
    file_name: str | None,
    media_dir: Path,
    max_bytes: int,
) -> Attachment:
    """Validate and store one file as an unclaimed Attachment of `member`'s conversation."""
    require_active(member)
    if len(content) > max_bytes:
        raise TooLarge(f"Files must be {max_bytes // (1024 * 1024)} MB or smaller")
    if not content:
        raise BadRequest("That file is empty")
    kind = canonical_type(content_type)
    if kind is None:
        raise BadRequest("This type of file can't be sent")
    width = height = None
    if kind.startswith("image/"):
        size = image_size(kind, content)
        if size is None:
            raise BadRequest("This image file is damaged or isn't really a " + kind[6:].upper())
        width, height = size

    extension = ALLOWED_TYPES[kind]
    folder = media_dir / "attachments"
    folder.mkdir(parents=True, exist_ok=True)
    storage_name = f"{secrets.token_hex(16)}{extension}"
    (folder / storage_name).write_bytes(content)

    attachment = Attachment(
        conversation_id=member.conversation_id,
        uploader_id=member.user_id,
        file_name=clean_file_name(file_name, extension),
        content_type=kind,
        size=len(content),
        width=width,
        height=height,
        storage_name=storage_name,
    )
    db.add(attachment)
    try:
        db.commit()
    except Exception:
        db.rollback()
        remove_files(media_dir, [storage_name])
        raise
    return attachment


def claim(
    db: Session, member: Member, attachment_ids: list[int], message: Message, max_count: int
) -> None:
    """Attach the uploader's unclaimed files to `message`, in the order given. The caller
    commits. Raises BadRequest for anything that isn't theirs, unclaimed and in this chat."""
    if not attachment_ids:
        return
    if len(set(attachment_ids)) != len(attachment_ids):
        raise BadRequest("The same attachment was listed twice")
    if len(attachment_ids) > max_count:
        raise BadRequest(f"A message can carry at most {max_count} attachments")
    found = {
        a.id: a
        for a in db.scalars(select(Attachment).where(Attachment.id.in_(attachment_ids)))
        if a.uploader_id == member.user_id
        and a.conversation_id == member.conversation_id
        and a.message_id is None
    }
    if len(found) != len(attachment_ids):
        raise BadRequest("Some attachments were not found or were already sent")
    for position, attachment_id in enumerate(attachment_ids):
        found[attachment_id].message_id = message.id
        found[attachment_id].position = position


def get_for_viewer(db: Session, viewer_id: int, attachment_id: int) -> Attachment:
    """Metadata for members who can see the message (the uploader before it is sent).
    Everyone else gets a 404 so ids don't leak."""
    attachment = db.get(Attachment, attachment_id)
    if attachment is None:
        raise NotFound("Attachment not found")
    if attachment.message_id is None:
        if attachment.uploader_id != viewer_id:
            raise NotFound("Attachment not found")
        return attachment
    visible = db.scalar(
        only_visible_to(select(Message.id), viewer_id).where(Message.id == attachment.message_id)
    )
    if visible is None:
        raise NotFound("Attachment not found")
    return attachment


def remove_files(media_dir: Path, storage_names: Iterable[str]) -> None:
    """Delete stored files. A missing file is fine; other errors are logged, never raised,
    because the database change they follow is already committed."""
    for name in storage_names:
        try:
            (media_dir / "attachments" / name).unlink(missing_ok=True)
        except OSError:
            logger.exception("Could not delete attachment file %s", name)


def purge_unclaimed(db: Session, media_dir: Path, now: datetime, ttl_seconds: float) -> int:
    """Delete uploads that no message claimed in time (abandoned drafts, failed sends)."""
    stale = list(
        db.scalars(
            select(Attachment).where(
                Attachment.message_id.is_(None),
                Attachment.created_at <= now - timedelta(seconds=ttl_seconds),
            )
        )
    )
    names = [a.storage_name for a in stale]
    for attachment in stale:
        db.delete(attachment)
    db.commit()
    remove_files(media_dir, names)
    return len(names)

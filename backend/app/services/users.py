"""Users: lookup by phone, profile changes, avatars and presence bookkeeping."""

import secrets
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.db import utcnow
from app.errors import BadRequest, NotFound
from app.models import Contact, Member, User
from app.schemas import MeUpdate

AVATAR_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def find_by_phone(db: Session, phone: str) -> User | None:
    return db.scalar(select(User).where(User.phone == phone))


def get_by_phone(db: Session, phone: str) -> User:
    user = find_by_phone(db, phone)
    if user is None:
        raise NotFound("No Signal user has this phone number")
    return user


def update_profile(db: Session, user: User, update: MeUpdate) -> User:
    """Apply the fields present in the request. Empty `about`/`avatar_url` clear them."""
    fields = update.model_fields_set
    if "display_name" in fields:
        if update.display_name is None:
            raise BadRequest("Display name can't be empty")
        user.display_name = update.display_name
    if "about" in fields:
        user.about = update.about or None
    if "avatar_url" in fields:
        user.avatar_url = update.avatar_url or None
    db.commit()
    return user


def save_avatar(
    db: Session,
    user: User,
    content: bytes,
    content_type: str | None,
    media_dir: Path,
    max_bytes: int,
) -> User:
    """Store an uploaded image under `<media_dir>/avatars/` and point the profile at it."""
    extension = AVATAR_TYPES.get(content_type or "")
    if extension is None:
        raise BadRequest("Avatar must be a JPEG, PNG, WebP or GIF image")
    if len(content) > max_bytes:
        raise BadRequest("Avatar must be 2 MB or smaller")

    avatars = media_dir / "avatars"
    avatars.mkdir(parents=True, exist_ok=True)
    # A fresh random name per upload, so browsers never show a stale cached avatar.
    filename = f"{user.id}-{secrets.token_hex(8)}{extension}"
    (avatars / filename).write_bytes(content)
    user.avatar_url = f"/media/avatars/{filename}"
    db.commit()
    return user


def mark_last_seen(db: Session, user_id: int) -> User | None:
    user = db.get(User, user_id)
    if user is not None:
        user.last_seen_at = utcnow()
        db.commit()
    return user


def presence_audience(db: Session, user_id: int) -> set[int]:
    """Who hears about this user's presence: current co-members of any conversation they
    are in, and everyone who saved them as a Contact."""
    mine = aliased(Member)
    other = aliased(Member)
    co_members = (
        select(other.user_id)
        .join(mine, mine.conversation_id == other.conversation_id)
        .where(
            mine.user_id == user_id,
            mine.left_at.is_(None),
            other.left_at.is_(None),
            other.user_id != user_id,
        )
    )
    saved_by = select(Contact.owner_id).where(Contact.contact_user_id == user_id)
    return set(db.scalars(co_members)) | set(db.scalars(saved_by))

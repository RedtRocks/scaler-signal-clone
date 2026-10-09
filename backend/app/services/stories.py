"""Stories: 24-hour text posts shown to everyone the author shares a conversation with."""

import secrets
from datetime import timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session, aliased, selectinload

from app.db import utcnow
from app.errors import BadRequest, Forbidden, NotFound
from app.services.imageinfo import image_size
from app.models import Member, Story, StoryView, User

STORY_LIFETIME = timedelta(hours=24)


def audience_ids(db: Session, user_id: int) -> set[int]:
    """Everyone who is an active member of a conversation the user is an active member of."""
    mine = aliased(Member)
    theirs = aliased(Member)
    rows = db.scalars(
        select(theirs.user_id)
        .join(mine, mine.conversation_id == theirs.conversation_id)
        .where(mine.user_id == user_id, mine.left_at.is_(None), theirs.left_at.is_(None))
    )
    return set(rows) - {user_id}


def list_stories(db: Session, viewer: User) -> list[Story]:
    """Unexpired stories by the viewer and by people they share a conversation with,
    newest first."""
    authors = audience_ids(db, viewer.id) | {viewer.id}
    return list(
        db.scalars(
            select(Story)
            .options(
                selectinload(Story.author),
                selectinload(Story.views).selectinload(StoryView.viewer),
            )
            .where(Story.author_id.in_(authors), Story.expires_at > utcnow())
            .order_by(Story.id.desc())
        )
    )


def create_story(db: Session, author: User, body: str, background: str) -> Story:
    now = utcnow()
    story = Story(
        author_id=author.id,
        body=body,
        background=background,
        created_at=now,
        expires_at=now + STORY_LIFETIME,
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return story


PHOTO_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
MAX_CAPTION = 700


def create_photo_story(
    db: Session,
    author: User,
    content: bytes,
    content_type: str | None,
    caption: str,
    media_dir: Path,
    max_bytes: int,
) -> Story:
    """Store an uploaded picture under `<media_dir>/stories/` and post it as a 24-hour story."""
    kind = (content_type or "").split(";")[0].strip().lower()
    extension = PHOTO_TYPES.get(kind)
    if extension is None:
        raise BadRequest("A photo story must be a JPEG, PNG, WebP or GIF image")
    if not content:
        raise BadRequest("That file is empty")
    if len(content) > max_bytes:
        raise BadRequest(f"Photos must be {max_bytes // (1024 * 1024)} MB or smaller")
    if image_size(kind, content) is None:
        raise BadRequest("This image file is damaged or isn't really a " + kind[6:].upper())
    caption = caption.strip()
    if len(caption) > MAX_CAPTION:
        raise BadRequest(f"Captions can be at most {MAX_CAPTION} characters")
    folder = media_dir / "stories"
    folder.mkdir(parents=True, exist_ok=True)
    storage_name = f"{secrets.token_hex(16)}{extension}"
    (folder / storage_name).write_bytes(content)
    now = utcnow()
    story = Story(
        author_id=author.id,
        body=caption,
        background="ink",
        media_url=f"/media/stories/{storage_name}",
        created_at=now,
        expires_at=now + STORY_LIFETIME,
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return story


def _visible_story(db: Session, viewer: User, story_id: int) -> Story:
    story = db.get(Story, story_id)
    if story is None or story.expires_at <= utcnow():
        raise NotFound("Story not found")
    if story.author_id != viewer.id and story.author_id not in audience_ids(db, viewer.id):
        raise NotFound("Story not found")
    return story


def mark_viewed(db: Session, viewer: User, story_id: int) -> None:
    """Record a view. Idempotent; viewing your own story records nothing."""
    story = _visible_story(db, viewer, story_id)
    if story.author_id == viewer.id or db.get(StoryView, (story.id, viewer.id)) is not None:
        return
    db.add(StoryView(story_id=story.id, viewer_id=viewer.id))
    db.commit()


def delete_story(db: Session, author: User, story_id: int, media_dir: Path | None = None) -> None:
    story = _visible_story(db, author, story_id)
    if story.author_id != author.id:
        raise Forbidden("You can only delete your own stories")
    media_url = story.media_url
    db.delete(story)
    db.commit()
    _remove_photo(media_dir, media_url)


def _remove_photo(media_dir: Path | None, media_url: str | None) -> None:
    if media_dir is not None and media_url:
        (media_dir / "stories" / media_url.rsplit("/", 1)[-1]).unlink(missing_ok=True)


def delete_expired(db: Session, media_dir: Path | None = None) -> int:
    expired = list(db.scalars(select(Story).where(Story.expires_at <= utcnow())))
    photos = [story.media_url for story in expired]
    for story in expired:
        db.delete(story)
    db.commit()
    for media_url in photos:
        _remove_photo(media_dir, media_url)
    return len(expired)

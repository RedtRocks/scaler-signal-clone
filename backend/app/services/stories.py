"""Stories: 24-hour text posts shown to everyone the author shares a conversation with."""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, aliased, selectinload

from app.db import utcnow
from app.errors import Forbidden, NotFound
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


def delete_story(db: Session, author: User, story_id: int) -> None:
    story = _visible_story(db, author, story_id)
    if story.author_id != author.id:
        raise Forbidden("You can only delete your own stories")
    db.delete(story)
    db.commit()


def delete_expired(db: Session) -> int:
    expired = list(db.scalars(select(Story).where(Story.expires_at <= utcnow())))
    for story in expired:
        db.delete(story)
    db.commit()
    return len(expired)

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app import schemas
from app.auth import current_user
from app.db import get_db
from app.deps import get_presenter
from app.models import Story, User
from app.presenter import Presenter
from app.services import stories

router = APIRouter(prefix="/api/stories", tags=["stories"])


def _out(story: Story, me: User, presenter: Presenter) -> schemas.Story:
    mine = story.author_id == me.id
    return schemas.Story(
        id=story.id,
        author=presenter.user(story.author),
        body=story.body,
        background=story.background,
        created_at=story.created_at,
        expires_at=story.expires_at,
        viewed=mine or any(view.viewer_id == me.id for view in story.views),
        views=(
            [
                schemas.StoryViewOut(user=presenter.user(view.viewer), viewed_at=view.viewed_at)
                for view in story.views
            ]
            if mine
            else None
        ),
    )


@router.get("")
async def list_stories(
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    presenter: Presenter = Depends(get_presenter),
) -> list[schemas.Story]:
    """My stories and those of everyone I share a conversation with, newest first."""
    return [_out(story, me, presenter) for story in stories.list_stories(db, me)]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_story(
    body: schemas.StoryCreate,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    presenter: Presenter = Depends(get_presenter),
) -> schemas.Story:
    story = stories.create_story(db, me, body.body, body.background)
    return _out(story, me, presenter)


@router.post("/{story_id}/view", status_code=status.HTTP_204_NO_CONTENT)
async def view_story(
    story_id: int, me: User = Depends(current_user), db: Session = Depends(get_db)
) -> None:
    stories.mark_viewed(db, me, story_id)


@router.delete("/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_story(
    story_id: int, me: User = Depends(current_user), db: Session = Depends(get_db)
) -> None:
    stories.delete_story(db, me, story_id)

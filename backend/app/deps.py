"""FastAPI dependencies shared by the routers."""

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.auth import current_user
from app.config import Settings
from app.db import get_db
from app.models import User
from app.presenter import Presenter
from app.realtime.notifier import Notifier


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_notifier(request: Request) -> Notifier:
    return request.app.state.notifier


def get_presenter(
    db: Session = Depends(get_db),
    me: User = Depends(current_user),
    notifier: Notifier = Depends(get_notifier),
) -> Presenter:
    """A Presenter for the signed-in user's point of view."""
    return notifier.presenter(db, me.id)

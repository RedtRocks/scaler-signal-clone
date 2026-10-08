"""Session tokens: issue, hash, resolve. The raw token is only ever held by the client."""

import hashlib
import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db, utcnow
from app.models import User, UserSession

_bearer = HTTPBearer(auto_error=False)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: Session, user: User) -> str:
    """Start a new Session for `user` and return its raw token (shown to the client once)."""
    token = secrets.token_urlsafe(32)
    db.add(UserSession(user_id=user.id, token_hash=hash_token(token)))
    return token


def find_session(db: Session, token: str) -> UserSession | None:
    return db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(token)))


def user_for_token(db: Session, token: str) -> User | None:
    """Resolve a token to its User (used by the WebSocket endpoint)."""
    session = find_session(db, token)
    return session.user if session else None


def current_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> UserSession:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    session = find_session(db, credentials.credentials)
    if session is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired or invalid")
    session.last_used_at = utcnow()
    db.commit()
    return session


def current_user(session: UserSession = Depends(current_session)) -> User:
    return session.user

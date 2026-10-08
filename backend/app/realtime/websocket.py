"""The `/ws?token=` endpoint: pushes go out through the Notifier; the client may send
`typing`, `delivered` and `ping` frames. Everything else goes through REST."""

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from app.auth import user_for_token
from app.db import Database
from app.errors import DomainError
from app.models import User
from app.realtime.notifier import Notifier
from app.services import receipts, users
from app.services.access import get_membership

logger = logging.getLogger(__name__)

router = APIRouter()

# Application-defined close code (4000-4999 range): the token is missing or invalid.
CLOSE_UNAUTHORIZED = 4401


class TypingFrame(BaseModel):
    conversation_id: int
    is_typing: bool


class DeliveredFrame(BaseModel):
    message_ids: list[int]


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = "") -> None:
    db: Database = websocket.app.state.db
    notifier: Notifier = websocket.app.state.notifier

    # Accept first: a custom close code can only be sent on an accepted socket.
    await websocket.accept()
    with db.session() as session:
        user = user_for_token(session, token)
    if user is None:
        await websocket.close(code=CLOSE_UNAUTHORIZED)
        return

    user_id = user.id
    came_online = notifier.connections.connect(user_id, websocket)
    try:
        await websocket.send_json({"type": "hello", "data": {"user_id": user_id}})
        if came_online:
            with db.session() as session:
                await notifier.presence(session, session.get_one(User, user_id))
        while True:
            text = await websocket.receive_text()
            with db.session() as session:
                await _handle_frame(session, notifier, websocket, user_id, text)
    except WebSocketDisconnect:
        pass
    finally:
        if notifier.connections.disconnect(user_id, websocket):
            with db.session() as session:
                user = users.mark_last_seen(session, user_id)
                if user is not None:
                    await notifier.presence(session, user)


async def _handle_frame(
    db: Session, notifier: Notifier, websocket: WebSocket, user_id: int, text: str
) -> None:
    """Handle one client frame. Malformed or unauthorised frames are ignored, not fatal."""
    try:
        frame = json.loads(text)
        event_type, data = frame["type"], frame.get("data") or {}
        if event_type == "ping":
            await websocket.send_json({"type": "pong", "data": {}})
        elif event_type == "typing":
            typing = TypingFrame.model_validate(data)
            member = get_membership(db, typing.conversation_id, user_id)
            if member.is_active:
                await notifier.typing(db, user_id, typing.conversation_id, typing.is_typing)
        elif event_type == "delivered":
            delivered = DeliveredFrame.model_validate(data)
            changed = receipts.acknowledge_delivery(db, user_id, delivered.message_ids)
            await notifier.receipts_changed(db, changed)
        else:
            logger.debug("Ignoring unknown frame type %r from user %s", event_type, user_id)
    except (ValueError, KeyError, TypeError, ValidationError, DomainError) as error:
        logger.debug("Ignoring bad frame from user %s: %s", user_id, error)

"""In-memory registry of open WebSockets: user_id -> set of sockets (one per tab)."""

import logging
from collections import defaultdict
from collections.abc import Iterable
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._sockets: dict[int, set[WebSocket]] = defaultdict(set)

    def connect(self, user_id: int, websocket: WebSocket) -> bool:
        """Register a socket. Returns True if this is the user's first one (they came online)."""
        first = not self._sockets[user_id]
        self._sockets[user_id].add(websocket)
        return first

    def disconnect(self, user_id: int, websocket: WebSocket) -> bool:
        """Unregister a socket. Returns True if it was the user's last one (they went offline)."""
        sockets = self._sockets.get(user_id)
        if sockets is None:
            return False
        sockets.discard(websocket)
        if sockets:
            return False
        del self._sockets[user_id]
        return True

    def is_online(self, user_id: int) -> bool:
        return bool(self._sockets.get(user_id))

    async def send(self, user_id: int, event_type: str, data: Any) -> None:
        """Send one `{"type", "data"}` frame to every open socket of `user_id`."""
        frame = {"type": event_type, "data": data}
        # Copy: a failed send may lead to a disconnect that mutates the set.
        for websocket in list(self._sockets.get(user_id, ())):
            try:
                await websocket.send_json(frame)
            except Exception:  # A socket closing mid-send must not break the caller.
                logger.debug("Dropping frame to a closed socket of user %s", user_id)

    async def send_many(self, user_ids: Iterable[int], event_type: str, data: Any) -> None:
        for user_id in set(user_ids):
            await self.send(user_id, event_type, data)

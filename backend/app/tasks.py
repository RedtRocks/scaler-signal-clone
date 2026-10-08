"""Background work that runs for the lifetime of the app."""

import asyncio
import logging

from app.db import Database, utcnow
from app.realtime.notifier import Notifier
from app.services.messages import expire_due_messages

logger = logging.getLogger(__name__)


async def expire_messages_forever(
    db: Database, notifier: Notifier, interval_seconds: float
) -> None:
    """Every few seconds, delete messages whose disappearing timer ran out and tell members."""
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            with db.session() as session:
                for message in expire_due_messages(session, utcnow()):
                    await notifier.message_updated(session, message)
        except Exception:  # Keep the loop alive; one bad run must not stop future expiries.
            logger.exception("Expiring disappearing messages failed")

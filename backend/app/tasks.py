"""Background work that runs for the lifetime of the app."""

import asyncio
import logging
from pathlib import Path

from app.db import Database, utcnow
from app.realtime.notifier import Notifier
from app.services.attachments import purge_unclaimed
from app.services.messages import expire_due_messages
from app.services.stories import delete_expired

logger = logging.getLogger(__name__)


async def expire_messages_forever(
    db: Database,
    notifier: Notifier,
    interval_seconds: float,
    media_dir: Path,
    unclaimed_ttl_seconds: float,
) -> None:
    """Every few seconds, delete messages whose disappearing timer ran out (and their files),
    tell members, drop uploads that no message ever claimed, and delete expired stories."""
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            with db.session() as session:
                now = utcnow()
                for message in expire_due_messages(session, now, media_dir):
                    await notifier.message_updated(session, message)
                purge_unclaimed(session, media_dir, now, unclaimed_ttl_seconds)
                delete_expired(session, media_dir)
        except Exception:  # Keep the loop alive; one bad run must not stop future expiries.
            logger.exception("Expiring disappearing messages failed")

"""App factory: wires settings, database, realtime and routers together.

Run with `uvicorn app.main:app`. Tests call `create_app(Settings(...))` for an isolated app.
"""

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import Settings
from app.db import Database
from app.errors import DomainError
from app.realtime import websocket
from app.realtime.connections import ConnectionManager
from app.realtime.notifier import Notifier
from app.routers import (
    attachments,
    auth,
    contacts,
    conversations,
    me,
    messages,
    search,
    stories,
    users,
)
from app.tasks import expire_messages_forever


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    db = Database(settings.database_url)
    notifier = Notifier(ConnectionManager())

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        db.create_all()
        expiry = asyncio.create_task(
            expire_messages_forever(
                db,
                notifier,
                settings.expiry_interval_seconds,
                settings.media_dir,
                settings.unclaimed_attachment_ttl_seconds,
            )
        )
        yield
        expiry.cancel()

    app = FastAPI(title="Signal clone API", lifespan=lifespan)
    app.state.settings = settings
    app.state.db = db
    app.state.notifier = notifier

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(DomainError)
    async def domain_error_handler(_request: Request, error: DomainError) -> JSONResponse:
        return JSONResponse({"detail": error.detail}, status_code=error.status_code)

    routers = (auth, me, attachments, users, contacts, conversations, messages, search, stories)
    for module in (*routers, websocket):
        app.include_router(module.router)

    @app.get("/api/health", tags=["health"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    settings.media_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")
    return app


app = create_app()

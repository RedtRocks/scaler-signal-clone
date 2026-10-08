from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.orm import Session

from app import schemas
from app.auth import current_user
from app.config import Settings
from app.db import get_db
from app.deps import get_settings
from app.models import User
from app.services import users

router = APIRouter(prefix="/api/me", tags=["me"])


@router.get("")
async def get_me(me: User = Depends(current_user)) -> schemas.Me:
    return schemas.Me.model_validate(me)


@router.patch("")
async def update_me(
    body: schemas.MeUpdate, me: User = Depends(current_user), db: Session = Depends(get_db)
) -> schemas.Me:
    return schemas.Me.model_validate(users.update_profile(db, me, body))


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> schemas.Me:
    # Read one byte past the limit so an oversized upload is detected without reading it all.
    content = await file.read(settings.max_avatar_bytes + 1)
    user = users.save_avatar(
        db, me, content, file.content_type, settings.media_dir, settings.max_avatar_bytes
    )
    return schemas.Me.model_validate(user)

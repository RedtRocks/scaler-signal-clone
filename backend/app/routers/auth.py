from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app import schemas
from app.auth import current_session
from app.config import Settings
from app.db import get_db
from app.deps import get_settings
from app.models import UserSession
from app.services import accounts, users

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/request-otp")
async def request_otp(
    body: schemas.OtpRequest, db: Session = Depends(get_db)
) -> schemas.OtpRequested:
    # No SMS is sent: the code is always the fixed OTP (mocked by design).
    return schemas.OtpRequested(
        phone=body.phone, is_registered=users.find_by_phone(db, body.phone) is not None
    )


@router.post("/verify-otp")
async def verify_otp(
    body: schemas.OtpVerify,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> schemas.AuthResult:
    token, user, is_new = accounts.verify_otp(db, body.phone, body.code, settings.fixed_otp)
    return schemas.AuthResult(token=token, user=schemas.Me.model_validate(user), is_new=is_new)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    session: UserSession = Depends(current_session), db: Session = Depends(get_db)
) -> None:
    accounts.logout(db, session)

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import schemas
from app.db import get_db
from app.deps import get_presenter
from app.presenter import Presenter
from app.schemas import Phone
from app.services import users

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/lookup")
async def lookup_user(
    phone: Phone, db: Session = Depends(get_db), presenter: Presenter = Depends(get_presenter)
) -> schemas.UserPublic:
    return presenter.user(users.get_by_phone(db, phone))

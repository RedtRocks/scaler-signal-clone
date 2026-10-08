from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app import schemas
from app.auth import current_user
from app.db import get_db
from app.deps import get_presenter
from app.models import User
from app.presenter import Presenter
from app.services import contacts

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.get("")
async def list_contacts(
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    presenter: Presenter = Depends(get_presenter),
) -> list[schemas.Contact]:
    return presenter.contacts(contacts.list_contacts(db, me.id))


@router.post("", status_code=status.HTTP_201_CREATED)
async def add_contact(
    body: schemas.ContactCreate,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    presenter: Presenter = Depends(get_presenter),
) -> schemas.Contact:
    contact = contacts.add_contact(db, me, body.phone, body.nickname)
    return presenter.contacts([contact])[0]


@router.patch("/{user_id}")
async def rename_contact(
    user_id: int,
    body: schemas.ContactUpdate,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    presenter: Presenter = Depends(get_presenter),
) -> schemas.Contact:
    contact = contacts.rename_contact(db, me, user_id, body.nickname)
    return presenter.contacts([contact])[0]


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    user_id: int, me: User = Depends(current_user), db: Session = Depends(get_db)
) -> None:
    contacts.delete_contact(db, me, user_id)

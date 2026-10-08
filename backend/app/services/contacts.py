"""Contacts: a private, one-way address book. The saved user is never told."""

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.errors import BadRequest, Conflict, NotFound
from app.models import Contact, User
from app.services.users import get_by_phone


def list_contacts(db: Session, owner_id: int) -> list[Contact]:
    """All of the owner's contacts, sorted by the name shown (nickname first)."""
    contacts = db.scalars(
        select(Contact)
        .options(joinedload(Contact.contact_user))
        .where(Contact.owner_id == owner_id)
    )
    return sorted(contacts, key=lambda contact: contact.display_name.casefold())


def add_contact(db: Session, owner: User, phone: str, nickname: str | None) -> Contact:
    user = get_by_phone(db, phone)
    if user.id == owner.id:
        raise BadRequest("You can't add yourself as a contact")
    if _find(db, owner.id, user.id) is not None:
        raise Conflict("This person is already in your contacts")
    contact = Contact(owner_id=owner.id, contact_user=user, nickname=nickname)
    db.add(contact)
    db.commit()
    return contact


def rename_contact(db: Session, owner: User, user_id: int, nickname: str | None) -> Contact:
    contact = _get(db, owner.id, user_id)
    contact.nickname = nickname
    db.commit()
    return contact


def delete_contact(db: Session, owner: User, user_id: int) -> None:
    db.delete(_get(db, owner.id, user_id))
    db.commit()


def _find(db: Session, owner_id: int, user_id: int) -> Contact | None:
    return db.scalar(
        select(Contact).where(Contact.owner_id == owner_id, Contact.contact_user_id == user_id)
    )


def _get(db: Session, owner_id: int, user_id: int) -> Contact:
    contact = _find(db, owner_id, user_id)
    if contact is None:
        raise NotFound("Contact not found")
    return contact

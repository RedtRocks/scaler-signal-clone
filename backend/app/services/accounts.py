"""Sign-in with a (mocked) one-time code, and sign-out."""

from sqlalchemy.orm import Session

from app.auth import create_session
from app.errors import BadRequest
from app.models import User, UserSession
from app.services.users import find_by_phone


def verify_otp(db: Session, phone: str, code: str, expected_code: str) -> tuple[str, User, bool]:
    """Check the code, creating the User on first sign-in, and start a Session.

    Returns `(token, user, is_new)`. `is_new` means the profile step is still to do
    (no display name yet), which also covers someone who quit halfway through sign-up.
    """
    if code.strip() != expected_code:
        raise BadRequest("That code is incorrect")
    user = find_by_phone(db, phone)
    if user is None:
        user = User(phone=phone, display_name="")
        db.add(user)
        db.flush()
    token = create_session(db, user)
    db.commit()
    return token, user, user.display_name == ""


def logout(db: Session, session: UserSession) -> None:
    db.delete(session)
    db.commit()

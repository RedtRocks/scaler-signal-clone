from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import schemas
from app.auth import current_user
from app.db import get_db
from app.deps import get_presenter
from app.models import User
from app.presenter import Presenter
from app.services import contacts, conversations, messages

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
async def search(
    q: str = Query(min_length=1, max_length=100),
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    presenter: Presenter = Depends(get_presenter),
) -> schemas.SearchResults:
    """Case-insensitive search over my conversation titles, contacts and message text.
    Titles are matched after they are computed, because a direct title can be a nickname."""
    needle = q.strip().casefold()
    summaries = presenter.summaries(conversations.list_memberships(db, me.id))
    titles = {summary.id: summary.title for summary in summaries}

    matching_contacts = [
        contact
        for contact in presenter.contacts(contacts.list_contacts(db, me.id))
        if needle in contact.display_name.casefold()
        or needle in contact.user.display_name.casefold()
        or needle in contact.user.phone
    ]
    hits = messages.search_messages(db, me.id, q.strip())
    return schemas.SearchResults(
        conversations=[summary for summary in summaries if needle in summary.title.casefold()],
        contacts=matching_contacts,
        messages=[
            schemas.MessageSearchHit(
                message=message,
                conversation_id=message.conversation_id,
                conversation_title=titles[message.conversation_id],
            )
            for message in presenter.messages(hits)
        ],
    )

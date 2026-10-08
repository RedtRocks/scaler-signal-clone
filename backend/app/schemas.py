"""Request and response bodies. Response models mirror the shapes in docs/CONTRACT.md."""

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    StringConstraints,
    model_validator,
)

from app.models import ConversationKind, MemberRole, MessageKind


def _to_utc_string(value: datetime) -> str:
    # Stored datetimes are naive UTC (see app.db), so appending "Z" is accurate.
    return value.replace(microsecond=0).isoformat() + "Z"


UtcDateTime = Annotated[
    datetime, PlainSerializer(_to_utc_string, return_type=str, when_used="json")
]

Phone = Annotated[
    str, StringConstraints(strip_whitespace=True, pattern=r"^\+[1-9]\d{6,14}$")
]  # E.164
DisplayName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
Nickname = Annotated[str, StringConstraints(strip_whitespace=True, max_length=64)]
Emoji = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=16)]


def _empty_to_none(value: str | None) -> str | None:
    return value or None


OptionalNickname = Annotated[Nickname | None, AfterValidator(_empty_to_none)]
MessageStatus = Literal["sent", "delivered", "read"]


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Auth & profile ----------------------------------------------------------------------


class OtpRequest(BaseModel):
    phone: Phone


class OtpRequested(BaseModel):
    phone: str
    is_registered: bool


class OtpVerify(BaseModel):
    phone: Phone
    code: str


class Me(OrmModel):
    id: int
    phone: str
    display_name: str
    about: str | None
    avatar_url: str | None
    created_at: UtcDateTime


class AuthResult(BaseModel):
    token: str
    user: Me
    is_new: bool


class MeUpdate(BaseModel):
    display_name: DisplayName | None = None
    about: Annotated[str, StringConstraints(strip_whitespace=True, max_length=140)] | None = None
    avatar_url: Annotated[str, StringConstraints(max_length=512)] | None = None


# --- Users & contacts --------------------------------------------------------------------


class UserPublic(OrmModel):
    id: int
    phone: str
    display_name: str
    about: str | None
    avatar_url: str | None
    online: bool
    last_seen_at: UtcDateTime | None


class PresenceEvent(BaseModel):
    user_id: int
    online: bool
    last_seen_at: UtcDateTime | None


class Contact(BaseModel):
    user: UserPublic
    nickname: str | None
    display_name: str


class ContactCreate(BaseModel):
    phone: Phone
    nickname: OptionalNickname = None


class ContactUpdate(BaseModel):
    nickname: OptionalNickname


# --- Messages ----------------------------------------------------------------------------


class Attachment(BaseModel):
    id: int
    url: str
    file_name: str
    content_type: str
    size: int
    width: int | None
    height: int | None


class ReplyPreview(BaseModel):
    id: int
    sender_id: int | None
    body: str
    deleted: bool
    # The first attachment of the quoted message, for the thumbnail / file name in the quote.
    attachment: Attachment | None = None


class ReactionOut(BaseModel):
    emoji: str
    user_id: int


class Message(BaseModel):
    id: int
    conversation_id: int
    client_id: str | None
    sender_id: int | None
    kind: MessageKind
    body: str
    system_event: dict[str, Any] | None
    reply_to: ReplyPreview | None
    created_at: UtcDateTime
    expires_at: UtcDateTime | None
    deleted: bool
    edited: bool = False
    status: MessageStatus | None
    reactions: list[ReactionOut]
    attachments: list[Attachment] = []


class MessageEdit(BaseModel):
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]


class MessageCreate(BaseModel):
    """A caption and/or attachments (uploaded first, see docs/CONTRACT.md → Attachments)."""

    body: Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)] = ""
    client_id: Annotated[str, StringConstraints(min_length=1, max_length=64)]
    reply_to_id: int | None = None
    attachment_ids: list[int] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def _needs_content(self) -> "MessageCreate":
        if not self.body and not self.attachment_ids:
            raise ValueError("A message needs text or an attachment")
        return self


class ReadUpdate(BaseModel):
    up_to_message_id: int


class ReactionSet(BaseModel):
    emoji: Emoji


# --- Conversations -----------------------------------------------------------------------


class ConversationSummary(BaseModel):
    id: int
    kind: ConversationKind
    title: str
    avatar_url: str | None
    peer: UserPublic | None
    member_count: int
    last_message: Message | None
    last_message_at: UtcDateTime
    unread_count: int
    muted: bool
    pinned: bool
    archived: bool
    left: bool
    disappearing_seconds: int | None
    my_role: MemberRole


class MemberOut(BaseModel):
    user: UserPublic
    role: MemberRole
    joined_at: UtcDateTime


class ConversationDetail(ConversationSummary):
    description: str | None
    created_at: UtcDateTime
    members: list[MemberOut]
    # People who left or were removed. Old messages and system rows still need their names.
    former_members: list[UserPublic] = []


class DirectCreate(BaseModel):
    user_id: int


class GroupCreate(BaseModel):
    name: DisplayName
    member_ids: list[int] = Field(default_factory=list, max_length=256)


class ConversationUpdate(BaseModel):
    """Only the fields present in the request body are applied (see `model_fields_set`)."""

    name: DisplayName | None = None
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=512)] | None = (
        None
    )
    avatar_url: Annotated[str, StringConstraints(max_length=512)] | None = None
    disappearing_seconds: Annotated[int, Field(gt=0, le=60 * 60 * 24 * 7 * 4)] | None = None


class SettingsUpdate(BaseModel):
    muted: bool | None = None
    pinned: bool | None = None
    archived: bool | None = None


class MembersAdd(BaseModel):
    user_ids: list[int] = Field(min_length=1, max_length=256)


class RoleUpdate(BaseModel):
    role: MemberRole


# --- Search ------------------------------------------------------------------------------


class MessageSearchHit(BaseModel):
    message: Message
    conversation_id: int
    conversation_title: str


class SearchResults(BaseModel):
    conversations: list[ConversationSummary]
    contacts: list[Contact]
    messages: list[MessageSearchHit]


StoryBackground = Literal["ultramarine", "crimson", "forest", "plum", "sunset", "ink"]


class StoryCreate(BaseModel):
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=700)]
    background: StoryBackground = "ultramarine"


class StoryViewOut(BaseModel):
    user: UserPublic
    viewed_at: UtcDateTime


class Story(BaseModel):
    id: int
    author: UserPublic
    body: str
    background: str
    created_at: UtcDateTime
    expires_at: UtcDateTime
    viewed: bool
    # Only on my own stories.
    views: list[StoryViewOut] | None = None

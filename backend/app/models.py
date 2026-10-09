"""ORM models. Table and column names follow docs/CONTRACT.md exactly."""

import enum
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, utcnow


def _str_enum(enum_class: type[enum.Enum]) -> Enum:
    """Store an enum as its lowercase value in a VARCHAR, guarded by a CHECK constraint."""
    return Enum(
        enum_class,
        native_enum=False,
        create_constraint=True,
        values_callable=lambda members: [member.value for member in members],
        length=16,
    )


class ConversationKind(enum.StrEnum):
    DIRECT = "direct"
    GROUP = "group"


class MemberRole(enum.StrEnum):
    ADMIN = "admin"
    MEMBER = "member"


class MessageKind(enum.StrEnum):
    TEXT = "text"
    SYSTEM = "system"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True)
    display_name: Mapped[str] = mapped_column(String(64), default="")
    about: Mapped[str | None] = mapped_column(String(140))
    avatar_url: Mapped[str | None] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime)


class UserSession(Base):
    """A Session in glossary terms: one signed-in device. Only the token's hash is stored."""

    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_used_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user: Mapped[User] = relationship()


class Contact(Base):
    """A one-way address-book entry: `owner` saved `contact_user`, optionally under a nickname."""

    __tablename__ = "contacts"
    __table_args__ = (
        UniqueConstraint("owner_id", "contact_user_id"),
        CheckConstraint("owner_id <> contact_user_id", name="ck_contacts_not_self"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    contact_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    nickname: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    contact_user: Mapped[User] = relationship(foreign_keys=[contact_user_id])

    @property
    def display_name(self) -> str:
        return self.nickname or self.contact_user.display_name


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (
        # A direct conversation always has a direct_key and a group never does.
        CheckConstraint(
            "(kind = 'direct') = (direct_key IS NOT NULL)", name="ck_conversations_direct_key"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[ConversationKind] = mapped_column(_str_enum(ConversationKind))
    name: Mapped[str | None] = mapped_column(String(64))
    avatar_url: Mapped[str | None] = mapped_column(String(512))
    description: Mapped[str | None] = mapped_column(String(512))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    disappearing_seconds: Mapped[int | None] = mapped_column(Integer)
    # "minId:maxId" of the two users; the UNIQUE index enforces one direct conversation per pair.
    direct_key: Mapped[str | None] = mapped_column(String(41), unique=True)

    members: Mapped[list["Member"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", passive_deletes=True
    )

    @property
    def is_group(self) -> bool:
        return self.kind == ConversationKind.GROUP

    @property
    def active_members(self) -> list["Member"]:
        return [member for member in self.members if member.left_at is None]

    @staticmethod
    def direct_key_for(user_a: int, user_b: int) -> str:
        return f"{min(user_a, user_b)}:{max(user_a, user_b)}"


class Member(Base):
    """A User's place in a Conversation, including their per-conversation settings."""

    __tablename__ = "conversation_members"
    __table_args__ = (UniqueConstraint("conversation_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[MemberRole] = mapped_column(_str_enum(MemberRole), default=MemberRole.MEMBER)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    left_at: Mapped[datetime | None] = mapped_column(DateTime)
    # The read pointer. Not a foreign key so deleting messages never touches members.
    last_read_message_id: Mapped[int | None] = mapped_column(Integer)
    muted: Mapped[bool] = mapped_column(Boolean, default=False)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    # My colour for my own bubbles in this chat (a preset name); NULL = the default blue.
    chat_color: Mapped[str | None] = mapped_column(String(16))

    conversation: Mapped[Conversation] = relationship(back_populates="members")
    user: Mapped[User] = relationship()

    @property
    def is_active(self) -> bool:
        return self.left_at is None

    @property
    def is_admin(self) -> bool:
        return self.role == MemberRole.ADMIN


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_conversation_id_id", "conversation_id", "id"),
        # NULLs are distinct in SQLite, so system messages (no client_id) never collide.
        UniqueConstraint("sender_id", "client_id"),
        CheckConstraint("kind = 'system' OR sender_id IS NOT NULL", name="ck_messages_text_sender"),
        Index("ix_messages_expires_at", "expires_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"))
    # For a system message this is the actor, or NULL when the app itself acted.
    sender_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    kind: Mapped[MessageKind] = mapped_column(_str_enum(MessageKind), default=MessageKind.TEXT)
    body: Mapped[str] = mapped_column(Text, default="")
    system_event: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    client_id: Mapped[str | None] = mapped_column(String(64))
    reply_to_id: Mapped[int | None] = mapped_column(ForeignKey("messages.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)
    edited_at: Mapped[datetime | None] = mapped_column(DateTime)

    reply_to: Mapped["Message | None"] = relationship(remote_side=[id])
    receipts: Mapped[list["Receipt"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True
    )
    reactions: Mapped[list["Reaction"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True, order_by="Reaction.created_at"
    )
    attachments: Mapped[list["Attachment"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True, order_by="Attachment.position"
    )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    @property
    def is_edited(self) -> bool:
        return self.edited_at is not None


class Receipt(Base):
    """One recipient's delivery record for one Message. The sender never has one."""

    __tablename__ = "message_receipts"
    __table_args__ = (
        CheckConstraint(
            "read_at IS NULL OR delivered_at IS NOT NULL", name="ck_receipts_read_implies_delivered"
        ),
        Index("ix_message_receipts_user_id_delivered_at", "user_id", "delivered_at"),
    )

    message_id: Mapped[int] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime)
    read_at: Mapped[datetime | None] = mapped_column(DateTime)


class Reaction(Base):
    """One emoji per User per Message; choosing another emoji replaces the row."""

    __tablename__ = "message_reactions"

    message_id: Mapped[int] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    emoji: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Attachment(Base):
    """One uploaded file. `message_id` stays NULL until a message claims it (see docs/CONTRACT.md)."""

    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"))
    uploader_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    message_id: Mapped[int | None] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer, default=0)
    file_name: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(64))
    size: Mapped[int] = mapped_column(Integer)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    # Audio only: set for a recorded voice message (shown with a waveform), NULL for a plain file.
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    # Random file name under MEDIA_DIR/attachments/. The URL is derived from it.
    storage_name: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    @property
    def url(self) -> str:
        return f"/media/attachments/{self.storage_name}"


class HiddenMessage(Base):
    """Delete for me: the Message stays for everyone else but is left out of this user's history."""

    __tablename__ = "hidden_messages"

    message_id: Mapped[int] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Story(Base):
    """A Story (text on a colour, or a photo with a caption): visible for 24 hours to everyone the
    author shares a conversation with."""

    __tablename__ = "stories"
    __table_args__ = (Index("ix_stories_expires_at", "expires_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    body: Mapped[str] = mapped_column(String(700), default="")
    # A photo story: "/media/stories/<file>". NULL for a text story.
    media_url: Mapped[str | None] = mapped_column(String(512))
    # One of the preset background names (see schemas.StoryBackground).
    background: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)

    author: Mapped[User] = relationship()
    views: Mapped[list["StoryView"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True, order_by="StoryView.viewed_at"
    )


class StoryView(Base):
    """One viewer having seen one Story."""

    __tablename__ = "story_views"

    story_id: Mapped[int] = mapped_column(
        ForeignKey("stories.id", ondelete="CASCADE"), primary_key=True
    )
    viewer_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    viewed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    viewer: Mapped[User] = relationship()

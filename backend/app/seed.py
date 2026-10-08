"""Demo data: `python -m app.seed`.

Idempotent by reset: every run drops all tables and recreates the same demo world
(relative to the current time), so it can be re-run at any point. It also signs
everyone out, because sessions are dropped with the rest.

Sign in as +15550000001 ("Aarav Dudeja") with OTP 123456.
"""

import secrets
import shutil
import struct
import zlib
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import Settings
from app.services.users import find_by_phone
from app.db import Database, utcnow
from app.models import (
    Attachment,
    Contact,
    Conversation,
    ConversationKind,
    Member,
    MemberRole,
    Message,
    MessageKind,
    Reaction,
    Receipt,
    User,
)

NOW = utcnow()


def ago(days: float = 0, hours: float = 0, minutes: float = 0) -> datetime:
    return NOW - timedelta(days=days, hours=hours, minutes=minutes)


# key -> (phone, display name, about)
PEOPLE = {
    "aarav": ("+15550000001", "Aarav Dudeja", "Building things, one commit at a time"),
    "maya": ("+15550000002", "Maya Patel", "Probably at the crag 🧗‍♀️"),
    "kai": ("+15550000003", "Kai Nakamura", "Coffee first"),
    "ishita": ("+15550000004", "Ishita Dudeja", "Ask me about my plants 🌿"),
    "mom": ("+15550000005", "Sunita Dudeja", None),
    "rohan": ("+15550000006", "Rohan Mehta", "Gym. Work. Sleep. Repeat."),
    "zoe": ("+15550000007", "Zoe Williams", "Available"),
    "daniel": ("+15550000008", "Daniel Okafor", "Product design, bad puns"),
}

LAST_SEEN = {
    "maya": ago(minutes=10),
    "kai": ago(minutes=35),
    "ishita": ago(days=1, hours=2),
    "mom": ago(hours=2),
    "rohan": ago(minutes=50),
    "zoe": ago(minutes=20),
    "daniel": ago(days=3, hours=1),
}

# owner -> {saved user: nickname or None}
CONTACTS = {
    "aarav": {"maya": None, "kai": None, "ishita": None, "mom": "Mom", "rohan": None, "zoe": None},
    "mom": {"aarav": "Aaru", "ishita": "Ishu"},
    "ishita": {"aarav": "Bhai", "mom": "Mumma"},
    "maya": {"aarav": None, "kai": None, "zoe": None, "daniel": None},
    "kai": {"aarav": None, "maya": None},
    "rohan": {"aarav": None, "zoe": None},
    "zoe": {"aarav": None, "rohan": None, "maya": None},
}


def demo_png(width: int = 640, height: int = 420) -> bytes:
    """A small sunset-over-mountains picture, drawn pixel by pixel (no image library, no
    download), so the demo has a real image attachment."""
    rows = bytearray()
    for y in range(height):
        rows.append(0)  # filter type: none
        t = y / height
        for x in range(width):
            ridge = height * (0.55 + 0.15 * abs((x / 70) % 2 - 1))  # triangle-wave peaks
            if y > ridge:  # mountains, darker towards the bottom
                shade = int(60 - 40 * (y - ridge) / height)
                rows += bytes((shade, shade + 8, shade + 24))
            else:  # sky: deep blue at the top, orange at the horizon
                rows += bytes((int(40 + 215 * t**1.5), int(60 + 120 * t), int(150 - 90 * t)))
    def chunk(kind: bytes, data: bytes) -> bytes:
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(rows), 9))
        + chunk(b"IEND", b"")
    )


@dataclass
class Timeline:
    """Writes one conversation's messages in order and settles its receipts at the end."""

    db: Session
    conversation: Conversation
    users: dict[str, User]
    messages: list[Message] = field(default_factory=list)

    def text(
        self,
        sender: str,
        at: datetime,
        body: str,
        reply_to: Message | None = None,
        reactions: dict[str, str] | None = None,
    ) -> Message:
        disappearing = self.conversation.disappearing_seconds
        message = self._add(
            Message(
                sender_id=self.users[sender].id,
                kind=MessageKind.TEXT,
                body=body,
                client_id=f"seed-{len(self.messages)}-{self.conversation.id}",
                reply_to_id=reply_to.id if reply_to else None,
                created_at=at,
                expires_at=at + timedelta(seconds=disappearing) if disappearing else None,
            )
        )
        for who, emoji in (reactions or {}).items():
            self.db.add(
                Reaction(
                    message_id=message.id,
                    user_id=self.users[who].id,
                    emoji=emoji,
                    created_at=at + timedelta(minutes=3),
                )
            )
        return message

    def photo(
        self, sender: str, at: datetime, caption: str, media_dir: Path, file_name: str
    ) -> Message:
        """A message with one generated PNG attached."""
        message = self.text(sender, at, caption)
        data = demo_png()
        folder = media_dir / "attachments"
        folder.mkdir(parents=True, exist_ok=True)
        storage_name = f"{secrets.token_hex(16)}.png"
        (folder / storage_name).write_bytes(data)
        self.db.add(
            Attachment(
                conversation_id=self.conversation.id,
                uploader_id=self.users[sender].id,
                message_id=message.id,
                file_name=file_name,
                content_type="image/png",
                size=len(data),
                width=640,
                height=420,
                storage_name=storage_name,
                created_at=at,
            )
        )
        return message

    def system(self, actor: str | None, at: datetime, event: dict) -> Message:
        actor_id = self.users[actor].id if actor else None
        return self._add(
            Message(sender_id=actor_id, kind=MessageKind.SYSTEM, system_event=event, created_at=at)
        )

    def settle(
        self, unread: dict[str, int] | None = None, undelivered: dict[str, int] | None = None
    ) -> None:
        """Create receipts and read pointers. By default everyone has read everything;
        `unread[user]` leaves that user's last N incoming texts unread (but delivered), and
        `undelivered[user]` leaves their last N incoming texts not even delivered."""
        unread, undelivered = unread or {}, undelivered or {}
        names = {user.id: key for key, user in self.users.items()}
        for member in self.conversation.members:
            name = names[member.user_id]
            visible = [m for m in self.messages if _was_member_at(member, m.created_at)]
            incoming = [
                m for m in visible if m.kind == MessageKind.TEXT and m.sender_id != member.user_id
            ]
            not_delivered = {m.id for m in _last(incoming, undelivered.get(name, 0))}
            not_read = {m.id for m in _last(incoming, unread.get(name, 0))} | not_delivered

            for message in incoming:
                receipt = Receipt(message_id=message.id, user_id=member.user_id)
                if message.id not in not_delivered:
                    receipt.delivered_at = message.created_at + timedelta(seconds=4)
                if message.id not in not_read:
                    receipt.read_at = min(message.created_at + timedelta(minutes=2), NOW)
                self.db.add(receipt)

            # The read pointer sits on the last message before the first unread one.
            first_unread = min(not_read, default=None)
            read = [m for m in visible if first_unread is None or m.id < first_unread]
            member.last_read_message_id = read[-1].id if read else None
        self.conversation.last_message_at = self.messages[-1].created_at

    def _add(self, message: Message) -> Message:
        message.conversation_id = self.conversation.id
        self.db.add(message)
        self.db.flush()
        self.messages.append(message)
        return message


def _was_member_at(member: Member, at: datetime) -> bool:
    return member.joined_at <= at and (member.left_at is None or at <= member.left_at)


def _last(messages: list[Message], count: int) -> list[Message]:
    return messages[len(messages) - count :] if count else []


def seed(db: Session, media_dir: Path | None = None) -> None:
    users = {
        key: User(
            phone=phone,
            display_name=name,
            about=about,
            created_at=ago(days=30),
            last_seen_at=LAST_SEEN.get(key),
        )
        for key, (phone, name, about) in PEOPLE.items()
    }
    db.add_all(users.values())
    db.flush()

    for owner, saved in CONTACTS.items():
        for who, nickname in saved.items():
            db.add(
                Contact(
                    owner_id=users[owner].id,
                    contact_user_id=users[who].id,
                    nickname=nickname,
                    created_at=ago(days=20),
                )
            )

    def direct(a: str, b: str, since: datetime, timer: int | None = None) -> Timeline:
        conversation = Conversation(
            kind=ConversationKind.DIRECT,
            direct_key=Conversation.direct_key_for(users[a].id, users[b].id),
            created_by=users[a].id,
            created_at=since,
            disappearing_seconds=timer,
            members=[
                Member(user_id=users[a].id, joined_at=since),
                Member(user_id=users[b].id, joined_at=since),
            ],
        )
        db.add(conversation)
        db.flush()
        return Timeline(db, conversation, users)

    def group(name: str, creator: str, others: list[str], since: datetime) -> Timeline:
        conversation = Conversation(
            kind=ConversationKind.GROUP,
            name=name,
            created_by=users[creator].id,
            created_at=since,
            members=[Member(user_id=users[creator].id, role=MemberRole.ADMIN, joined_at=since)]
            + [Member(user_id=users[who].id, joined_at=since) for who in others],
        )
        db.add(conversation)
        db.flush()
        timeline = Timeline(db, conversation, users)
        timeline.system(creator, since, {"type": "group_created"})
        timeline.system(
            creator,
            since,
            {"type": "members_added", "user_ids": sorted(users[w].id for w in others)},
        )
        return timeline

    def member(timeline: Timeline, who: str) -> Member:
        return next(m for m in timeline.conversation.members if m.user_id == users[who].id)

    # --- Aarav & Maya: planning a climbing weekend --------------------------------------
    t = direct("aarav", "maya", ago(days=6, hours=2))
    t.text("maya", ago(days=6, hours=1, minutes=50), "Are you still up for the gym on Thursday?")
    t.text("aarav", ago(days=6, hours=1, minutes=35), "Yes! 7pm works?")
    t.text("maya", ago(days=6, hours=1, minutes=34), "Perfect. I'll bring the spare chalk bag")
    t.text("maya", ago(days=4, hours=3), "That V4 in the cave is going to haunt me")
    t.text("aarav", ago(days=4, hours=2, minutes=57), "You were SO close on the last go")
    t.text("aarav", ago(days=4, hours=2, minutes=56), "Next week for sure")
    weather = t.text("maya", ago(days=1, hours=5), "Weather looks great for Saturday. Outdoor day?")
    t.text("aarav", ago(days=1, hours=4, minutes=40), "I'm in. Should we ask Kai if he can drive?")
    t.text("maya", ago(days=1, hours=4, minutes=38), "Already did, he's in 🙌")
    t.text(
        "aarav",
        ago(days=1, hours=4, minutes=30),
        "Bringing the new rope then",
        reply_to=weather,
        reactions={"maya": "❤️"},
    )
    t.text(
        "maya",
        ago(hours=3),
        "Leaving at 8 sharp, don't be late this time 😄",
        reactions={"aarav": "😂"},
    )
    if media_dir is not None:
        t.photo("maya", ago(hours=2, minutes=58), "Sunrise from last time", media_dir, "crag-sunrise.png")
    t.text("aarav", ago(hours=2, minutes=55), "No promises")
    t.settle()

    # --- Aarav & Kai: disappearing messages turned on a few hours ago ------------------
    t = direct("aarav", "kai", ago(days=5, hours=3))
    t.text("kai", ago(days=5, hours=3), "Did you end up getting the 70m rope or the 60?")
    t.text(
        "aarav", ago(days=5, hours=2, minutes=50), "70. The extra length is worth it at the crag"
    )
    t.text(
        "kai",
        ago(days=5, hours=2, minutes=45),
        "Smart. Can I borrow your belay device Saturday? Mine's at my sister's",
    )
    t.text("aarav", ago(days=5, hours=2, minutes=40), "Sure, I'll bring it")
    t.conversation.disappearing_seconds = 24 * 60 * 60
    t.system("kai", ago(hours=3, minutes=5), {"type": "timer_changed", "seconds": 24 * 60 * 60})
    t.text("kai", ago(hours=3), "Turned on disappearing messages, don't mind me")
    t.text("kai", ago(hours=2, minutes=58), "Gate code for the parking lot is 4471")
    t.text("aarav", ago(hours=2, minutes=50), "Got it, thanks")
    t.text("aarav", ago(minutes=40), "Picking up coffee on the way Saturday, want anything?")
    t.settle(unread={"kai": 1})  # delivered, not read yet

    # --- Aarav & Mom: two unread ----------------------------------------------------------
    t = direct("aarav", "mom", ago(days=6, hours=5))
    t.text("mom", ago(days=6, hours=5), "Beta did you eat?")
    t.text("aarav", ago(days=6, hours=4, minutes=40), "Yes Mom, made dal and rice")
    t.text("mom", ago(days=6, hours=4, minutes=38), "Good. Don't just eat Maggi every night")
    t.text("mom", ago(days=3, hours=6), "Papa's knee is better now, the physio is helping")
    t.text(
        "aarav",
        ago(days=3, hours=5, minutes=30),
        "That's great! Tell him not to skip the exercises",
    )
    t.text("mom", ago(days=3, hours=5, minutes=28), "You tell him. He listens to you 🙄")
    t.text("mom", ago(hours=5, minutes=10), "Are you coming home for Diwali?")
    t.text("mom", ago(hours=5, minutes=9), "Ishita is coming on the 18th")
    t.settle(unread={"aarav": 2})

    # --- Aarav & Ishita: anniversary surprise ---------------------------------------------
    t = direct("aarav", "ishita", ago(days=2, hours=8))
    t.text(
        "ishita",
        ago(days=2, hours=8),
        "Bhai, Mom and Papa's anniversary is on the 24th. Any ideas?",
    )
    t.text("aarav", ago(days=2, hours=7, minutes=45), "Dinner at that Kerala place they like?")
    t.text("ishita", ago(days=2, hours=7, minutes=44), "They've been there 5 times this year 😂")
    t.text("ishita", ago(days=2, hours=7, minutes=43), "What about a weekend trip to Lonavala?")
    t.text(
        "aarav",
        ago(days=2, hours=7, minutes=30),
        "Ooh yes. I'll book, you keep Papa from finding out",
    )
    t.text("ishita", ago(days=1, hours=3), "Found a nice homestay with a garden, Mom will love it")
    t.text(
        "aarav",
        ago(days=1, hours=2, minutes=40),
        "Looks perfect, booking it tonight",
        reactions={"ishita": "🎉"},
    )
    t.settle()

    # --- Aarav & Rohan: one unread ----------------------------------------------------------
    t = direct("aarav", "rohan", ago(days=4, hours=4))
    t.text("rohan", ago(days=4, hours=4), "Electricity bill came, ₹2,340 total")
    t.text("aarav", ago(days=4, hours=3, minutes=50), "Sending my share now")
    t.text("rohan", ago(days=4, hours=3, minutes=45), "Got it 👍")
    t.text(
        "rohan",
        ago(hours=1, minutes=5),
        "Landlord is coming to fix the geyser tomorrow at 10. Can you be home?",
    )
    t.settle(unread={"aarav": 1})

    # --- Aarav & Daniel (not a saved contact): last message still only "sent" ---------
    t = direct("daniel", "aarav", ago(days=3, hours=6))
    t.text(
        "daniel",
        ago(days=3, hours=6),
        "Hey Aarav, it's Daniel from the climbing gym. Maya gave me your number",
    )
    t.text("aarav", ago(days=3, hours=5, minutes=30), "Hey Daniel! Good to hear from you")
    t.text(
        "daniel",
        ago(days=3, hours=5, minutes=25),
        "Any good beginner routes at the crag? Want to take my brother",
    )
    t.text(
        "aarav",
        ago(days=3, hours=5, minutes=10),
        "The slab wall on the left side is great for beginners. Lots of 5.6s and 5.7s",
    )
    t.text("aarav", ago(hours=4), "Also, we're going Saturday if you two want to join")
    t.settle(undelivered={"daniel": 1})

    # --- Family group: Mom created it, made Aarav an admin; pinned for Aarav ----------
    t = group("Family", "mom", ["aarav", "ishita"], ago(days=7))
    t.text(
        "mom",
        ago(days=6, hours=23, minutes=58),
        "Family group! Now nobody can say they missed my messages",
    )
    t.text("ishita", ago(days=6, hours=23, minutes=50), "Oh no 😂")
    t.text("aarav", ago(days=6, hours=23, minutes=45), "Welcome to the internet, Mom")
    member(t, "aarav").role = MemberRole.ADMIN
    t.system(
        "mom",
        ago(days=6, hours=23, minutes=40),
        {"type": "admin_granted", "user_id": users["aarav"].id},
    )
    photos = t.text(
        "mom",
        ago(days=5, hours=2),
        "Sending the photos from cousin Neha's wedding. Everyone looked so nice",
    )
    t.text(
        "ishita",
        ago(days=5, hours=1, minutes=30),
        "Mom you look amazing in that saree",
        reply_to=photos,
        reactions={"mom": "❤️", "aarav": "💯"},
    )
    t.text("mom", ago(days=1, hours=6), "Reminder: Nani's birthday is on Sunday. Call her!")
    t.text(
        "aarav",
        ago(days=1, hours=5, minutes=50),
        "Already set a reminder 📅",
        reactions={"mom": "👍"},
    )
    t.text("ishita", ago(days=1, hours=5, minutes=45), "Same")
    t.settle()
    member(t, "aarav").pinned = True

    # --- Rock climbers: renamed, a new admin, someone left; three unread --------------
    t = group("Climbing crew", "maya", ["aarav", "kai", "zoe", "daniel"], ago(days=7, hours=3))
    t.text("maya", ago(days=7, hours=2, minutes=58), "Made a group so we stop losing plans in DMs")
    t.text("zoe", ago(days=7, hours=2, minutes=50), "Finally")
    t.conversation.name = "Rock climbers"
    t.system("maya", ago(days=6, hours=8), {"type": "renamed", "name": "Rock climbers"})
    member(t, "kai").role = MemberRole.ADMIN
    t.system(
        "maya",
        ago(days=6, hours=7, minutes=59),
        {"type": "admin_granted", "user_id": users["kai"].id},
    )
    t.text("kai", ago(days=6, hours=7), "Gym session Thursday 7pm, who's in?")
    t.text("aarav", ago(days=6, hours=6, minutes=50), "Me")
    t.text("zoe", ago(days=6, hours=6, minutes=45), "Me too, might be 15 min late")
    t.text("daniel", ago(days=5, hours=9), "Can't this week, sorry!")
    t.system("daniel", ago(days=2, hours=4), {"type": "member_left"})
    member(t, "daniel").left_at = ago(days=2, hours=4)
    t.text("maya", ago(days=1, hours=6), "Outdoor day Saturday! Kai is driving")
    t.text("kai", ago(days=1, hours=5, minutes=55), "Car fits 4 plus gear. Leaving at 8")
    t.text(
        "aarav",
        ago(days=1, hours=5, minutes=50),
        "Can't wait",
        reactions={"maya": "🔥", "zoe": "🔥"},
    )
    t.text("zoe", ago(hours=2), "Can someone lend me a harness? The strap on mine is fraying")
    t.text("maya", ago(hours=1, minutes=45), "I have a spare one, will bring it")
    t.text("kai", ago(hours=1), "Forecast still says sunny ☀️")
    t.settle(unread={"aarav": 3, "zoe": 1})

    # --- Roommates: two unread ------------------------------------------------------------
    t = group("Roommates", "rohan", ["aarav", "zoe"], ago(days=6, hours=10))
    t.text("rohan", ago(days=6, hours=9, minutes=58), "House group for bills, chores etc.")
    t.text("zoe", ago(days=6, hours=9, minutes=50), "Can we also use it to complain about dishes")
    t.text("rohan", ago(days=6, hours=9, minutes=45), "That's literally the main purpose")
    t.text("zoe", ago(days=3, hours=2), "Whoever finished the milk, please buy more 🥛")
    t.text(
        "aarav",
        ago(days=3, hours=1, minutes=40),
        "Guilty. Getting it tonight",
        reactions={"zoe": "😂"},
    )
    t.text(
        "rohan",
        ago(hours=6),
        "Cleaning rota this week: Aarav kitchen, Zoe bathroom, me living room",
    )
    t.text("zoe", ago(hours=5, minutes=50), "Fine, but I'm swapping with Aarav next week")
    t.settle(unread={"aarav": 2})

    db.commit()


def welcome(db: Session, user: User) -> None:
    """Give a brand-new account a few conversations with the demo people, so someone who
    signs up with their own number lands in a populated app. No-op when the demo world
    isn't seeded (e.g. in tests)."""
    found = {key: find_by_phone(db, phone) for key, (phone, _, _) in PEOPLE.items()}
    if any(u is None for k, u in found.items() if k in ("maya", "kai", "zoe", "daniel")):
        return
    people = {k: u for k, u in found.items() if u is not None} | {"me": user}
    now = utcnow()

    def at(minutes: float) -> datetime:
        return now - timedelta(minutes=minutes)

    for who in ("maya", "kai", "zoe", "daniel"):
        db.add(Contact(owner_id=user.id, contact_user_id=people[who].id, created_at=now))

    def direct(other: str) -> Timeline:
        conversation = Conversation(
            kind=ConversationKind.DIRECT,
            direct_key=Conversation.direct_key_for(user.id, people[other].id),
            created_by=people[other].id,
            created_at=at(180),
            members=[
                Member(user_id=user.id, joined_at=at(180)),
                Member(user_id=people[other].id, joined_at=at(180)),
            ],
        )
        db.add(conversation)
        db.flush()
        return Timeline(db, conversation, people)

    t = direct("maya")
    hi = t.text("maya", at(120), "Hey! Welcome to Signal 👋")
    t.text("me", at(118), "Thanks! Just trying it out", reactions={"maya": "❤️"})
    t.text("maya", at(117), "Try replying to a message, reacting, or sending a photo")
    t.text("maya", at(3), "Also check out the group chat I added you to", reply_to=hi)
    t.settle(unread={"me": 1})

    t = direct("kai")
    t.text("me", at(90), "Are we still on for coffee tomorrow?")
    t.text("kai", at(88), "Yes, 9am at the usual place ☕")
    t.text("me", at(87), "See you there", reactions={"kai": "👍"})
    t.settle()

    t = direct("daniel")
    t.text("daniel", at(30), "Quick one: can you look at the new mockups later?")
    t.text("daniel", at(29), "No rush, whenever you get a minute")
    t.settle(unread={"me": 2})

    since = at(150)
    conversation = Conversation(
        kind=ConversationKind.GROUP,
        name="Weekend Plans",
        created_by=people["maya"].id,
        created_at=since,
        members=[Member(user_id=people["maya"].id, role=MemberRole.ADMIN, joined_at=since)]
        + [Member(user_id=people[w].id, joined_at=since) for w in ("kai", "zoe", "me")],
    )
    db.add(conversation)
    db.flush()
    t = Timeline(db, conversation, people)
    t.system("maya", since, {"type": "group_created"})
    t.system(
        "maya",
        since,
        {"type": "members_added", "user_ids": sorted(people[w].id for w in ("kai", "zoe", "me"))},
    )
    plan = t.text("maya", at(60), "Hike on Saturday? Weather looks perfect")
    t.text("zoe", at(55), "I'm in!", reactions={"maya": "🙌", "kai": "👍"})
    t.text("kai", at(50), "I can drive, 4 seats", reply_to=plan)
    t.text("zoe", at(5), "Leaving at 8, don't be late 😄")
    t.settle(unread={"me": 3})


def main() -> None:
    settings = Settings()
    database = Database(settings.database_url)
    database.drop_all()
    database.create_all()
    # Files of the previous demo world would be orphans now.
    shutil.rmtree(settings.media_dir / "attachments", ignore_errors=True)
    with database.session() as session:
        seed(session, settings.media_dir)
    print("Seeded demo data. Sign in as +15550000001 with code 123456.")


if __name__ == "__main__":
    main()

"""Phone number validation shared by every endpoint that takes a phone number."""

import phonenumbers

# The eight seeded demo people (app/seed.py) use fictional +1 555 numbers, which a real
# numbering plan rejects. They are allowed by exact match so the reviewer accounts and
# demo contacts keep working; no other fictional number is accepted.
DEMO_PHONES = frozenset(f"+1555000000{n}" for n in range(1, 9))


def normalize_phone(value: str) -> str:
    """Return the E.164 form of a real phone number, or raise ValueError."""
    value = value.strip()
    if value in DEMO_PHONES:
        return value
    try:
        parsed = phonenumbers.parse(value, None)
    except phonenumbers.NumberParseException:
        raise ValueError("Enter a valid phone number with its country code.") from None
    if not phonenumbers.is_valid_number(parsed):
        raise ValueError("That doesn't look like a real phone number.")
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)

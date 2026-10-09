"""Phone number validation shared by every endpoint that takes a phone number."""

import phonenumbers


def normalize_phone(value: str) -> str:
    """Return the E.164 form of a number, or raise ValueError.

    Only the length is checked against the country's numbering plan (10 digits for +1, and so
    on), so too-short or too-long numbers are rejected but any right-length number is accepted.
    """
    value = value.strip()
    try:
        parsed = phonenumbers.parse(value, None)
    except phonenumbers.NumberParseException:
        raise ValueError("Enter a valid phone number with its country code.") from None
    if not phonenumbers.is_possible_number(parsed):
        raise ValueError("That phone number is the wrong length for its country.")
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)

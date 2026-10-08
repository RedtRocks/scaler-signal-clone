"""Read the pixel size of PNG, GIF, JPEG and WebP files from their headers (no Pillow).

Returns None when the bytes are not a well-formed image of the declared type, which the
upload endpoint reports as a 400. Only the first bytes are inspected, never decoded.
"""

import struct


def image_size(content_type: str, data: bytes) -> tuple[int, int] | None:
    reader = _READERS.get(content_type)
    if reader is None:
        return None
    try:
        size = reader(data)
    except (struct.error, IndexError):
        return None
    if size is None or not (0 < size[0] <= 65535 and 0 < size[1] <= 65535):
        return None
    return size


def _png(data: bytes) -> tuple[int, int] | None:
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", data[16:24])


def _gif(data: bytes) -> tuple[int, int] | None:
    if data[:6] not in (b"GIF87a", b"GIF89a"):
        return None
    return struct.unpack("<HH", data[6:10])


def _jpeg(data: bytes) -> tuple[int, int] | None:
    if data[:2] != b"\xff\xd8":
        return None
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            return None
        marker = data[i + 1]
        if marker == 0xFF:  # padding
            i += 1
            continue
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:  # markers without a length
            i += 2
            continue
        (length,) = struct.unpack(">H", data[i + 2 : i + 4])
        # SOF0..SOF15 carry the frame size, except DHT (C4), JPG (C8) and DAC (CC).
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            height, width = struct.unpack(">HH", data[i + 5 : i + 9])
            return width, height
        i += 2 + length
    return None


def _webp(data: bytes) -> tuple[int, int] | None:
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        return None
    chunk = data[12:16]
    if chunk == b"VP8 ":  # lossy
        width, height = struct.unpack("<HH", data[26:30])
        return width & 0x3FFF, height & 0x3FFF
    if chunk == b"VP8L":  # lossless
        bits = struct.unpack("<I", data[21:25])[0]
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    if chunk == b"VP8X":  # extended
        width = int.from_bytes(data[24:27], "little") + 1
        height = int.from_bytes(data[27:30], "little") + 1
        return width, height
    return None


_READERS = {"image/png": _png, "image/gif": _gif, "image/jpeg": _jpeg, "image/webp": _webp}

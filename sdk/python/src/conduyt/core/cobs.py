"""COBS — Consistent Overhead Byte Stuffing"""


def cobs_encode(src: bytes | bytearray) -> bytes:
    """Encode data using COBS. Output never contains 0x00."""
    if len(src) == 0:
        return bytes([0x01])

    dst = bytearray()
    code_idx = len(dst)
    dst.append(0)  # placeholder for first code byte
    code = 1

    for b in src:
        if b == 0x00:
            dst[code_idx] = code
            code_idx = len(dst)
            dst.append(0)  # placeholder
            code = 1
        else:
            dst.append(b)
            code += 1
            if code == 0xFF:
                dst[code_idx] = code
                code_idx = len(dst)
                dst.append(0)
                code = 1

    dst[code_idx] = code
    return bytes(dst)


def cobs_decode(src: bytes | bytearray) -> bytes | None:
    """Decode COBS-encoded data. Returns None on decode error."""
    if len(src) == 0:
        return None

    dst = bytearray()
    idx = 0

    while idx < len(src):
        code = src[idx]
        idx += 1

        if code == 0x00:
            return None  # unexpected zero

        count = code - 1

        if idx + count > len(src):
            return None

        for _ in range(count):
            dst.append(src[idx])
            idx += 1

        if code < 0xFF and idx < len(src):
            dst.append(0x00)

    return bytes(dst)

"""CONDUYT Wire Format — Packet encode/decode"""

from __future__ import annotations

import struct
from dataclasses import dataclass

from .constants import PROTOCOL_VERSION, MAGIC, HEADER_SIZE
from .crc8 import crc8


@dataclass
class ConduytPacket:
    version: int
    type: int
    seq: int
    payload: bytes


def wire_encode(packet: ConduytPacket) -> bytes:
    """Encode a ConduytPacket into raw wire bytes."""
    payload_len = len(packet.payload)
    buf = bytearray(HEADER_SIZE + payload_len)

    # MAGIC
    buf[0] = MAGIC[0]
    buf[1] = MAGIC[1]
    # VER
    buf[2] = packet.version
    # TYPE
    buf[3] = packet.type
    # SEQ
    buf[4] = packet.seq
    # LEN (little-endian uint16)
    struct.pack_into("<H", buf, 5, payload_len)
    # PAYLOAD
    buf[7 : 7 + payload_len] = packet.payload
    # CRC8 over [VER..end of PAYLOAD]
    crc_region = buf[2 : 7 + payload_len]
    buf[7 + payload_len] = crc8(crc_region)

    return bytes(buf)


def wire_decode(data: bytes | bytearray) -> ConduytPacket:
    """Decode raw wire bytes into a ConduytPacket. Raises ValueError on error."""
    if len(data) < HEADER_SIZE:
        raise ValueError(f"Incomplete packet: need {HEADER_SIZE} bytes, got {len(data)}")

    if data[0] != MAGIC[0] or data[1] != MAGIC[1]:
        raise ValueError(f"Invalid magic: 0x{data[0]:02x}{data[1]:02x}")

    version = data[2]
    if version != PROTOCOL_VERSION:
        raise ValueError(f"Version mismatch: expected {PROTOCOL_VERSION}, got {version}")

    pkt_type = data[3]
    seq = data[4]
    payload_len = struct.unpack_from("<H", data, 5)[0]

    total = HEADER_SIZE + payload_len
    if len(data) < total:
        raise ValueError(f"Incomplete packet: need {total} bytes, got {len(data)}")

    crc_region = data[2 : 7 + payload_len]
    expected_crc = crc8(crc_region)
    actual_crc = data[7 + payload_len]

    if expected_crc != actual_crc:
        raise ValueError(f"CRC mismatch: expected 0x{expected_crc:02x}, got 0x{actual_crc:02x}")

    payload = bytes(data[7 : 7 + payload_len])
    return ConduytPacket(version=version, type=pkt_type, seq=seq, payload=payload)


def make_packet(pkt_type: int, seq: int, payload: bytes = b"") -> ConduytPacket:
    """Create a ConduytPacket ready for encoding."""
    return ConduytPacket(version=PROTOCOL_VERSION, type=pkt_type, seq=seq, payload=payload)

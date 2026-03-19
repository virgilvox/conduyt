"""Wire format tests — cross-validates with C and JS implementations."""

import pytest
from conduyt.core.wire import wire_encode, wire_decode, make_packet, ConduytPacket
from conduyt.core.constants import CMD, EVT, PROTOCOL_VERSION, HEADER_SIZE


def test_ping_encode():
    pkt = make_packet(CMD.PING, 0)
    buf = wire_encode(pkt)
    assert len(buf) == HEADER_SIZE
    assert buf[0] == 0x43  # magic
    assert buf[1] == 0x44
    assert buf[2] == PROTOCOL_VERSION
    assert buf[3] == CMD.PING
    assert buf[4] == 0  # seq


def test_ping_roundtrip():
    original = make_packet(CMD.PING, 7)
    encoded = wire_encode(original)
    decoded = wire_decode(encoded)
    assert decoded.type == CMD.PING
    assert decoded.seq == 7
    assert decoded.payload == b""


def test_pin_write_roundtrip():
    original = make_packet(CMD.PIN_WRITE, 255, bytes([5, 128]))
    encoded = wire_encode(original)
    decoded = wire_decode(encoded)
    assert decoded.type == CMD.PIN_WRITE
    assert decoded.seq == 255
    assert decoded.payload == bytes([5, 128])


def test_large_payload_roundtrip():
    payload = bytes(range(256)) * 2
    original = make_packet(CMD.MOD_CMD, 100, payload)
    encoded = wire_encode(original)
    decoded = wire_decode(encoded)
    assert decoded.payload == payload


def test_incomplete_packet():
    with pytest.raises(ValueError, match="Incomplete"):
        wire_decode(bytes([0x43, 0x44]))


def test_bad_magic():
    with pytest.raises(ValueError, match="Invalid magic"):
        wire_decode(bytes([0x00, 0x00, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00]))


def test_crc_mismatch():
    pkt = make_packet(CMD.PING, 0)
    buf = bytearray(wire_encode(pkt))
    buf[7] ^= 0xFF  # corrupt CRC
    with pytest.raises(ValueError, match="CRC"):
        wire_decode(bytes(buf))


def test_all_packet_types_roundtrip():
    all_types = [getattr(CMD, n) for n in dir(CMD) if not n.startswith("_")]
    all_types += [getattr(EVT, n) for n in dir(EVT) if not n.startswith("_")]

    for pkt_type in all_types:
        pkt = make_packet(pkt_type, 0, bytes([0xAA, 0xBB]))
        encoded = wire_encode(pkt)
        decoded = wire_decode(encoded)
        assert decoded.type == pkt_type
        assert decoded.payload == bytes([0xAA, 0xBB])

"""CRC8 tests — cross-validates with C and JS implementations."""

from conduyt.core.crc8 import crc8


def test_empty_input():
    assert crc8(b"") == 0x00


def test_single_zero():
    assert crc8(bytes([0x00])) == 0x00


def test_single_0x01():
    assert crc8(bytes([0x01])) == 0x31


def test_deterministic():
    data = bytes([0x47, 0x46, 0x01, 0x02])
    assert crc8(data) == crc8(data)


def test_different_data():
    a = crc8(bytes([0x01, 0x02, 0x03]))
    b = crc8(bytes([0x01, 0x02, 0x04]))
    assert a != b


def test_range():
    data = bytes(range(256))
    result = crc8(data)
    assert 0 <= result <= 255

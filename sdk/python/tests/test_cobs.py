"""COBS tests — cross-validates with C and JS implementations."""

from conduyt.core.cobs import cobs_encode, cobs_decode


def test_empty_roundtrip():
    encoded = cobs_encode(b"")
    assert encoded == bytes([0x01])
    decoded = cobs_decode(encoded)
    assert decoded == b""


def test_single_zero():
    data = bytes([0x00])
    encoded = cobs_encode(data)
    decoded = cobs_decode(encoded)
    assert decoded == data


def test_single_nonzero():
    data = bytes([0x42])
    encoded = cobs_encode(data)
    assert encoded == bytes([0x02, 0x42])
    assert cobs_decode(encoded) == data


def test_mixed():
    data = bytes([0x11, 0x22, 0x00, 0x33])
    encoded = cobs_encode(data)
    assert encoded == bytes([0x03, 0x11, 0x22, 0x02, 0x33])
    assert cobs_decode(encoded) == data


def test_no_zeros_in_output():
    data = bytes([0, 1, 2, 0, 3, 0, 0, 4, 5])
    encoded = cobs_encode(data)
    assert 0x00 not in encoded
    assert cobs_decode(encoded) == data


def test_254_nonzero():
    data = bytes(range(1, 255))
    encoded = cobs_encode(data)
    assert cobs_decode(encoded) == data


def test_decode_error_on_zero():
    assert cobs_decode(bytes([0x00, 0x01])) is None


def test_decode_empty():
    assert cobs_decode(b"") is None


def test_all_zeros():
    data = bytes(10)
    encoded = cobs_encode(data)
    assert cobs_decode(encoded) == data

"""ConduytDevice integration tests using MockTransport."""

import asyncio
import struct

import pytest

from conduyt.device import ConduytDevice
from conduyt.transports.mock import MockTransport
from conduyt.core.constants import CMD, EVT, PROTOCOL_VERSION, DS_TYPE
from conduyt.core.wire import wire_encode, wire_decode, make_packet
from conduyt.core.errors import ConduytNAKError, ConduytTimeoutError, ConduytDisconnectedError


def build_hello_resp_payload(
    firmware_name: str = "TestFirmware",
    version: tuple[int, int, int] = (1, 2, 3),
    mcu_id: bytes = b"\x01\x02\x03\x04\x05\x06\x07\x08",
    ota: bool = True,
    pin_caps: list[int] | None = None,
    i2c: int = 1,
    spi: int = 1,
    uart: int = 1,
    max_payload: int = 512,
    modules: list[dict] | None = None,
    datastreams: list[dict] | None = None,
) -> bytes:
    """Build a binary HELLO_RESP payload matching the protocol spec."""
    buf = bytearray()

    # firmware_name: 16-byte fixed string
    name_bytes = firmware_name.encode("utf-8")[:16]
    buf += name_bytes + b"\x00" * (16 - len(name_bytes))

    # version: 3 bytes
    buf += bytes(version)

    # mcu_id: 8 bytes
    buf += mcu_id

    # ota_capable: 1 byte
    buf += bytes([0x01 if ota else 0x00])

    # pins
    if pin_caps is None:
        pin_caps = [0x03, 0x03, 0x0F, 0x0F]  # 4 pins with various capabilities
    buf += bytes([len(pin_caps)])
    buf += bytes(pin_caps)

    # i2c, spi, uart
    buf += bytes([i2c, spi, uart])

    # max_payload: LE uint16
    buf += struct.pack("<H", max_payload)

    # modules
    if modules is None:
        modules = [{"id": 0, "name": "Servo", "ver_major": 1, "ver_minor": 0, "pins": [2]}]
    buf += bytes([len(modules)])
    for mod in modules:
        buf += bytes([mod["id"]])
        mod_name = mod["name"].encode("utf-8")[:8]
        buf += mod_name + b"\x00" * (8 - len(mod_name))
        buf += bytes([mod["ver_major"], mod["ver_minor"]])
        pins = mod.get("pins", [])
        buf += bytes([len(pins)])
        buf += bytes(pins)

    # datastreams
    if datastreams is None:
        datastreams = []
    buf += bytes([len(datastreams)])
    for ds in datastreams:
        ds_name = ds["name"].encode("utf-8")[:16]
        buf += ds_name + b"\x00" * (16 - len(ds_name))
        buf += bytes([ds["type"]])
        ds_unit = ds.get("unit", "").encode("utf-8")[:8]
        buf += ds_unit + b"\x00" * (8 - len(ds_unit))
        buf += bytes([0x01 if ds.get("writable", False) else 0x00])
        buf += bytes([ds.get("pin_ref", 0xFF)])
        buf += bytes([0x01 if ds.get("retain", False) else 0x00])

    return bytes(buf)


def auto_respond(transport: MockTransport, overrides: dict | None = None):
    """Patch transport.send to auto-respond with correct packet types.

    overrides: dict mapping CMD type -> callable(seq, payload) -> (resp_type, resp_payload)
    """
    if overrides is None:
        overrides = {}

    hello_payload = build_hello_resp_payload()
    original_send = transport.send

    async def patched_send(packet: bytes):
        await original_send(packet)
        decoded = wire_decode(packet)
        seq = decoded.seq

        if decoded.type in overrides:
            resp_type, resp_payload = overrides[decoded.type](seq, decoded.payload)
        elif decoded.type == CMD.HELLO:
            resp_type, resp_payload = EVT.HELLO_RESP, hello_payload
        elif decoded.type == CMD.PING:
            resp_type, resp_payload = EVT.PONG, b""
        elif decoded.type == CMD.PIN_READ:
            resp_type, resp_payload = EVT.PIN_READ_RESP, bytes([decoded.payload[0], 0x00, 0x02])
        else:
            resp_type, resp_payload = EVT.ACK, b""

        resp_pkt = make_packet(resp_type, seq, resp_payload)
        transport.inject(wire_encode(resp_pkt))

    transport.send = patched_send


@pytest.mark.asyncio
async def test_connect_parses_hello_resp():
    transport = MockTransport()
    auto_respond(transport)
    device = ConduytDevice(transport)
    hello = await device.connect()

    assert hello.firmware_name == "TestFirmware"
    assert hello.firmware_version == (1, 2, 3)
    assert hello.ota_capable is True
    assert len(hello.pins) == 4
    assert hello.pins[0].capabilities == 0x03
    assert hello.i2c_buses == 1
    assert hello.spi_buses == 1
    assert hello.uart_count == 1
    assert hello.max_payload == 512
    assert len(hello.modules) == 1
    assert hello.modules[0].name == "Servo"

    await device.disconnect()


@pytest.mark.asyncio
async def test_ping_pong():
    transport = MockTransport()
    auto_respond(transport)
    device = ConduytDevice(transport)
    await device.connect()

    await device.ping()

    # Verify a PING was sent (second packet, after HELLO)
    sent = wire_decode(transport.sent_packets[1])
    assert sent.type == CMD.PING

    await device.disconnect()


@pytest.mark.asyncio
async def test_pin_mode():
    transport = MockTransport()
    auto_respond(transport)
    device = ConduytDevice(transport)
    await device.connect()

    await device.pin(5).mode("output")

    sent = wire_decode(transport.sent_packets[-1])
    assert sent.type == CMD.PIN_MODE
    assert sent.payload[0] == 5   # pin number
    assert sent.payload[1] == 1   # output mode

    await device.disconnect()


@pytest.mark.asyncio
async def test_pin_write():
    transport = MockTransport()
    auto_respond(transport)
    device = ConduytDevice(transport)
    await device.connect()

    await device.pin(3).write(128)

    sent = wire_decode(transport.sent_packets[-1])
    assert sent.type == CMD.PIN_WRITE
    assert sent.payload[0] == 3    # pin number
    assert sent.payload[1] == 128  # value

    await device.disconnect()


@pytest.mark.asyncio
async def test_pin_read():
    transport = MockTransport()

    def pin_read_response(seq, payload):
        # Return pin number + uint16 LE value 512 (0x0200)
        return EVT.PIN_READ_RESP, bytes([payload[0], 0x00, 0x02])

    auto_respond(transport, {CMD.PIN_READ: pin_read_response})
    device = ConduytDevice(transport)
    await device.connect()

    value = await device.pin(7).read()
    assert value == 512

    sent = wire_decode(transport.sent_packets[-1])
    assert sent.type == CMD.PIN_READ
    assert sent.payload[0] == 7

    await device.disconnect()


@pytest.mark.asyncio
async def test_nak_raises_conduyt_nak_error():
    transport = MockTransport()

    def always_nak(seq, payload):
        return EVT.NAK, bytes([0x04])  # INVALID_PIN

    auto_respond(transport, {CMD.PIN_WRITE: always_nak})
    device = ConduytDevice(transport)
    await device.connect()

    with pytest.raises(ConduytNAKError) as exc_info:
        await device.pin(99).write(0)

    assert exc_info.value.code == 0x04

    await device.disconnect()


@pytest.mark.asyncio
async def test_disconnected_send_raises():
    transport = MockTransport()
    device = ConduytDevice(transport)

    with pytest.raises(ConduytDisconnectedError):
        await device.ping()


@pytest.mark.asyncio
async def test_seq_increments():
    transport = MockTransport()
    auto_respond(transport)
    device = ConduytDevice(transport)
    await device.connect()

    await device.ping()
    await device.ping()
    await device.ping()

    # Packets: HELLO(seq=0), PING(seq=1), PING(seq=2), PING(seq=3)
    seqs = [wire_decode(p).seq for p in transport.sent_packets]
    assert seqs == [0, 1, 2, 3]

    await device.disconnect()


@pytest.mark.asyncio
async def test_reset_sends_reset_command():
    transport = MockTransport()
    auto_respond(transport)
    device = ConduytDevice(transport)
    await device.connect()

    await device.reset()

    sent = wire_decode(transport.sent_packets[-1])
    assert sent.type == CMD.RESET

    await device.disconnect()


@pytest.mark.asyncio
async def test_pin_mode_wire_bytes_spec_compliant():
    """Decode the actual sent packet and verify the COMPLETE payload is spec-compliant."""
    transport = MockTransport()
    auto_respond(transport)
    device = ConduytDevice(transport)
    await device.connect()

    await device.pin(13).mode("output")

    sent = wire_decode(transport.sent_packets[-1])
    assert sent.type == CMD.PIN_MODE
    assert sent.payload == bytes([13, 0x01])  # pin=13, OUTPUT=0x01

    await device.disconnect()


@pytest.mark.asyncio
async def test_pin_write_value_zero():
    """Verify PIN_WRITE with value=0 sends correct payload [pin, 0]."""
    transport = MockTransport()
    auto_respond(transport)
    device = ConduytDevice(transport)
    await device.connect()

    await device.pin(13).write(0)

    sent = wire_decode(transport.sent_packets[-1])
    assert sent.type == CMD.PIN_WRITE
    assert sent.payload == bytes([13, 0])

    await device.disconnect()


@pytest.mark.asyncio
async def test_pin_read_short_response_returns_zero():
    """A PIN_READ_RESP with only 1 byte of payload should return 0 gracefully."""
    transport = MockTransport()

    def short_pin_read_response(seq, payload):
        # Only 1 byte — less than the 3 bytes needed for pin + uint16 LE
        return EVT.PIN_READ_RESP, bytes([payload[0]])

    auto_respond(transport, {CMD.PIN_READ: short_pin_read_response})
    device = ConduytDevice(transport)
    await device.connect()

    value = await device.pin(7).read()
    assert value == 0

    await device.disconnect()


@pytest.mark.asyncio
async def test_timeout_raises_conduyt_timeout_error():
    """A command with no response should raise ConduytTimeoutError."""
    transport = MockTransport()
    # Only auto-respond to HELLO so connect() works, but NOT to PING
    hello_payload = build_hello_resp_payload()
    original_send = transport.send

    async def only_hello_respond(packet: bytes):
        await original_send(packet)
        decoded = wire_decode(packet)
        if decoded.type == CMD.HELLO:
            resp_pkt = make_packet(EVT.HELLO_RESP, decoded.seq, hello_payload)
            transport.inject(wire_encode(resp_pkt))
        # All other commands get NO response — will timeout

    transport.send = only_hello_respond

    device = ConduytDevice(transport, timeout_ms=50)
    await device.connect()

    with pytest.raises(ConduytTimeoutError) as exc_info:
        await device.ping()

    assert exc_info.value.timeout_ms == 50

    await device.disconnect()

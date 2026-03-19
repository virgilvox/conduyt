"""Tests for parse_hello_resp — binary HELLO_RESP payload parsing."""

import struct

import pytest

from conduyt.hello import parse_hello_resp, HelloResp, PinCapability, ModuleDescriptor, DatastreamDescriptor
from conduyt.core.constants import DS_TYPE


def _fixed_string(s: str, length: int) -> bytes:
    """Encode a string into a fixed-length null-padded field."""
    encoded = s.encode("utf-8")[:length]
    return encoded + b"\x00" * (length - len(encoded))


def _build_payload(
    firmware_name: str = "TestBoard",
    version: tuple[int, int, int] = (2, 0, 1),
    mcu_id: bytes = b"\xAA\xBB\xCC\xDD\xEE\xFF\x01\x02",
    ota: bool = True,
    pin_caps: list[int] | None = None,
    i2c: int = 1,
    spi: int = 0,
    uart: int = 2,
    max_payload: int = 256,
    modules: list[dict] | None = None,
    datastreams: list[dict] | None = None,
) -> bytes:
    buf = bytearray()

    buf += _fixed_string(firmware_name, 16)
    buf += bytes(version)
    buf += mcu_id
    buf += bytes([0x01 if ota else 0x00])

    if pin_caps is None:
        pin_caps = [0x03, 0x0F]
    buf += bytes([len(pin_caps)])
    buf += bytes(pin_caps)

    buf += bytes([i2c, spi, uart])
    buf += struct.pack("<H", max_payload)

    if modules is None:
        modules = []
    buf += bytes([len(modules)])
    for mod in modules:
        buf += bytes([mod["id"]])
        buf += _fixed_string(mod["name"], 8)
        buf += bytes([mod["ver_major"], mod["ver_minor"]])
        pins = mod.get("pins", [])
        buf += bytes([len(pins)])
        buf += bytes(pins)

    if datastreams is None:
        datastreams = []
    buf += bytes([len(datastreams)])
    for ds in datastreams:
        buf += _fixed_string(ds["name"], 16)
        buf += bytes([ds["type"]])
        buf += _fixed_string(ds.get("unit", ""), 8)
        buf += bytes([0x01 if ds.get("writable") else 0x00])
        buf += bytes([ds.get("pin_ref", 0xFF)])
        buf += bytes([0x01 if ds.get("retain") else 0x00])

    return bytes(buf)


class TestParseHelloResp:
    def test_firmware_name(self):
        payload = _build_payload(firmware_name="MyBoard")
        resp = parse_hello_resp(payload)
        assert resp.firmware_name == "MyBoard"

    def test_firmware_name_full_16_bytes(self):
        payload = _build_payload(firmware_name="ExactlySixteen!")
        resp = parse_hello_resp(payload)
        assert resp.firmware_name == "ExactlySixteen!"

    def test_firmware_version(self):
        payload = _build_payload(version=(3, 14, 7))
        resp = parse_hello_resp(payload)
        assert resp.firmware_version == (3, 14, 7)

    def test_mcu_id(self):
        mcu = b"\x01\x02\x03\x04\x05\x06\x07\x08"
        payload = _build_payload(mcu_id=mcu)
        resp = parse_hello_resp(payload)
        assert resp.mcu_id == mcu

    def test_ota_capable_true(self):
        payload = _build_payload(ota=True)
        resp = parse_hello_resp(payload)
        assert resp.ota_capable is True

    def test_ota_capable_false(self):
        payload = _build_payload(ota=False)
        resp = parse_hello_resp(payload)
        assert resp.ota_capable is False

    def test_pin_count_and_capabilities(self):
        caps = [0x03, 0x0F, 0xFF, 0x01]
        payload = _build_payload(pin_caps=caps)
        resp = parse_hello_resp(payload)

        assert len(resp.pins) == 4
        assert resp.pins[0].pin == 0
        assert resp.pins[0].capabilities == 0x03
        assert resp.pins[1].capabilities == 0x0F
        assert resp.pins[2].capabilities == 0xFF
        assert resp.pins[3].pin == 3
        assert resp.pins[3].capabilities == 0x01

    def test_bus_counts(self):
        payload = _build_payload(i2c=2, spi=3, uart=1)
        resp = parse_hello_resp(payload)
        assert resp.i2c_buses == 2
        assert resp.spi_buses == 3
        assert resp.uart_count == 1

    def test_max_payload(self):
        payload = _build_payload(max_payload=1024)
        resp = parse_hello_resp(payload)
        assert resp.max_payload == 1024

    def test_max_payload_large(self):
        payload = _build_payload(max_payload=65535)
        resp = parse_hello_resp(payload)
        assert resp.max_payload == 65535

    def test_single_module(self):
        modules = [{"id": 0, "name": "Servo", "ver_major": 1, "ver_minor": 2, "pins": [9]}]
        payload = _build_payload(modules=modules)
        resp = parse_hello_resp(payload)

        assert len(resp.modules) == 1
        mod = resp.modules[0]
        assert mod.module_id == 0
        assert mod.name == "Servo"
        assert mod.version_major == 1
        assert mod.version_minor == 2
        assert mod.pins == [9]

    def test_multiple_modules_with_pins(self):
        modules = [
            {"id": 0, "name": "Servo", "ver_major": 1, "ver_minor": 0, "pins": [2, 3]},
            {"id": 1, "name": "NeoPixl", "ver_major": 2, "ver_minor": 1, "pins": [6]},
            {"id": 2, "name": "DHT", "ver_major": 1, "ver_minor": 0, "pins": []},
        ]
        payload = _build_payload(modules=modules)
        resp = parse_hello_resp(payload)

        assert len(resp.modules) == 3
        assert resp.modules[0].name == "Servo"
        assert resp.modules[0].pins == [2, 3]
        assert resp.modules[1].name == "NeoPixl"
        assert resp.modules[1].pins == [6]
        assert resp.modules[2].name == "DHT"
        assert resp.modules[2].pins == []

    def test_single_datastream(self):
        datastreams = [{
            "name": "temperature",
            "type": DS_TYPE.FLOAT32,
            "unit": "C",
            "writable": False,
            "pin_ref": 4,
            "retain": True,
        }]
        payload = _build_payload(datastreams=datastreams)
        resp = parse_hello_resp(payload)

        assert len(resp.datastreams) == 1
        ds = resp.datastreams[0]
        assert ds.index == 0
        assert ds.name == "temperature"
        assert ds.type == DS_TYPE.FLOAT32
        assert ds.unit == "C"
        assert ds.writable is False
        assert ds.pin_ref == 4
        assert ds.retain is True

    def test_multiple_datastreams(self):
        datastreams = [
            {"name": "temp", "type": DS_TYPE.FLOAT32, "unit": "C",
             "writable": False, "pin_ref": 4, "retain": True},
            {"name": "led_state", "type": DS_TYPE.BOOL, "unit": "",
             "writable": True, "pin_ref": 13, "retain": False},
            {"name": "counter", "type": DS_TYPE.INT32, "unit": "cnt",
             "writable": True, "pin_ref": 0xFF, "retain": True},
        ]
        payload = _build_payload(datastreams=datastreams)
        resp = parse_hello_resp(payload)

        assert len(resp.datastreams) == 3
        assert resp.datastreams[0].name == "temp"
        assert resp.datastreams[0].writable is False
        assert resp.datastreams[1].name == "led_state"
        assert resp.datastreams[1].type == DS_TYPE.BOOL
        assert resp.datastreams[1].writable is True
        assert resp.datastreams[1].pin_ref == 13
        assert resp.datastreams[2].name == "counter"
        assert resp.datastreams[2].retain is True


class TestParseHelloRespEdgeCases:
    def test_minimal_payload(self):
        """Zero pins, zero modules, zero datastreams."""
        payload = _build_payload(pin_caps=[], modules=[], datastreams=[])
        resp = parse_hello_resp(payload)

        assert resp.firmware_name == "TestBoard"
        assert len(resp.pins) == 0
        assert len(resp.modules) == 0
        assert len(resp.datastreams) == 0

    def test_many_pins(self):
        caps = [0x03] * 40
        payload = _build_payload(pin_caps=caps)
        resp = parse_hello_resp(payload)
        assert len(resp.pins) == 40
        assert all(p.capabilities == 0x03 for p in resp.pins)

    def test_module_with_no_pins(self):
        modules = [{"id": 5, "name": "PID", "ver_major": 0, "ver_minor": 1, "pins": []}]
        payload = _build_payload(modules=modules)
        resp = parse_hello_resp(payload)
        assert resp.modules[0].pins == []
        assert resp.modules[0].module_id == 5

    def test_datastream_all_types(self):
        """Verify various DS_TYPE values parse correctly."""
        types = [DS_TYPE.BOOL, DS_TYPE.INT8, DS_TYPE.UINT8, DS_TYPE.UINT16,
                 DS_TYPE.INT32, DS_TYPE.FLOAT32, DS_TYPE.STRING, DS_TYPE.BYTES]
        datastreams = [
            {"name": f"ds{i}", "type": t, "unit": "", "writable": False,
             "pin_ref": 0xFF, "retain": False}
            for i, t in enumerate(types)
        ]
        payload = _build_payload(datastreams=datastreams)
        resp = parse_hello_resp(payload)
        assert len(resp.datastreams) == len(types)
        for i, t in enumerate(types):
            assert resp.datastreams[i].type == t

    def test_return_type(self):
        payload = _build_payload()
        resp = parse_hello_resp(payload)
        assert isinstance(resp, HelloResp)
        for pin in resp.pins:
            assert isinstance(pin, PinCapability)


class TestParseHelloRespErrors:
    def test_empty_payload_raises(self):
        """An empty payload should raise an error during parsing."""
        with pytest.raises((IndexError, struct.error)):
            parse_hello_resp(b"")

    def test_truncated_payload_raises(self):
        """A payload too short to contain the fixed header fields should raise."""
        with pytest.raises((IndexError, struct.error)):
            parse_hello_resp(b"\x00" * 5)

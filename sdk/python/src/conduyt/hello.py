"""CONDUYT HELLO_RESP Parser — decode binary capability payload"""

from __future__ import annotations

import struct
from dataclasses import dataclass, field


@dataclass
class PinCapability:
    pin: int
    capabilities: int


@dataclass
class ModuleDescriptor:
    module_id: int
    name: str
    version_major: int
    version_minor: int
    pins: list[int] = field(default_factory=list)


@dataclass
class DatastreamDescriptor:
    index: int
    name: str
    type: int
    unit: str
    writable: bool
    pin_ref: int
    retain: bool


@dataclass
class HelloResp:
    firmware_name: str
    firmware_version: tuple[int, int, int]
    mcu_id: bytes
    ota_capable: bool
    pins: list[PinCapability]
    i2c_buses: int
    spi_buses: int
    uart_count: int
    max_payload: int
    modules: list[ModuleDescriptor]
    datastreams: list[DatastreamDescriptor]


def _read_fixed_string(data: bytes, offset: int, length: int) -> tuple[str, int]:
    raw = data[offset:offset + length]
    end = raw.find(0)
    if end == -1:
        end = length
    return raw[:end].decode("utf-8", errors="replace"), offset + length


def parse_hello_resp(payload: bytes) -> HelloResp:
    """Parse HELLO_RESP binary payload into a typed HelloResp object."""
    pos = 0

    firmware_name, pos = _read_fixed_string(payload, pos, 16)

    v_major = payload[pos]; pos += 1
    v_minor = payload[pos]; pos += 1
    v_patch = payload[pos]; pos += 1

    mcu_id = payload[pos:pos + 8]; pos += 8
    ota_capable = payload[pos] == 0x01; pos += 1

    pin_count = payload[pos]; pos += 1
    pins: list[PinCapability] = []
    for i in range(pin_count):
        pins.append(PinCapability(pin=i, capabilities=payload[pos]))
        pos += 1

    i2c_buses = payload[pos]; pos += 1
    spi_buses = payload[pos]; pos += 1
    uart_count = payload[pos]; pos += 1

    max_payload = struct.unpack_from("<H", payload, pos)[0]; pos += 2

    module_count = payload[pos]; pos += 1
    modules: list[ModuleDescriptor] = []
    for _ in range(module_count):
        mod_id = payload[pos]; pos += 1
        mod_name, pos = _read_fixed_string(payload, pos, 8)
        ver_major = payload[pos]; pos += 1
        ver_minor = payload[pos]; pos += 1
        mod_pin_count = payload[pos]; pos += 1
        mod_pins = []
        for _ in range(mod_pin_count):
            mod_pins.append(payload[pos]); pos += 1
        modules.append(ModuleDescriptor(
            module_id=mod_id, name=mod_name,
            version_major=ver_major, version_minor=ver_minor, pins=mod_pins,
        ))

    ds_count = payload[pos]; pos += 1
    datastreams: list[DatastreamDescriptor] = []
    for i in range(ds_count):
        ds_name, pos = _read_fixed_string(payload, pos, 16)
        ds_type = payload[pos]; pos += 1
        ds_unit, pos = _read_fixed_string(payload, pos, 8)
        writable = payload[pos] == 0x01; pos += 1
        pin_ref = payload[pos]; pos += 1
        retain = payload[pos] == 0x01; pos += 1
        datastreams.append(DatastreamDescriptor(
            index=i, name=ds_name, type=ds_type, unit=ds_unit,
            writable=writable, pin_ref=pin_ref, retain=retain,
        ))

    return HelloResp(
        firmware_name=firmware_name,
        firmware_version=(v_major, v_minor, v_patch),
        mcu_id=bytes(mcu_id),
        ota_capable=ota_capable,
        pins=pins,
        i2c_buses=i2c_buses,
        spi_buses=spi_buses,
        uart_count=uart_count,
        max_payload=max_payload,
        modules=modules,
        datastreams=datastreams,
    )

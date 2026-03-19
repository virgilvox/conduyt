---
title: HELLO_RESP
description: Binary layout of the CONDUYT capability handshake
---

# HELLO_RESP

The HELLO_RESP payload is the device's self-description. It's sent once on connection and tells the host everything it needs to know about the hardware.

## Binary Layout

| Offset | Field | Size | Description |
|---|---|---|---|
| 0 | firmware_name | 16 | Null-padded UTF-8 string |
| 16 | version_major | 1 | Firmware major version |
| 17 | version_minor | 1 | Firmware minor version |
| 18 | version_patch | 1 | Firmware patch version |
| 19 | mcu_id | 8 | Unique MCU identifier (or zeros) |
| 27 | ota_capable | 1 | 0x01 if OTA firmware update is supported |
| 28 | pin_count | 1 | Number of GPIO pins (N) |
| 29 | pins[] | N×1 | Per-pin capability bitmask |
| 29+N | i2c_buses | 1 | Number of I2C buses |
| 30+N | spi_buses | 1 | Number of SPI buses |
| 31+N | uart_count | 1 | Number of UARTs |
| 32+N | max_payload | 2 | Max payload size (LE uint16) |
| 34+N | module_count | 1 | Number of loaded modules (M) |
| 35+N | modules[] | var | Per-module descriptors |
| var | ds_count | 1 | Number of datastreams (D) |
| var | datastreams[] | var | Per-datastream descriptors |

## Pin Capability Bitmask

| Bit | Capability |
|---|---|
| 0 | DIGITAL_IN |
| 1 | DIGITAL_OUT |
| 2 | PWM_OUT |
| 3 | ANALOG_IN |
| 4 | I2C_SDA |
| 5 | I2C_SCL |
| 6 | SPI |
| 7 | INTERRUPT |

## Module Descriptor

| Field | Size | Description |
|---|---|---|
| module_id | 1 | Index in the modules array |
| name | 8 | Null-padded name (e.g., "servo") |
| version_major | 1 | Module major version |
| version_minor | 1 | Module minor version |
| pin_count | 1 | Number of claimed pins |
| pins[] | pin_count | Physical pin numbers |

## Datastream Descriptor

| Field | Size | Description |
|---|---|---|
| name | 16 | Null-padded name |
| type | 1 | CONDUYT_TYPE_* code |
| unit | 8 | Null-padded unit string |
| writable | 1 | 0x01 if host can write |
| pin_ref | 1 | Associated pin (0xFF if none) |
| retain | 1 | 0x01 if value is retained |

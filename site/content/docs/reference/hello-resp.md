---
title: HELLO_RESP
description: Binary layout of the CONDUYT capability handshake
---

# HELLO_RESP

The HELLO_RESP payload (type `0x81`) is the device's self-description. The host sends HELLO (`0x02`), and the device responds with this binary structure containing hardware capabilities, loaded modules, and declared datastreams.

## Binary Layout

| Offset | Field | Size | Description |
|---|---|---|---|
| 0 | firmware_name | 16 | Null-padded UTF-8 string |
| 16 | version_major | 1 | Firmware major version |
| 17 | version_minor | 1 | Firmware minor version |
| 18 | version_patch | 1 | Firmware patch version |
| 19 | mcu_id | 8 | Factory-immutable MCU identifier. RA4M1 uses `R_BSP_UniqueIdGet`, RP2040 uses the flash JEDEC RUID, ESP32 uses the eFuse MAC, nRF52 uses `FICR.DEVICEID`, Teensy uses Kinetis `SIM_UID` / iMX RT `OCOTP_CFG`. Zero-padded to 8 bytes; zero on classic AVR without provisioning. |
| 27 | ota_capable | 1 | 0x01 if OTA supported |
| 28 | pin_count | 1 | Number of GPIO pins (N) |
| 29 | pins[] | Nx1 | Per-pin capability bitmask |
| 29+N | i2c_buses | 1 | Number of I2C buses |
| 30+N | spi_buses | 1 | Number of SPI buses |
| 31+N | uart_count | 1 | Number of UARTs |
| 32+N | max_payload | 2 | Max payload size (LE uint16) |
| 34+N | module_count | 1 | Number of loaded modules (M) |
| 35+N | modules[] | var | Per-module descriptors |
| var | ds_count | 1 | Number of datastreams (D) |
| var | datastreams[] | var | Per-datastream descriptors |

## Pin Capability Bitmask

Each byte in `pins[]` is a bitmask of supported modes for that pin.

| Bit | Capability | Constant |
|---|---|---|
| 0 | DIGITAL_IN | `CONDUYT_PIN_CAP_DIGITAL_IN` |
| 1 | DIGITAL_OUT | `CONDUYT_PIN_CAP_DIGITAL_OUT` |
| 2 | PWM_OUT | `CONDUYT_PIN_CAP_PWM_OUT` |
| 3 | ANALOG_IN | `CONDUYT_PIN_CAP_ANALOG_IN` |
| 4 | I2C_SDA | `CONDUYT_PIN_CAP_I2C_SDA` |
| 5 | I2C_SCL | `CONDUYT_PIN_CAP_I2C_SCL` |
| 6 | SPI | `CONDUYT_PIN_CAP_SPI` |
| 7 | INTERRUPT | `CONDUYT_PIN_CAP_INTERRUPT` |

Example: a pin with bitmask `0x0F` (bits 0-3 set) supports digital input, digital output, PWM, and analog input.

## Module Descriptor

Each entry in `modules[]` follows this layout:

| Field | Size | Description |
|---|---|---|
| module_id | 1 | Index in the modules array |
| name | 8 | Null-padded name (e.g., "servo") |
| version_major | 1 | Module major version |
| version_minor | 1 | Module minor version |
| pin_count | 1 | Number of claimed pins |
| pins[] | pin_count | Physical pin numbers |

Total size per module: 12 + pin_count bytes.

## Datastream Descriptor

Each entry in `datastreams[]` follows this layout:

| Field | Size | Description |
|---|---|---|
| name | 16 | Null-padded name |
| type | 1 | `CONDUYT_TYPE_*` code (see [Datastream Types](/docs/reference/datastream-types)) |
| unit | 8 | Null-padded unit string (e.g., "celsius") |
| writable | 1 | 0x01 if host can write |
| pin_ref | 1 | Associated pin (0xFF if none) |
| retain | 1 | 0x01 if value is retained |

Total size per datastream: 28 bytes.

### Worked Example

A device named "MyBoard" running firmware 1.0.0, with 3 GPIO pins and one servo module. No OTA, no I2C/SPI/UART buses, no datastreams.

```
Offset  Hex                                              Field
------  -----------------------------------------------  -----
00-0F   4D 79 42 6F 61 72 64 00 00 00 00 00 00 00 00 00 firmware_name = "MyBoard\0\0\0\0\0\0\0\0\0"
10      01                                               version_major = 1
11      00                                               version_minor = 0
12      00                                               version_patch = 0
13-1A   00 00 00 00 00 00 00 00                          mcu_id = all zeros
1B      00                                               ota_capable = 0 (no OTA)
1C      03                                               pin_count = 3
1D      0F                                               pin[0] caps = 0x0F (DIN, DOUT, PWM, AIN)
1E      03                                               pin[1] caps = 0x03 (DIN, DOUT)
1F      03                                               pin[13] caps = 0x03 (DIN, DOUT)
20      00                                               i2c_buses = 0
21      00                                               spi_buses = 0
22      00                                               uart_count = 0
23-24   80 00                                            max_payload = 128 (0x0080 LE)
25      01                                               module_count = 1
-- module 0 --
26      00                                               module_id = 0
27-2E   73 65 72 76 6F 00 00 00                          name = "servo\0\0\0"
2F      01                                               version_major = 1
30      00                                               version_minor = 0
31      01                                               pin_count = 1
32      09                                               pins[0] = pin 9
-- end modules --
33      00                                               ds_count = 0
```

Parsing walkthrough:

1. Read 16 bytes at offset 0x00: firmware name is "MyBoard" (remaining bytes are `0x00` padding).
2. Read 3 bytes at 0x10-0x12: firmware version 1.0.0.
3. Read 8 bytes at 0x13-0x1A: MCU ID. The walkthrough is contrived (all zeros); real firmware fills this from the silicon's factory unique-ID register — see the field reference above for the per-MCU source.
4. Read 1 byte at 0x1B: OTA not supported.
5. Read 1 byte at 0x1C: 3 pins declared. Read the next 3 bytes as pin capability bitmasks. Pin 0 has `0x0F` (digital in, digital out, PWM, analog in). Pins 1 and 13 each have `0x03` (digital in, digital out).
6. Read bus counts at 0x20-0x22: 0 I2C, 0 SPI, 0 UART.
7. Read 2 bytes at 0x23-0x24: max payload is 128 bytes (`0x80 0x00` little-endian = 128).
8. Read 1 byte at 0x25: 1 module. Parse the module descriptor starting at 0x26: id=0, name="servo", version 1.0, claims 1 pin (pin 9).
9. Read 1 byte at 0x33: 0 datastreams. Parsing is complete.

Total HELLO_RESP payload size for this device: 52 bytes.

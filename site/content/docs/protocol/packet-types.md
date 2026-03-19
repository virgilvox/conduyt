---
title: Packet Types
description: Complete table of CONDUYT command and event packet types
---

# Packet Types

Every CONDUYT packet has a 1-byte type code in the header. Commands flow host → device, events flow device → host.

## Commands (Host → Device)

| Code | Name | Payload | Response |
|---|---|---|---|
| `0x01` | PING | — | PONG |
| `0x02` | HELLO | — | HELLO_RESP |
| `0x10` | PIN_MODE | pin(u8) + mode(u8) | ACK |
| `0x11` | PIN_WRITE | pin(u8) + value(u8) [+ mode(u8)] | ACK |
| `0x12` | PIN_READ | pin(u8) [+ mode(u8)] | PIN_READ_RESP |
| `0x13` | PIN_SUBSCRIBE | pin(u8) + mode(u8) + interval_ms(u16) [+ threshold(u16)] | ACK |
| `0x14` | PIN_UNSUBSCRIBE | pin(u8) | ACK |
| `0x20` | I2C_WRITE | addr(u8) + data(N) | ACK |
| `0x21` | I2C_READ | addr(u8) + count(u8) | I2C_READ_RESP |
| `0x22` | I2C_READ_REG | addr(u8) + reg(u8) + count(u8) | I2C_READ_RESP |
| `0x30` | SPI_XFER | cs_pin(u8) + data(N) | SPI_XFER_RESP |
| `0x40` | MOD_CMD | module_id(u8) + cmd(u8) + payload(N) | ACK or MOD_RESP |
| `0x50` | STREAM_START | pin_mask(u16) + rate_hz(u16) | ACK |
| `0x51` | STREAM_STOP | — | ACK |
| `0x60` | DS_WRITE | ds_index(u8) + value(N) | ACK |
| `0x61` | DS_READ | ds_index(u8) | DS_READ_RESP |
| `0x62` | DS_SUBSCRIBE | ds_index(u8) + interval_ms(u16) | ACK |
| `0x70` | OTA_BEGIN | total_bytes(u32) + sha256(32) | ACK |
| `0x71` | OTA_CHUNK | offset(u32) + data(N) | ACK |
| `0x72` | OTA_FINALIZE | — | ACK (then reboot) |
| `0xF0` | RESET | — | ACK |

## Events (Device → Host)

| Code | Name | Payload | Trigger |
|---|---|---|---|
| `0x80` | PONG | — | Response to PING |
| `0x81` | HELLO_RESP | capability binary | Response to HELLO |
| `0x82` | ACK | — | Command success |
| `0x83` | NAK | error_code(u8) | Command failure |
| `0x90` | PIN_EVENT | pin(u8) + value(u16) | Subscription trigger |
| `0x91` | PIN_READ_RESP | pin(u8) + value(u16) | Response to PIN_READ |
| `0xA0` | I2C_READ_RESP | data(N) | Response to I2C_READ |
| `0xB0` | SPI_XFER_RESP | data(N) | Response to SPI_XFER |
| `0xC0` | MOD_EVENT | module_id(u8) + event_code(u8) + data(N) | Unsolicited module event |
| `0xC1` | MOD_RESP | module_id(u8) + data(N) | Response to MOD_CMD |
| `0xD0` | STREAM_DATA | values(N×u16) | Streaming sample |
| `0xD1` | DS_EVENT | ds_index(u8) + value(N) | Datastream push |
| `0xD2` | DS_READ_RESP | ds_index(u8) + value(N) | Response to DS_READ |
| `0xE0` | LOG | string(N) | Debug log message |
| `0xFF` | FATAL | string(N) | Unrecoverable error |

## Sequence Numbers

Every command packet carries a `seq` byte (0–255, wrapping). The device echoes `seq` in its response (ACK, NAK, or typed response). This allows the host to correlate multiple in-flight commands.

Unsolicited events (PIN_EVENT, MOD_EVENT, DS_EVENT, STREAM_DATA, LOG, FATAL) use `seq = 0`.

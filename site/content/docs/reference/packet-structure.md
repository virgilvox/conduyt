---
title: Packet Structure
description: CONDUYT wire format, binary packet layout
---

# Packet Structure

Every CONDUYT packet follows a fixed 8-byte header plus variable-length payload.

## Frame Layout

```
[0-1]   MAGIC   0x43 0x44
[2]     VER     0x02
[3]     TYPE    command or event byte
[4]     SEQ     0-255 rolling
[5-6]   LEN     payload length, little-endian uint16
[7..N]  PAYLOAD variable length
[7+N]   CRC8    over bytes [2..6+N]
```

Total overhead: 8 bytes (MAGIC(2) + VER(1) + TYPE(1) + SEQ(1) + LEN(2) + CRC8(1)).

### Notation

The following type notation is used throughout the reference docs:

| Symbol | Meaning |
|---|---|
| `u8` | Unsigned 8-bit integer (1 byte) |
| `u16` | Unsigned 16-bit integer (2 bytes, little-endian) |
| `i32` | Signed 32-bit integer (4 bytes, little-endian) |
| `f32` | 32-bit IEEE 754 float (4 bytes, little-endian) |
| `N` | Variable length (remaining bytes in payload) |
| `LE` | Little-endian byte order |

All multi-byte integers are transmitted least-significant byte first (little-endian).

## Field Definitions

| Field | Size | Description |
|---|---|---|
| MAGIC | 2 bytes | `0x43 0x44` ("CD"). Catches misaligned reads on serial streams. |
| VER | 1 byte | Protocol version. Currently `0x02`. v0.1 (`0x01`) shipped a corrupted CRC8 lookup table at indices `0xE0..0xFF`; v0.2 ships the canonical table generated from the polynomial. v0.2 hosts must reject v0.1 packets — re-flash old firmware. |
| TYPE | 1 byte | Command (host to device) or event (device to host) type. See [Packet Types](/docs/reference/packet-types). |
| SEQ | 1 byte | Rolling sequence 0 to 255. Host increments per command. Device echoes in response. |
| LEN | 2 bytes | Payload length, little-endian uint16. Max capped at device's `max_payload`. |
| PAYLOAD | N bytes | Type-specific data. Zero-length for PING, RESET, etc. |
| CRC8 | 1 byte | CRC8 over bytes from VER through end of PAYLOAD: `crc8(buf[2..7+payloadLen])`. |

### Worked Example

A PIN_WRITE packet (type `0x11`) that sets pin 13 to HIGH:

```
43 44 02 11 01 02 00 0D 01 XX
```

Byte-by-byte breakdown:

| Offset | Bytes | Field | Value |
|---|---|---|---|
| 0-1 | `43 44` | MAGIC | "CD" |
| 2 | `02` | VER | Protocol version 2 |
| 3 | `11` | TYPE | PIN_WRITE (0x11) |
| 4 | `01` | SEQ | Sequence number 1 |
| 5-6 | `02 00` | LEN | 2 bytes payload (little-endian) |
| 7 | `0D` | PAYLOAD[0] | Pin 13 |
| 8 | `01` | PAYLOAD[1] | Value 1 (HIGH) |
| 9 | `XX` | CRC8 | CRC8 over bytes 2-8: `[02 11 01 02 00 0D 01]` |

The CRC8 is computed using Dallas/Maxim polynomial `0x31` over VER through end of PAYLOAD (7 bytes in this case). `XX` represents the computed checksum.

Total: 10 bytes on the wire (8 header + 2 payload). On serial transports, COBS framing adds 1-2 bytes of overhead plus a `0x00` delimiter byte.

## CRC8

The checksum covers VER(1) + TYPE(1) + SEQ(1) + LEN(2) + PAYLOAD(N). That is, bytes `[2..6+N]` in the packet buffer.

- Polynomial: Dallas/Maxim `0x31`
- Init value: `0x00`
- Input/output reflection: none

```c
uint8_t crc8(const uint8_t *data, size_t len) {
    uint8_t crc = 0x00;
    for (size_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (uint8_t bit = 0; bit < 8; bit++) {
            crc = (crc & 0x80) ? (crc << 1) ^ 0x31 : (crc << 1);
        }
    }
    return crc;
}
```

## COBS Framing

Serial and BLE transports wrap each packet in COBS (Consistent Overhead Byte Stuffing) encoding before transmission. COBS eliminates `0x00` from the encoded data, so `0x00` serves as a reliable packet delimiter.

- Overhead: 1 byte per 254 bytes of data
- Delimiter: `0x00` after each COBS-encoded packet

TCP, WebSocket, and MQTT transports skip COBS. TCP uses length-prefixed reads, and MQTT delivers discrete messages with built-in framing.

| Transport | COBS |
|---|---|
| Serial (UART/USB) | Yes |
| USB CDC | Yes |
| BLE | Yes |
| CLASP | Yes |
| TCP | No |
| WebSocket | No |
| MQTT | No |

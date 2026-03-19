---
title: Packet Structure
description: CONDUYT wire format — binary packet layout
---

# Packet Structure

Every CONDUYT packet follows a fixed header + variable payload structure.

## Frame Layout

```
┌─────────┬─────┬──────┬─────┬──────────┬───────────┬──────┐
│ MAGIC   │ VER │ TYPE │ SEQ │ LEN      │ PAYLOAD   │ CRC8 │
│ 2 bytes │ 1B  │ 1B   │ 1B  │ 2B (LE)  │ N bytes   │ 1B   │
│ 0x47 46 │ 01  │      │     │          │           │      │
└─────────┴─────┴──────┴─────┴──────────┴───────────┴──────┘
```

**Total overhead: 8 bytes** per packet.

## Field Definitions

| Field | Size | Description |
|---|---|---|
| **MAGIC** | 2 bytes | `0x47 0x46` ("GF"). Catches misaligned reads on serial streams. |
| **VER** | 1 byte | Protocol version. Currently `0x01`. |
| **TYPE** | 1 byte | Command (host→device) or event (device→host) type. |
| **SEQ** | 1 byte | Rolling sequence 0–255. Host increments per command. Device echoes in ACK/NAK. |
| **LEN** | 2 bytes | Payload length, little-endian uint16. Max capped at device's `max_payload`. |
| **PAYLOAD** | N bytes | Type-specific data. Zero-length for PING, RESET, etc. |
| **CRC8** | 1 byte | Dallas/Maxim CRC8 over bytes `[VER..end of PAYLOAD]`. |

## COBS Framing

For serial and BLE transports, each packet is wrapped in COBS (Consistent Overhead Byte Stuffing) encoding. This eliminates `0x00` from the data, making it usable as a packet delimiter.

- Overhead: 1 byte per 254 bytes of data
- Delimiter: `0x00` after each COBS-encoded packet

TCP, WebSocket, and MQTT transports carry packets as binary messages — COBS is not needed since the transport provides its own framing.

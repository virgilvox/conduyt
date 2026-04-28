---
title: Datastream Types
description: Datastream type codes and wire format reference
---

# Datastream Types

Datastreams are named, typed values declared in firmware and exchanged between device and host.

## Type Codes

| Code | Name | Size (bytes) | Range | Constant |
|---|---|---|---|---|
| `0x01` | BOOL | 1 | 0 or 1 | `CONDUYT_TYPE_BOOL` |
| `0x02` | INT8 | 1 | -128 to 127 | `CONDUYT_TYPE_INT8` |
| `0x03` | UINT8 | 1 | 0 to 255 | `CONDUYT_TYPE_UINT8` |
| `0x04` | INT16 | 2 | -32768 to 32767 | `CONDUYT_TYPE_INT16` |
| `0x05` | UINT16 | 2 | 0 to 65535 | `CONDUYT_TYPE_UINT16` |
| `0x06` | INT32 | 4 | -2^31 to 2^31-1 | `CONDUYT_TYPE_INT32` |
| `0x07` | FLOAT32 | 4 | IEEE 754 float | `CONDUYT_TYPE_FLOAT32` |
| `0x08` | STRING | var | UTF-8 null-terminated | `CONDUYT_TYPE_STRING` |
| `0x09` | BYTES | var | Raw binary | `CONDUYT_TYPE_BYTES` |

All multi-byte numeric values are little-endian.

## Wire Format

### DS_EVENT (0xD1):Device to Host

Device pushes a datastream value to the host.

```
ds_index(u8) + value(N bytes)
```

The value encoding matches the declared type code. A FLOAT32 datastream sends 4 bytes in IEEE 754 little-endian format.

### DS_WRITE (0x60):Host to Device

Host writes a value to a writable datastream.

```
ds_index(u8) + value(N bytes)
```

The device responds with ACK on success, or NAK with `DATASTREAM_READONLY` (`0x0E`) or `UNKNOWN_DATASTREAM` (`0x0D`).

### DS_READ (0x61):Host to Device

Host requests the current value of a datastream.

```
ds_index(u8)
```

The device responds with DS_READ_RESP (`0xD2`):

```
ds_index(u8) + value(N bytes)
```

### DS_SUBSCRIBE (0x62):Host to Device

Host subscribes to periodic updates.

```
ds_index(u8) + interval_ms(u16)
```

The device responds with ACK. Subsequent updates arrive as DS_EVENT packets.

## Datastream Descriptor

Declared in the [HELLO_RESP](/docs/reference/hello-resp) payload. Each descriptor is 28 bytes:

| Field | Size | Description |
|---|---|---|
| name | 16 | Null-padded UTF-8 name |
| type | 1 | `CONDUYT_TYPE_*` code |
| unit | 8 | Null-padded unit string (e.g., "celsius", "rpm") |
| writable | 1 | 0x01 if host can write |
| pin_ref | 1 | Associated pin number (0xFF if none) |
| retain | 1 | 0x01 if value is retained across reconnect |

## Firmware Declaration

```cpp
device.addDatastream("temperature", CONDUYT_FLOAT32, "celsius", false);  // read-only
device.addDatastream("setpoint",    CONDUYT_FLOAT32, "celsius", true);   // writable
```

`CONDUYT_FLOAT32` and the other `CONDUYT_<TYPE>` short forms are aliases for `CONDUYT_TYPE_<TYPE>` defined in `Conduyt.h`. Either form works; the firmware examples use the short form.

---
title: Datastreams
description: Named device values with type safety and push semantics
---

# Datastreams

Datastreams are named, typed values that flow between device and host. They're the CONDUYT equivalent of Blynk virtual pins — but without the cloud dependency.

## Type Codes

| Code | Name | Size | Range |
|---|---|---|---|
| `0x01` | BOOL | 1 | 0 or 1 |
| `0x02` | INT8 | 1 | −128 to 127 |
| `0x03` | UINT8 | 1 | 0 to 255 |
| `0x04` | INT16 | 2 | −32768 to 32767 |
| `0x05` | UINT16 | 2 | 0 to 65535 |
| `0x06` | INT32 | 4 | −2³¹ to 2³¹−1 |
| `0x07` | FLOAT32 | 4 | IEEE 754 float |
| `0x08` | STRING | var | UTF-8 null-terminated |
| `0x09` | BYTES | var | Raw binary |

## Firmware Side

### Declaring

```cpp
device.addDatastream("temperature", CONDUYT_TYPE_FLOAT32, "celsius", false);
device.addDatastream("setpoint", CONDUYT_TYPE_FLOAT32, "celsius", true);
```

### Pushing Values

```cpp
device.writeDatastream("temperature", 22.5f);
```

### Receiving Writes

```cpp
device.onDatastreamWrite("setpoint", [](ConduytPayloadReader &payload, ConduytContext &ctx) {
    float value = payload.readFloat32();
    // Apply the setpoint
    ctx.ack();
});
```

## Host Side (JavaScript)

```typescript
// Read
const temp = await device.datastream('temperature').read()

// Write
await device.datastream('setpoint').write(25.0)

// Subscribe
const sub = device.datastream('temperature').subscribe()
for await (const value of sub) {
  console.log('Temperature:', value)
}
```

## Wire Format

Datastream events use the DS_EVENT packet (0xD1):

```
ds_index(u8) + value(N bytes)
```

The value encoding matches the declared type code. All multi-byte values are little-endian.

---
title: Use Datastreams
description: Declare, push, and subscribe to named typed values between device and host.
---

# Use Datastreams

Datastreams are named, typed data channels between a device and host. Use them for structured application data: sensor readings with units, configuration values, status indicators. For direct hardware control (toggling pins, reading raw ADC), use the [pin API](/docs/reference/js-api) instead.

## 1. Declare datastreams on the device

Register datastreams before calling `device.begin()`:

```cpp
#include <Conduyt.h>

ConduytSerial transport(Serial, 115200);
ConduytDevice device("TempNode", "1.0.0", transport);

void setup() {
  Serial.begin(115200);

  // Read-only: device pushes values, host reads/subscribes
  // Args: name, type, unit, writable
  device.addDatastream("temperature", CONDUYT_FLOAT32, "celsius", false);

  // Writable: host writes values, device receives them
  device.addDatastream("setpoint", CONDUYT_FLOAT32, "celsius", true);

  device.begin();
}
```

The fourth argument controls direction:
- `false` = **read-only** - device pushes, host reads
- `true` = **writable** - host writes, device receives

## 2. Push values from the device

Use non-blocking timing to push values at a fixed interval:

```cpp
unsigned long lastPush = 0;

void loop() {
  device.poll();

  // Push temperature every 1 second
  if (millis() - lastPush >= 1000) {
    lastPush = millis();

    float temp = analogRead(A0) * 0.48828125f;  // rough voltage-to-celsius
    device.writeDatastream("temperature", temp);
  }
}
```

Each `writeDatastream()` call sends a DS_EVENT packet to the host. Don't call it every loop iteration - the serial link can't keep up with tens of thousands of updates per second.

## 3. Receive writes on the device

Register a callback for writable datastreams:

```cpp
device.onDatastreamWrite("setpoint", [](ConduytPayloadReader &payload, ConduytContext &ctx) {
  float value = payload.readFloat32();
  Serial.print("New setpoint: ");
  Serial.println(value);
  // Apply the value to your control logic here
  ctx.ack();  // confirm receipt
});
```

If you don't call `ctx.ack()`, the device auto-acks. Call `ctx.nak(errorCode)` to reject a write.

## Available type codes

| Code | Constant | Size | Range |
|------|----------|------|-------|
| `0x01` | `CONDUYT_BOOL` | 1 byte | 0 or 1 |
| `0x02` | `CONDUYT_INT8` | 1 byte | -128 to 127 |
| `0x03` | `CONDUYT_UINT8` | 1 byte | 0 to 255 |
| `0x04` | `CONDUYT_INT16` | 2 bytes | -32768 to 32767 |
| `0x05` | `CONDUYT_UINT16` | 2 bytes | 0 to 65535 |
| `0x06` | `CONDUYT_INT32` | 4 bytes | -2^31 to 2^31-1 |
| `0x07` | `CONDUYT_FLOAT32` | 4 bytes | IEEE 754 float |
| `0x08` | `CONDUYT_STRING` | variable | UTF-8, null-terminated |
| `0x09` | `CONDUYT_BYTES` | variable | Raw binary |

The verbose `CONDUYT_TYPE_<NAME>` forms in `Conduyt.h` are aliases of these short forms; either works in `addDatastream()`.

## Host: JavaScript

### Read the current value

```javascript
const temp = await device.datastream('temperature').read()
console.log('Temperature:', temp)
```

### Write a value

```javascript
await device.datastream('setpoint').write(25.0)
```

### Subscribe to live updates

```javascript
// Yields a new value each time the device pushes an update
for await (const value of device.datastream('temperature').subscribe()) {
  console.log('Temperature:', value)
}
```

### Full working example

```javascript
// datastreams.mjs
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'

const device = await ConduytDevice.connect(
  new SerialTransport({ path: '<YOUR_PORT>', baudRate: 115200 })
)

// Read current temperature
const temp = await device.datastream('temperature').read()
console.log('Current temp:', temp)

// Set target temperature
await device.datastream('setpoint').write(22.0)
console.log('Setpoint set to 22.0')

// Stream live updates (runs until you Ctrl+C)
console.log('Streaming temperature updates...')
for await (const value of device.datastream('temperature').subscribe()) {
  console.log('Temperature:', value)
}
```

```bash
node datastreams.mjs
```

## Host: Python

```python
# datastreams.py
import asyncio
import struct

from conduyt import ConduytDevice
from conduyt.transports.serial import SerialTransport
from conduyt.core.constants import CMD


def ds_index(device, name: str) -> int:
    """Look up a datastream's wire index from HELLO_RESP."""
    for ds in device.capabilities.datastreams:
        if ds.name == name:
            return ds.index
    raise KeyError(f"datastream {name!r} not found")


async def main():
    device = ConduytDevice(SerialTransport('<YOUR_PORT>'))
    await device.connect()

    temp_idx  = ds_index(device, 'temperature')
    set_idx   = ds_index(device, 'setpoint')

    # DS_READ payload is `ds_index(u8)`. Response (DS_READ_RESP, 0xD2) is
    # `ds_index(u8) + value(N)`; skip the leading id byte.
    resp = await device._send_command(CMD.DS_READ, bytes([temp_idx]))
    temp = struct.unpack('<f', resp[1:5])[0]
    print(f"Current temp: {temp:.1f}")

    # DS_WRITE payload is `ds_index(u8) + value(N)`.
    payload = bytes([set_idx]) + struct.pack('<f', 22.0)
    await device._send_command(CMD.DS_WRITE, payload)
    print("Setpoint set to 22.0")

    await device.disconnect()


asyncio.run(main())
```

**Note:** The Python SDK doesn't have a `.datastream()` proxy like JavaScript. Send raw DS_READ / DS_WRITE / DS_SUBSCRIBE commands via `_send_command()`. The built-in module wrappers in `conduyt.modules` use the same pattern internally. Constants are class attributes on `CMD` (e.g. `CMD.DS_READ`), exported from `conduyt.core.constants`.

## Full firmware example

```cpp
#include <Conduyt.h>

ConduytSerial transport(Serial, 115200);
ConduytDevice device("TempNode", "1.0.0", transport);

float currentSetpoint = 20.0f;

void setup() {
  Serial.begin(115200);

  device.addDatastream("temperature", CONDUYT_FLOAT32, "celsius", false);
  device.addDatastream("setpoint", CONDUYT_FLOAT32, "celsius", true);

  device.onDatastreamWrite("setpoint", [](ConduytPayloadReader &payload, ConduytContext &ctx) {
    currentSetpoint = payload.readFloat32();
    Serial.print("New setpoint: ");
    Serial.println(currentSetpoint);
    ctx.ack();
  });

  device.begin();
}

unsigned long lastPush = 0;

void loop() {
  device.poll();

  if (millis() - lastPush >= 1000) {
    lastPush = millis();
    float temp = analogRead(A0) * 0.48828125f;
    device.writeDatastream("temperature", temp);
  }
}
```

For wire format details and type encoding, see [Datastream Types](/docs/reference/datastream-types).

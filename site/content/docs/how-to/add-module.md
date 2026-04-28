---
title: Write a Firmware Module
description: Create and register a custom firmware module for a Conduyt device.
---

# Write a Firmware Module

Modules extend a CONDUYT device with custom hardware capabilities. Each module handles commands from the host, can emit events, and runs a poll loop for background work.

Write a custom module when built-in pin control and datastreams aren't enough - for example, devices with initialization sequences (displays), multi-step protocols (1-Wire sensors), or continuous processing (PID loops, stepper pulse generation).

## The module interface

Every module implements `ConduytModuleBase`:

```cpp
class ConduytModuleBase {
public:
  virtual const char* name() = 0;        // module name, max 8 characters
  virtual uint8_t versionMajor() { return 1; }
  virtual uint8_t versionMinor() { return 0; }
  virtual void begin() {}                // called after device.begin()
  virtual void handle(uint8_t cmd, ConduytPayloadReader &payload, ConduytContext &ctx) = 0;
  virtual void poll() {}                 // called every device.poll() cycle
  virtual uint8_t pinCount() { return 0; }
  virtual const uint8_t* pins() { return nullptr; }
};
```

## Example: a relay module

This module controls a relay on pin 4 with two commands: set state and read state.

```cpp
#define CONDUYT_MODULE_RELAY
#include <Conduyt.h>

CONDUYT_MODULE(RelayModule) {
public:
  const char* name() override { return "relay"; }
  uint8_t versionMajor() override { return 1; }
  uint8_t versionMinor() override { return 0; }

  void begin() override {
    // Called once after device.begin() - initialize your hardware here
    pinMode(_pin, OUTPUT);
    digitalWrite(_pin, LOW);
  }

  void handle(uint8_t cmd, ConduytPayloadReader &payload, ConduytContext &ctx) override {
    CONDUYT_ON_CMD(0x01) {
      // Command 0x01: Set relay state
      // Host sends: [0 or 1]
      uint8_t state = payload.readUInt8();
      digitalWrite(_pin, state ? HIGH : LOW);
      ctx.ack();   // confirm the command succeeded
    }

    CONDUYT_ON_CMD(0x02) {
      // Command 0x02: Read relay state
      // Host sends: nothing
      // We respond with: [0 or 1]
      uint8_t buf[1];
      ConduytPayloadWriter w(buf, sizeof(buf));
      w.writeUInt8(digitalRead(_pin));
      ctx.sendModResp(0x02, buf, w.length());
    }
  }

  void poll() override {
    // Called every loop cycle - nothing to do for a relay
  }

private:
  uint8_t _pin = 4;
};
```

## Register the module

Add modules before calling `device.begin()`. Module IDs are assigned by registration order - first module = ID 0, second = ID 1, etc.

```cpp
void setup() {
  Serial.begin(115200);

  device.addModule(new RelayModule());        // module ID 0
  device.addModule(new TempSensorModule());   // module ID 1
  device.begin();
}
```

These IDs appear in the HELLO_RESP packet so the host knows what modules are available and how to address them.

## Context API reference

The `ConduytContext` passed to `handle()` controls how the device responds:

| Method | When to use | What it sends |
|--------|------------|---------------|
| `ctx.ack()` | Command succeeded, no data to return | ACK packet |
| `ctx.nak(errorCode)` | Command failed | NAK packet with error code |
| `ctx.sendModResp(cmdId, data, len)` | Command succeeded, returning data | MOD_RESP packet |
| `ctx.emitModEvent(eventId, code, data, len)` | Unsolicited event from module | MOD_EVENT packet |

If your handler doesn't call any of these, `ConduytDevice` auto-sends an ACK.

## Reading command payloads

`ConduytPayloadReader` reads typed values in order from the command payload. All multi-byte values are **little-endian**.

```cpp
void handle(uint8_t cmd, ConduytPayloadReader &payload, ConduytContext &ctx) override {
  CONDUYT_ON_CMD(0x01) {
    uint8_t  pin   = payload.readUInt8();     // 1 byte
    uint16_t speed = payload.readUInt16();    // 2 bytes, little-endian
    float    angle = payload.readFloat32();   // 4 bytes, IEEE 754
    ctx.ack();
  }
}
```

## Writing response payloads

`ConduytPayloadWriter` builds response data into a buffer:

```cpp
CONDUYT_ON_CMD(0x02) {
  uint8_t buf[8];
  ConduytPayloadWriter w(buf, sizeof(buf));
  w.writeUInt8(0x01);          // status byte
  w.writeFloat32(23.5f);       // temperature
  w.writeUInt16(512);          // raw ADC value
  ctx.sendModResp(0x02, buf, w.length());  // w.length() = 7 bytes
}
```

## Poll loop

`poll()` runs every `device.poll()` cycle. Use it for continuous background work. Keep it **fast and non-blocking** - never call `delay()` inside `poll()`.

```cpp
void poll() override {
  unsigned long now = millis();
  if (now - _lastRead >= 1000) {
    _lastRead = now;
    _latestTemp = readSensor();
    _hasNewReading = true;
  }
}
```

`poll()` doesn't receive a `ConduytContext`, so it can't send responses directly. Store results in member variables and return them when the host sends a read command via `handle()`.

## Control the module from the host

### JavaScript

The JavaScript SDK has a `.module()` proxy that sends MOD_CMD packets by name:

```javascript
// Get the module proxy - 'relay' matches the name() return value in firmware
const relay = device.module('relay')

// Send command 0x01 (set state) with payload [1] (on)
await relay.cmd(0x01, new Uint8Array([1]))
console.log('Relay ON')

// Send command 0x02 (read state), receive response bytes
const resp = await relay.cmd(0x02)
console.log('Relay state:', resp[0])   // 0 or 1
```

### Python

The Python SDK doesn't have a `.module()` proxy. For custom modules, write a thin wrapper:

```python
# relay.py
from conduyt.core.constants import CMD


class RelayModule:
    """Host-side wrapper for the relay firmware module."""

    def __init__(self, device, module_id: int):
        self._device = device
        self._id = module_id

    async def set_state(self, on: bool):
        """Send command 0x01: set relay state."""
        payload = bytes([self._id, 0x01, int(on)])
        await self._device._send_command(CMD.MOD_CMD, payload)

    async def get_state(self) -> int:
        """Send command 0x02: read relay state."""
        payload = bytes([self._id, 0x02])
        resp = await self._device._send_command(CMD.MOD_CMD, payload)
        # MOD_RESP payload is `module_id(1) + data(N)`; skip the id byte.
        return resp[1] if len(resp) > 1 else 0
```

Usage:

```python
relay = RelayModule(device, module_id=0)

await relay.set_state(True)
print("Relay ON")

state = await relay.get_state()
print(f"Relay state: {state}")  # 0 or 1
```

The built-in module wrappers in `conduyt.modules` (Servo, NeoPixel, DHT, etc.) use the same `_send_command()` pattern internally.

## Compile guards

Gate each module with a `#define` to keep binary size small on constrained boards (Uno R3 has only 32 KB flash):

```cpp
#define CONDUYT_MODULE_RELAY
#define CONDUYT_MODULE_TEMPSENSOR
#include <Conduyt.h>
```

Only the modules you define get compiled. This is especially important on AVR boards where every kilobyte counts.

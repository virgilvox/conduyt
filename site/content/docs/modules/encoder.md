---
title: "Encoder Module"
description: "Quadrature rotary encoder driver with tick events and absolute count."
---

# Encoder Module

Drive a 2-pin quadrature rotary encoder. The firmware polls the A/B lines, accumulates a signed tick count, and emits unsolicited tick events whenever the count changes — so the host doesn't have to poll.

## Firmware setup

```ini
; platformio.ini
build_flags = -DCONDUYT_MODULE_ENCODER
```

```cpp
#include <Conduyt.h>

ConduytSerial transport(Serial, 115200);
ConduytDevice device("EncoderBot", "1.0.0", transport);

void setup() {
  Serial.begin(115200);
  device.addModule(new ConduytModuleEncoder());
  device.begin();
}

void loop() {
  device.poll();
}
```

## Wiring

```
Encoder         Board
─────           ─────
A           ──► any GPIO with INPUT_PULLUP support (e.g. 2)
B           ──► any GPIO with INPUT_PULLUP support (e.g. 3)
GND         ──► GND
+ (if any)  ──► 3V3 / 5V depending on encoder
```

The firmware enables `INPUT_PULLUP` on both pins automatically, so external pull-ups are not required for most rotary encoders. For very long wire runs you may still want them.

**Pin choice tip:** the encoder polls inside `device.poll()`, so it doesn't depend on hardware interrupts. Any digital input pin works — but if you're spinning the encoder very fast and your loop is busy, consider routing A to an interrupt-capable pin and adding an attach-interrupt fork in your firmware.

## Host usage

### JavaScript

```javascript
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'
import { ConduytEncoder } from 'conduyt-js/modules/encoder'

const device = await ConduytDevice.connect(new SerialTransport({ path: '<YOUR_PORT>' }))
const enc = new ConduytEncoder(device)   // resolves "encoder" by name from HELLO_RESP

await enc.attach(2, 3)                   // pinA = 2, pinB = 3
await enc.reset()

enc.onTick((count, delta) => {
  console.log(`count=${count}  delta=${delta}`)
})

setInterval(async () => {
  console.log('current count:', await enc.read())
}, 1000)
```

### Python

```python
from conduyt import ConduytDevice
from conduyt.transports.serial import SerialTransport
from conduyt.modules import ConduytEncoder

device = ConduytDevice(SerialTransport('<YOUR_PORT>'))
await device.connect()

enc = ConduytEncoder(device, module_id=0)
await enc.attach(pin_a=2, pin_b=3)
await enc.reset()

count = await enc.read()
print(f"count = {count}")
```

## Command reference

| Command | ID | Payload | Description |
|---------|-----|---------|-------------|
| Attach | `0x01` | `pinA(1) + pinB(1)` | Claim two pins as A/B inputs |
| Read | `0x02` | (none) | → `MOD_RESP` with `int32` count |
| Reset | `0x03` | (none) | Zero the count |

## Events

| Event | ID | Payload | When |
|-------|-----|---------|------|
| Tick | `0x01` | `int32 count + int16 delta` | Emitted automatically on each detent / step change |

## Notes

- Counts are signed `int32`. Direction depends on which physical wire you call A vs B — swap them or invert in software if it counts backwards.
- Software polling means very fast turns can drop ticks. For 600+ PPR optical encoders at high RPM, you'll want a dedicated interrupt-driven sketch.
- `reset()` zeros the count immediately; in-flight tick events still report from the new zero.

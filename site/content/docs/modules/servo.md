---
title: "Servo Module"
description: "Control hobby servos — attach, set angle, microseconds, and detach."
---

# Servo Module

Control standard hobby servos (SG90, MG996R, etc.) with angle or microsecond precision.

## Firmware setup

Add the compile flag and register the module:

```ini
; platformio.ini
build_flags = -DCONDUYT_MODULE_SERVO
```

```cpp
#include <Conduyt.h>

ConduytSerial transport(Serial, 115200);
ConduytDevice device("ServoBot", "1.0.0", transport);

void setup() {
  Serial.begin(115200);
  device.addModule(new ConduytModuleServo());
  device.begin();
}

void loop() {
  device.poll();
}
```

## Wiring

```
Servo            Board
─────            ─────
Signal (orange/white) ──► PWM pin (e.g. pin 9)
VCC (red)             ──► 5V
GND (brown/black)     ──► GND
```

**Important:** For high-torque servos (MG996R and larger), power them from an **external 5V supply**, not the Arduino's 5V pin. The Arduino can't source enough current and may brown out. Connect all grounds together (Arduino GND + external supply GND + servo GND).

**Which pins work?**
- **Arduino Uno:** PWM pins only — 3, 5, 6, 9, 10, 11
- **ESP32:** Any GPIO pin works (uses the LEDC peripheral)
- **Pico:** Any GPIO pin works

## Host usage

### JavaScript

```bash
npm install conduyt-js
```

```javascript
// servo.mjs
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'
import { Servo } from 'conduyt-js/modules/servo'

const device = await ConduytDevice.connect(
  new SerialTransport({ path: '<YOUR_PORT>' })
)

const servo = new Servo(device, 0)   // 0 = first registered module

// Attach to pin 9 with default pulse range (544–2400 microseconds)
await servo.attach(9, 544, 2400)

// Sweep from 0 to 180 degrees
for (let angle = 0; angle <= 180; angle += 10) {
  await servo.write(angle)
  console.log(`Angle: ${angle}`)
  await new Promise(r => setTimeout(r, 200))
}

// Precise positioning with microseconds
await servo.writeMicroseconds(1500)  // center position
console.log('Centered at 1500us')

await servo.detach()
await device.disconnect()
```

```bash
node servo.mjs
```

### Python

```bash
pip install conduyt-py[serial]
```

```python
# servo.py
import asyncio
from conduyt import ConduytDevice
from conduyt.transports.serial import SerialTransport
from conduyt.modules import ConduytServo


async def main():
    device = ConduytDevice(SerialTransport('<YOUR_PORT>'))
    await device.connect()

    servo = ConduytServo(device, module_id=0)
    await servo.attach(pin=9, min_us=544, max_us=2400)

    # Sweep
    for angle in range(0, 181, 10):
        await servo.write(angle)
        print(f"Angle: {angle}")
        await asyncio.sleep(0.2)

    await servo.detach()
    await device.disconnect()


asyncio.run(main())
```

## Command reference

| Command | ID | Payload | Description |
|---------|-----|---------|-------------|
| Attach | `0x01` | `pin(1) + minUs(2) + maxUs(2)` | Attach servo to a PWM pin |
| Write | `0x02` | `angle(1)` | Set angle, 0–180 degrees |
| WriteMicroseconds | `0x03` | `us(2)` | Set pulse width directly (544–2400) |
| Detach | `0x04` | (none) | Release the pin |

## Notes

- Most servos accept 544–2400 microseconds. Pass custom min/max to `attach()` if your servo has a different range.
- Angles outside 0–180 are clamped by the firmware.
- Call `detach()` when done to free the PWM channel for other use.

---
title: "Stepper Module"
description: "Drive a step/dir/enable stepper-motor driver — relative or absolute moves, with done-events."
---

# Stepper Module

Drive a stepper motor through a step/dir/enable driver chip (A4988, DRV8825, TMC2208, etc.). The firmware generates step pulses non-blocking inside `device.poll()`, so other modules keep running while the motor moves. When a move completes, an unsolicited `done` event fires with the final position.

## Firmware setup

```ini
; platformio.ini
build_flags = -DCONDUYT_MODULE_STEPPER
```

```cpp
#include <Conduyt.h>

ConduytSerial transport(Serial, 115200);
ConduytDevice device("StepperBot", "1.0.0", transport);

void setup() {
  Serial.begin(115200);
  device.addModule(new ConduytModuleStepper());
  device.begin();
}

void loop() {
  device.poll();
}
```

## Wiring

```
A4988/DRV8825/TMC2208      Board
──────                     ─────
STEP                    ──► any digital out (e.g. 2)
DIR                     ──► any digital out (e.g. 3)
ENABLE  (active LOW)    ──► any digital out (e.g. 4) — pass 0xFF to skip
GND                     ──► GND
VDD (logic)             ──► 3V3 / 5V depending on board
VMOT                    ──► motor PSU + (8–35V typical)
GND_motor               ──► motor PSU −
1A/1B/2A/2B             ──► motor coils
```

If your driver doesn't expose ENABLE, pass `0xFF` for `enPin` — the firmware will skip touching it. Always set the driver's current limit before powering up the motor or you'll cook either the driver or the coils.

## Host usage

### JavaScript

```javascript
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'
import { ConduytStepper } from 'conduyt-js/modules/stepper'

const device = await ConduytDevice.connect(new SerialTransport({ path: '<YOUR_PORT>' }))
const stepper = new ConduytStepper(device)

await stepper.config(2, 3, 4, 200)       // step, dir, en, stepsPerRev

stepper.onDone((position) => {
  console.log(`done at position ${position}`)
})

await stepper.move(800, 400)             // 800 steps at 400 Hz
await stepper.moveTo(0, 200)             // home at 200 Hz
```

### Python

```python
from conduyt import ConduytDevice
from conduyt.transports.serial import SerialTransport
from conduyt.modules import ConduytStepper

device = ConduytDevice(SerialTransport('<YOUR_PORT>'))
await device.connect()

stepper = ConduytStepper(device, module_id=0)
await stepper.config(step_pin=2, dir_pin=3, en_pin=4, steps_per_rev=200)
await stepper.move(steps=800, speed_hz=400)
```

## Command reference

| Command | ID | Payload | Description |
|---------|-----|---------|-------------|
| Config | `0x01` | `step(1) + dir(1) + en(1) + stepsPerRev(2)` | Configure pins. `en=0xFF` to skip enable line |
| Move | `0x02` | `steps(4 i32) + speedHz(2)` | Relative move (negative = reverse) |
| MoveTo | `0x03` | `position(4 i32) + speedHz(2)` | Absolute move to target position |
| Stop | `0x04` | (none) | Halt immediately, position is preserved |

## Events

| Event | ID | Payload | When |
|-------|-----|---------|------|
| Done | `0x01` | `position(4 i32)` | Emitted when a move completes (not on `stop()`) |

## Notes

- Position is absolute — tracked across moves until you reset it (no command exists for this; power-cycle to zero, or call `moveTo(0)` to home).
- `speedHz` is steps-per-second. With 1/16 microstepping and a 200-step/rev motor, 3200 Hz = 1 RPS. Drivers have a maximum step rate per microstep mode — typically 50–200 kHz, well above what most loops achieve.
- The pulse width is fixed at 2 µs HIGH per step. That's safe for every common driver chip.
- Multiple steppers: instantiate `ConduytModuleStepper` once per motor and `addModule` each one. Each appears as its own module ID in `HELLO_RESP`.

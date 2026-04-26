---
title: "PID Module"
description: "Run a closed-loop PID controller on the device — analog input, PWM output, host-tunable gains."
---

# PID Module

Run a closed-loop proportional-integral-derivative controller entirely on the firmware. The device samples an analog input pin, computes the PID output, and writes it to a PWM output pin — every `_intervalMs` (default 100 ms). The host sets gains and target setpoint over the wire and can listen for tick events.

This is the right module for: motor speed control, temperature regulation with a heater + thermistor, light leveling, anything where you need a fast inner loop without round-tripping through the host.

## Firmware setup

```ini
; platformio.ini
build_flags = -DCONDUYT_MODULE_PID
```

```cpp
#include <Conduyt.h>

ConduytSerial transport(Serial, 115200);
ConduytDevice device("PIDBot", "1.0.0", transport);

void setup() {
  Serial.begin(115200);
  device.addModule(new ConduytModulePID());
  device.begin();
}

void loop() {
  device.poll();
}
```

## Wiring

Anything with one analog input + one PWM output:

```
Sensor (e.g. potentiometer)   Board
──────                        ─────
Wiper                       ──► Analog pin (e.g. A0)
+ end                       ──► 3V3 / 5V
- end                       ──► GND

Actuator (e.g. LED through resistor)
                            ──► PWM pin (e.g. 5) → resistor → load → GND
```

For a real plant — heater, motor, or anything inductive — drive the PWM pin into a transistor or H-bridge, never the load directly.

## Host usage

### JavaScript

```javascript
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'
import { ConduytPID } from 'conduyt-js/modules/pid'

const device = await ConduytDevice.connect(new SerialTransport({ path: '<YOUR_PORT>' }))
const pid = new ConduytPID(device)

await pid.config(2.0, 0.5, 0.05)        // Kp, Ki, Kd
await pid.setInput(14)                   // analog pin (A0 on Uno)
await pid.setOutput(5)                   // PWM pin
await pid.setTarget(50.0)                // setpoint in scaled units
await pid.enable()

pid.onTick((input, output, error) => {
  console.log(`in=${input.toFixed(2)} out=${output.toFixed(2)} err=${error.toFixed(2)}`)
})
```

### Python

```python
from conduyt import ConduytDevice
from conduyt.transports.serial import SerialTransport
from conduyt.modules import ConduytPID

device = ConduytDevice(SerialTransport('<YOUR_PORT>'))
await device.connect()

pid = ConduytPID(device, module_id=0)
await pid.config(kp=2.0, ki=0.5, kd=0.05)
await pid.set_input(14)
await pid.set_output(5)
await pid.set_target(50.0)
await pid.enable()
```

## Command reference

| Command | ID | Payload | Description |
|---------|-----|---------|-------------|
| Config | `0x01` | `kp(4) + ki(4) + kd(4)` | LE float32 gains |
| SetTarget | `0x02` | `value(4)` | LE float32 setpoint |
| SetInput | `0x03` | `pin(1)` | Analog input pin |
| SetOutput | `0x04` | `pin(1)` | PWM output pin |
| Enable | `0x05` | `enable(1)` | 1 = run, 0 = pause (gains preserved) |

## Events

| Event | ID | Payload | When |
|-------|-----|---------|------|
| Tick | `0x01` | `input(4) + output(4) + error(4)` LE float32 | Once per PID cycle (100 ms default) |

## Notes

- The default tick interval is 100 ms (`_intervalMs = 100` in the firmware). Override by editing the module class if you need faster control.
- The analog reading is normalized as `analogRead(pin) / 1023.0 * inputScale` with `inputScale = 100.0` by default — so `input` is in 0–100 "percent" units. Set your target in the same scale.
- PID output is clamped to 0–255 before `analogWrite()`. Negative outputs (anti-windup undershoot) clamp to 0.
- Disable resets the integral and derivative state so re-enabling doesn't kick from a stale history.

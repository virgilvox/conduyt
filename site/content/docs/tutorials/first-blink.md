---
title: "Quick Start: PlatformIO"
description: "Flash Conduyt firmware with PlatformIO, connect from Node.js, toggle an LED, and read an analog pin."
---

# Quick Start: PlatformIO

This tutorial walks through flashing CONDUYT firmware with PlatformIO, connecting from Node.js over serial, toggling the onboard LED, and reading an analog sensor.

## Prerequisites

- **Arduino Uno** (or compatible board with LED on pin 13)
- **USB cable** (Type-A to Type-B for Uno)
- **Potentiometer** (any value, 10k ohm is common) — only needed for section 6
- **Three jumper wires** — only needed for section 6
- **[PlatformIO CLI](https://docs.platformio.org/en/latest/core/installation/index.html)** — install with:
  ```bash
  pip install platformio
  ```
  Verify it's installed:
  ```bash
  pio --version
  # PlatformIO Core, version 6.x.x
  ```
- **[Node.js 20+](https://nodejs.org/)** — verify with:
  ```bash
  node --version
  # v20.x.x or higher
  ```

## 1. Create the PlatformIO project

PlatformIO is a build system for embedded development. It downloads toolchains, board definitions, and libraries automatically — no Arduino IDE needed.

```bash
mkdir conduyt-blink && cd conduyt-blink
pio project init --board uno --project-option "framework=arduino"
```

Expected output:

```
Project has been initialized!
```

This creates `platformio.ini`, `src/`, and `lib/` directories. Open `platformio.ini` and replace its contents with:

```ini
; platformio.ini
[env:uno]
platform = atmelavr
board = uno
framework = arduino
lib_deps = conduyt
```

The `lib_deps = conduyt` line tells PlatformIO to download the CONDUYT firmware library automatically on the next build.

## 2. Write and flash the firmware

Create `src/main.cpp`:

```cpp
// src/main.cpp
#include <Arduino.h>
#include <Conduyt.h>

ConduytSerial transport(Serial, 115200);
ConduytDevice device("MyBoard", "1.0.0", transport);

void setup() {
  Serial.begin(115200);
  device.begin();
}

void loop() {
  device.poll();
}
```

What each line does:

- `ConduytSerial transport(Serial, 115200)` — creates a serial transport at 115200 baud. Both the firmware and host must use the same baud rate.
- `ConduytDevice device("MyBoard", "1.0.0", transport)` — creates the device. `"MyBoard"` is the name reported during the handshake. `"1.0.0"` is a version string.
- `device.begin()` — initializes pin maps and prepares to respond to host connections.
- `device.poll()` — checks for incoming packets and processes them. Called every loop iteration so the device responds with minimal latency.

Now plug in your board and flash:

```bash
pio run --target upload
```

Expected output (last few lines):

```
Writing | ################################################## | 100%
avrdude done.  Thank you.
======== [SUCCESS] Took 5.23 seconds ========
```

The board is now running CONDUYT firmware and waiting for a host to connect.

**If upload fails:** make sure no serial monitor is open (Arduino IDE, `screen`, `minicom`). Only one process can use the serial port at a time.

## 3. Find your serial port

You need the port path for the host script:

```bash
# macOS
ls /dev/cu.usb*
# Example: /dev/cu.usbmodem14101

# Linux
ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null
# Example: /dev/ttyACM0

# Or use PlatformIO's device list (any OS)
pio device list
```

On **Windows**, open Device Manager → Ports (COM & LPT). You'll see something like `COM3`.

## 4. Install the host SDK

Open a new terminal (keep the board plugged in) and create a Node.js project:

```bash
mkdir conduyt-host && cd conduyt-host
npm init -y
npm install conduyt-js
```

Expected output:

```
added 3 packages in 1.2s
```

## 5. Connect and inspect capabilities

Create `blink.mjs` — replace `<YOUR_PORT>` with the port from step 3:

```javascript
// blink.mjs
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'

// Replace with your port: '/dev/cu.usbmodem14101' (macOS),
// '/dev/ttyACM0' (Linux), or 'COM3' (Windows)
const transport = new SerialTransport({ path: '<YOUR_PORT>', baudRate: 115200 })

let device
try {
  device = await ConduytDevice.connect(transport)
} catch (err) {
  console.error('Connection failed:', err.message)
  console.error('Is the board plugged in? Is another program using the port?')
  process.exit(1)
}

console.log('Firmware:', device.capabilities.firmwareName)
console.log('Pins:', device.capabilities.pins.length)
console.log('Modules:', device.capabilities.modules)

await device.disconnect()
```

Run it:

```bash
node blink.mjs
```

Expected output:

```
Firmware: MyBoard
Pins: 20
Modules: []
```

`firmwareName` matches the string you passed to `ConduytDevice` in the firmware. `pins` lists every GPIO the board exposes. `modules` is empty because this sketch has no modules registered.

**If you see "Connection failed":** make sure the port path is correct, the board is plugged in, and no other program (Arduino IDE Serial Monitor, `screen`, etc.) has the port open.

## 6. Toggle the LED

Replace the contents of `blink.mjs`:

```javascript
// blink.mjs
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'

const transport = new SerialTransport({ path: '<YOUR_PORT>', baudRate: 115200 })

let device
try {
  device = await ConduytDevice.connect(transport)
} catch (err) {
  console.error('Connection failed:', err.message)
  process.exit(1)
}

try {
  // Configure pin 13 as digital output
  await device.pin(13).mode('output')

  // Blink 5 times
  for (let i = 0; i < 5; i++) {
    await device.pin(13).write(1)    // LED on  (pin HIGH)
    console.log('LED on')
    await new Promise(r => setTimeout(r, 500))

    await device.pin(13).write(0)    // LED off (pin LOW)
    console.log('LED off')
    await new Promise(r => setTimeout(r, 500))
  }
} finally {
  await device.disconnect()
}
```

```bash
node blink.mjs
```

Expected output:

```
LED on
LED off
LED on
LED off
...
```

The onboard LED blinks 5 times. `pin(13).mode('output')` sends a PIN_MODE packet to configure pin 13 as a digital output. `write(1)` sets the pin HIGH (LED on), `write(0)` sets it LOW (LED off). The `try/finally` ensures the serial port is released even if an error occurs.

## 7. Read an analog pin

Wire a potentiometer to the Arduino:

```
Potentiometer          Arduino
─────────────          ───────
Left leg    ─────────► GND
Center leg  ─────────► A0
Right leg   ─────────► 5V
```

Replace the contents of `blink.mjs`:

```javascript
// blink.mjs
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'

const transport = new SerialTransport({ path: '<YOUR_PORT>', baudRate: 115200 })

let device
try {
  device = await ConduytDevice.connect(transport)
} catch (err) {
  console.error('Connection failed:', err.message)
  process.exit(1)
}

try {
  // Set pin 0 to analog input mode
  // pin(0) with mode('analog') maps to the physical pin labeled A0 on the board
  await device.pin(0).mode('analog')

  // Read 5 samples
  for (let i = 0; i < 5; i++) {
    const value = await device.pin(0).read()
    console.log(`A0 = ${value}`)   // 0-1023 on a 10-bit ADC (Arduino Uno)
    await new Promise(r => setTimeout(r, 500))
  }
} finally {
  await device.disconnect()
}
```

```bash
node blink.mjs
```

Turn the potentiometer knob while it runs:

```
A0 = 512
A0 = 612
A0 = 780
A0 = 340
A0 = 100
```

**How analog pin addressing works:** When you call `pin(0).mode('analog')`, the firmware maps pin index 0 to analog channel A0. The `mode('analog')` call triggers this mapping. `read()` performs an analog-to-digital conversion and returns the raw ADC value (0–1023 on Arduino Uno's 10-bit ADC).

## What happened at the protocol level

Each step triggered specific binary packets over the serial link:

1. **HELLO handshake** — `ConduytDevice.connect()` sent a HELLO packet. The firmware replied with HELLO_RESP containing its name, version, pin count, and module list.
2. **PIN_MODE** — `pin(13).mode('output')` sent a PIN_MODE packet telling the firmware to configure pin 13 as digital output.
3. **PIN_WRITE** — `pin(13).write(1)` sent a PIN_WRITE packet with pin=13 and value=1. The firmware set the hardware pin HIGH.
4. **PIN_READ** — `pin(0).read()` sent a PIN_READ packet. The firmware performed the ADC conversion and returned the result.

All packets are binary-encoded with CRC8 checksums and COBS framing. The SDK and firmware handle this automatically.

## Next steps

- [Sensor Dashboard](/docs/tutorials/sensor-dashboard) — wire a DHT22 sensor, use the module system, read from Python
- [Connect over Serial](/docs/how-to/connect-serial) — serial setup for JavaScript, Python, and Go
- [What is Conduyt?](/docs/tutorials/what-is-conduyt) — deep dive into protocol architecture and concepts

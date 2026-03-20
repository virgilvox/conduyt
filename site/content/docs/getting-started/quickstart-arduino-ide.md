---
title: "Quick Start: Arduino IDE"
description: "Install the Conduyt library, flash firmware, and blink an LED — all from the Arduino IDE."
---

# Quick Start: Arduino IDE

Flash CONDUYT firmware and blink an LED from a Node.js script in about 5 minutes.

## Prerequisites

- **An Arduino board** — Uno R3, Uno R4, ESP32, or any board supported by the Arduino IDE
- **USB data cable** for your board (not charge-only — if the board doesn't show up, try a different cable)
- **[Arduino IDE 2](https://www.arduino.cc/en/software)** installed
- **[Node.js 20+](https://nodejs.org/)** installed — verify with `node --version` in your terminal

## 1. Install the CONDUYT library

In the Arduino IDE:

1. Go to **Sketch → Include Library → Manage Libraries**
2. Search for **Conduyt**
3. Click **Install**

If the library doesn't appear in the search results, you can install it manually: download the latest `Conduyt-x.x.x.zip` from the [GitHub Releases](https://github.com/virgilvox/conduyt/releases) page, then go to **Sketch → Include Library → Add .ZIP Library** and select the downloaded zip.

## 2. Flash the firmware sketch

Go to **File → Examples → Conduyt → BasicBlink**. This opens a minimal sketch:

```cpp
#include <Conduyt.h>

ConduytSerial  transport(Serial, 115200);
ConduytDevice  device("BasicBlink", "1.0.0", transport);

void setup() {
  device.begin();
}

void loop() {
  device.poll();
}
```

This creates a serial transport at 115200 baud, names the device "BasicBlink", and enters a poll loop that listens for commands from the host.

Now upload it:

1. Go to **Tools → Board** and select your board (e.g., "Arduino Uno")
2. Go to **Tools → Port** and select the serial port for your board
3. Click the **Upload** button (right-arrow icon)

Wait for "Done uploading." in the status bar. The board is now running CONDUYT firmware.

## 3. Find your serial port

You'll need the port path for the host script. Here's how to find it:

**macOS:**

```bash
ls /dev/cu.usb*
# Example output: /dev/cu.usbmodem14101
```

**Linux:**

```bash
ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null
# Example output: /dev/ttyACM0
```

**Windows:** Open Device Manager → Ports (COM & LPT). You'll see something like `COM3` or `COM4`.

Or list ports from Node.js (after step 4):

```javascript
// list-ports.mjs
import { SerialPort } from 'serialport'
const ports = await SerialPort.list()
ports.forEach(p => console.log(p.path, p.manufacturer || ''))
```

```bash
node list-ports.mjs
# /dev/cu.usbmodem14101  Arduino (www.arduino.cc)
```

## 4. Create the host project

Open a terminal and run:

```bash
mkdir my-conduyt && cd my-conduyt
npm init -y
npm install conduyt-js
```

`conduyt-js` includes the protocol SDK and serial transport. No other packages are needed.

## 5. Blink the LED

Create `blink.mjs` — replace `<YOUR_PORT>` with the port you found in step 3:

```javascript
// blink.mjs
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'

// Replace with your port: '/dev/cu.usbmodem14101' (macOS),
// '/dev/ttyACM0' (Linux), or 'COM3' (Windows)
const device = await ConduytDevice.connect(
  new SerialTransport({ path: '<YOUR_PORT>' })
)

console.log('Connected to:', device.capabilities.firmwareName)

// Set pin 13 as digital output
await device.pin(13).mode('output')

// Blink 10 times
for (let i = 0; i < 10; i++) {
  await device.pin(13).write(1)
  console.log('LED ON')
  await new Promise(r => setTimeout(r, 500))

  await device.pin(13).write(0)
  console.log('LED OFF')
  await new Promise(r => setTimeout(r, 500))
}

await device.disconnect()
console.log('Done.')
```

Run it:

```bash
node blink.mjs
```

Expected output:

```
Connected to: BasicBlink
LED ON
LED OFF
LED ON
LED OFF
...
Done.
```

You should see the LED on pin 13 blink 10 times.

## Troubleshooting

**"Connection failed" or timeout:**
- Make sure the Arduino IDE Serial Monitor is **closed** — only one process can use a serial port at a time
- Verify the port path matches your board. Re-run `ls /dev/cu.usb*` (macOS) or check Device Manager (Windows)
- Try pressing the RESET button on the board, wait a second, then run the script again

**LED doesn't blink but no errors:**
- Your board's LED might be on a different pin. ESP32 uses pin **2**, Pico uses pin **25**. Change `pin(13)` to match.

**"Permission denied" (Linux):**

```bash
sudo usermod -aG dialout $USER
# Log out and back in, then retry
```

**npm install fails:**
- Make sure you have Node.js 20+: `node --version`

## Next steps

- [Sensor Dashboard](/docs/tutorials/sensor-dashboard) — wire a DHT22 sensor and read temperature from Python
- [Connect over BLE](/docs/how-to/connect-ble) — wireless control from a browser
- [Playground](/playground) — write and run code directly in the browser

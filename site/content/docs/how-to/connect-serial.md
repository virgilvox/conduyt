---
title: Connect over Serial
description: Set up serial communication between a host and a Conduyt device in JavaScript, Python, and Go.
---

# Connect over Serial

Serial (USB) is the default CONDUYT transport. No network, no broker, no configuration — just plug in and go.

## Firmware

Flash this minimal sketch to your board:

```cpp
#include <Conduyt.h>

// Both sides must use the same baud rate (default: 115200)
ConduytSerial transport(Serial, 115200);
ConduytDevice device("MyDevice", "1.0.0", transport);

void setup() {
  Serial.begin(115200);
  device.begin();
}

void loop() {
  device.poll();
}
```

## Find your serial port

### macOS

```bash
ls /dev/cu.usb*
# /dev/cu.usbmodem14101   ← typical Arduino
# /dev/cu.usbserial-0001  ← typical FTDI/CH340
```

### Linux

```bash
ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null
# /dev/ttyACM0   ← typical Arduino with native USB
# /dev/ttyUSB0   ← typical FTDI/CH340 adapter
```

### Windows

Open **Device Manager → Ports (COM & LPT)**. You'll see entries like `COM3` or `COM4`.

Or from PowerShell:

```bash
[System.IO.Ports.SerialPort]::GetPortNames()
# COM3
# COM4
```

If no port appears, try a different USB cable — some cables are charge-only and don't carry data.

## JavaScript (Node.js)

Install the SDK:

```bash
npm install conduyt-js
```

Create `connect.mjs`:

```javascript
// connect.mjs
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'

const transport = new SerialTransport({
  path: '<YOUR_PORT>',    // e.g. '/dev/cu.usbmodem14101' or 'COM3'
  baudRate: 115200
})

const device = await ConduytDevice.connect(transport)

console.log('Firmware:', device.capabilities.firmwareName)
console.log('Pins:', device.capabilities.pins.length)

// Toggle pin 13
await device.pin(13).mode('output')
await device.pin(13).write(1)
console.log('Pin 13 HIGH')

await device.disconnect()
```

```bash
node connect.mjs
```

Expected output:

```
Firmware: MyDevice
Pins: 20
Pin 13 HIGH
```

### Browser (WebSerial)

WebSerial requires a Chromium browser (Chrome or Edge) and a **user gesture** — you must call `connect()` inside a `click`, `keydown`, or `pointerdown` event handler. Calling it on page load will fail silently.

```html
<!-- index.html -->
<button id="connectBtn">Connect</button>
<pre id="log"></pre>

<script type="module">
  import { ConduytDevice } from 'conduyt-js'
  import { WebSerialTransport } from 'conduyt-js/transports/web-serial'

  document.getElementById('connectBtn').addEventListener('click', async () => {
    const transport = new WebSerialTransport({ baudRate: 115200 })
    const device = await ConduytDevice.connect(transport)
    // Browser opens a port picker — user selects their board

    document.getElementById('log').textContent =
      `Connected to: ${device.capabilities.firmwareName}\n` +
      `Pins: ${device.capabilities.pins.length}`

    await device.pin(13).mode('output')
    await device.pin(13).write(1)

    document.getElementById('log').textContent += '\nPin 13 HIGH'
  })
</script>
```

## Python

Install the SDK with serial support:

```bash
pip install conduyt-py[serial]
```

Create `connect.py`:

```python
# connect.py
import asyncio
from conduyt import ConduytDevice
from conduyt.transports.serial import SerialTransport


async def main():
    transport = SerialTransport('<YOUR_PORT>', baudrate=115200)
    device = ConduytDevice(transport)
    hello = await device.connect()

    print(f"Firmware: {hello.firmware_name}")
    print(f"Pins: {hello.pin_count}")

    await device.pin(13).mode("output")
    await device.pin(13).write(1)
    print("Pin 13 HIGH")

    await device.disconnect()


asyncio.run(main())
```

```bash
python connect.py
```

## Go

```bash
go get github.com/virgilvox/conduyt/sdk/go
go get go.bug.org/serial
```

```go
// main.go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.bug.org/serial"
	conduyt "github.com/virgilvox/conduyt/sdk/go"
)

func main() {
	port, err := serial.Open("<YOUR_PORT>", &serial.Mode{BaudRate: 115200})
	if err != nil {
		log.Fatal("Failed to open port: ", err)
	}

	ctx := context.Background()
	transport := conduyt.NewSerialTransport(port)
	device := conduyt.NewDevice(transport, 5*time.Second)

	hello, err := device.Connect(ctx)
	if err != nil {
		log.Fatal("Connection failed: ", err)
	}
	fmt.Println("Firmware:", hello.FirmwareName)
	fmt.Println("Pins:", hello.PinCount)

	if err := device.Pin(13).Mode(ctx, conduyt.PinModeOutput); err != nil {
		log.Fatal(err)
	}
	if err := device.Pin(13).Write(ctx, 1); err != nil {
		log.Fatal(err)
	}
	fmt.Println("Pin 13 HIGH")

	device.Disconnect(ctx)
}
```

```bash
go run main.go
```

## Troubleshooting

### Permission denied (Linux)

Your user needs to be in the `dialout` group to access serial ports:

```bash
sudo usermod -aG dialout $USER
# You MUST log out and log back in for this to take effect
```

### Port busy / "Resource busy"

Another process has the port open. Close any serial monitors (Arduino IDE Serial Monitor, `screen`, `minicom`, PlatformIO serial monitor) before connecting. Only one process can hold a serial port at a time.

### No data / garbled output

The baud rate must match on both sides. If the firmware uses `115200` and the host uses `9600`, you'll get silence or garbage. Double-check both.

### Device not detected / no port in `/dev`

1. Try a different USB cable — charge-only cables don't carry data
2. Try a different USB port on your computer
3. On some boards (ESP32 with CH340 chip), you may need to install [CH340 drivers](https://www.wch-ic.com/downloads/CH341SER_EXE.html)

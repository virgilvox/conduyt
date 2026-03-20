---
title: "Quick Start: Browser Playground"
description: "Flash firmware and control a board from your browser — no installs required."
---

# Quick Start: Browser Playground

The [CONDUYT Playground](/playground) lets you flash firmware, write code, and control hardware entirely from your browser. No IDE, no CLI, no drivers.

## Prerequisites

- A supported board: **ESP32**, **Arduino Uno R4**, or **Raspberry Pi Pico**
- A USB data cable (not a charge-only cable — if your board doesn't show up, try a different cable)
- **Chrome** or **Edge** desktop browser (WebSerial and WebUSB require a Chromium-based browser — Firefox and Safari will not work)

## 1. Open the Playground

Navigate to [/playground](/playground). You'll see three panels:

- **Code Editor** (left) — Monaco editor with autocomplete for the CONDUYT API
- **Console** (top right) — output from `log()` calls in your code
- **Device** (bottom right) — connection status, firmware name, and pin count

## 2. Flash firmware onto your board

Click **Flash** in the toolbar. Pick your board below and follow the steps.

### ESP32

1. Click **Install CONDUYT Firmware**
2. Chrome will open a serial port picker — select your ESP32
3. Wait for the installer to finish (it handles bootloader, partitions, and firmware automatically)

If the port picker is empty, try a different USB cable or port. Some ESP32 boards need you to hold the **BOOT** button during the first few seconds.

### Arduino Uno R4

1. **Double-tap the RESET button** on the board quickly (two taps within ~500ms) — the "L" LED should start pulsing slowly, which means DFU mode is active
2. Click **Flash Arduino Uno R4**
3. Chrome will prompt for a USB device — select the Arduino DFU device (not a serial port)
4. Wait for the progress bar to complete

If the "L" LED doesn't pulse, you tapped too slowly. Try again — two quick taps.

On Windows, you may need to install [WinUSB drivers via Zadig](https://zadig.akeo.ie/) if no DFU device appears. On macOS and Linux it works without drivers.

### Raspberry Pi Pico

1. **Unplug** the Pico from USB
2. Hold the **BOOTSEL** button (the small white button on the board)
3. While holding BOOTSEL, plug the USB cable in
4. Release BOOTSEL — the Pico appears as a USB drive (like a flash drive)
5. Click **Flash Raspberry Pi Pico** in the Playground

## 3. Connect to the board

Close the flash panel. Click **Connect** in the toolbar. Chrome opens a serial port picker — select your board's port.

The Device panel should update to show:

```
Connected
Firmware: BasicBlink
Pins: 20
```

**If the connection times out:** press the physical RESET button on your board (single tap), wait a second, then click **Connect** again. If the serial port doesn't appear at all, try unplugging and replugging the USB cable.

## 4. Run the blink example

The editor comes pre-loaded with a Blink example. Click **Run** (the play button). You should see output in the Console panel:

```
[runner] Connected: BasicBlink
LED ON
LED OFF
LED ON
LED OFF
...
[runner] Finished
```

And the LED on your board should blink. The default LED pin is **13** (Uno R4), **2** (ESP32), or **25** (Pico).

**If nothing happens:** make sure the Device panel says "Connected" before clicking Run. Check the Console for error messages like "Not connected" or "Timeout".

## 5. Try other examples

Use the **Examples** dropdown in the toolbar:

| Example | What it does | Board needed? |
|---------|-------------|--------------|
| **Blink** | Toggle LED on/off | Yes |
| **Read Sensor** | Read analog pin values | Yes |
| **Ping** | Test the connection round-trip | Yes |
| **PWM Fade** | Smooth LED brightness sweep | Yes (PWM-capable pin) |
| **Raw Packets** | Low-level protocol demo | No (runs in-browser only) |

## 6. Write your own code

Clear the editor and try this:

```javascript
// Set pin 13 as output and blink 5 times
await device.pin(13).mode('output')

for (let i = 0; i < 5; i++) {
  await device.pin(13).write(1)
  log('ON')
  await sleep(300)

  await device.pin(13).write(0)
  log('OFF')
  await sleep(300)
}

log('Done!')
```

## Available APIs

The Playground gives you four globals:

### `device` — board control

```javascript
await device.connect()                    // open connection (done automatically by Run)
await device.pin(13).mode('output')       // set pin mode: 'input', 'output', 'analog', 'pwm'
await device.pin(13).write(1)             // digital write: 0 or 1
const val = await device.pin(0).read()    // read pin value (analog if mode is 'analog')
await device.ping()                       // round-trip connectivity test
await device.reset()                      // soft-reset the device
```

### `conduyt` — low-level WASM protocol

```javascript
const CMD = conduyt.getCMD()                    // command type constants
const pkt = conduyt.makePacket(CMD.PING, 0)     // build a raw packet
const wire = conduyt.wireEncode(pkt)            // encode to wire format
const cobs = conduyt.cobsEncode(wire)           // apply COBS framing
```

### `log(...)` — print to the Console panel

```javascript
log('sensor value:', val)
log({ temperature: 23.5, humidity: 51 })
```

### `sleep(ms)` — async delay

```javascript
await sleep(1000)  // wait 1 second
```

Type `device.` or `conduyt.` in the editor to see full autocomplete suggestions.

## Limitations

- **Browser support:** Chrome or Edge only (no Firefox, no Safari, no mobile browsers)
- **USB only:** The Playground connects via USB serial. For wireless (BLE, MQTT), use the native SDKs
- **Use `await sleep()`:** Code runs in the main browser thread. Long-running loops without `await sleep()` will freeze the page
- **Stop running code:** Click the Stop button (square icon) in the toolbar

## Next steps

- [Quick Start: Arduino IDE](/docs/getting-started/quickstart-arduino-ide) — set up a local dev environment with full toolchain
- [Quick Start: PlatformIO](/docs/tutorials/first-blink) — advanced build system for multi-board projects
- [WASM SDK](/docs/sdks/wasm) — use the protocol encoder/decoder in your own web apps

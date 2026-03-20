---
title: "NeoPixel Module"
description: "Control WS2812/SK6812 addressable RGB LED strips and rings."
---

# NeoPixel Module

Drive WS2812, SK6812, and compatible addressable LED strips with per-pixel color control.

## Firmware setup

```ini
; platformio.ini
build_flags = -DCONDUYT_MODULE_NEOPIXEL
```

```cpp
#include <Conduyt.h>

ConduytSerial transport(Serial, 115200);
ConduytDevice device("LEDStrip", "1.0.0", transport);

void setup() {
  Serial.begin(115200);
  device.addModule(new ConduytModuleNeoPixel());
  device.begin();
}

void loop() {
  device.poll();
}
```

## Wiring

```
NeoPixel Strip       Board
──────────────       ─────
DIN (data in)  ────► Digital pin (e.g. pin 6)
VCC (+5V)      ────► External 5V supply (NOT the Arduino 5V pin for >8 LEDs)
GND            ────► GND (connect Arduino GND + supply GND + strip GND together)
```

**Recommended protection:**
- **330 ohm resistor** on the data line (between pin and DIN) — prevents signal reflection
- **1000 uF capacitor** across the power supply (+ to VCC, - to GND) — smooths power spikes on startup

**Power math:** Each pixel draws up to 60 mA at full white. A 30-pixel strip can draw 1.8A — far more than an Arduino's 5V pin can supply. Use an external 5V power supply for anything over ~8 pixels.

## Host usage

### JavaScript

```javascript
// neopixel.mjs
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'
import { NeoPixel } from 'conduyt-js/modules/neopixel'

const device = await ConduytDevice.connect(
  new SerialTransport({ path: '<YOUR_PORT>' })
)

const strip = new NeoPixel(device, 0)

// Initialize: pin 6, 30 LEDs
await strip.begin(6, 30)

// Set individual pixels (changes are buffered)
await strip.setPixel(0, 255, 0, 0)    // pixel 0 = red
await strip.setPixel(1, 0, 255, 0)    // pixel 1 = green
await strip.setPixel(2, 0, 0, 255)    // pixel 2 = blue
await strip.show()                      // push buffer to strip

// Fill all pixels with one color
await strip.fill(255, 165, 0)          // all orange
await strip.show()

// Adjust brightness (0-255)
await strip.setBrightness(64)          // 25% brightness
await strip.show()

await device.disconnect()
```

### Python

```python
# neopixel.py
import asyncio
from conduyt import ConduytDevice
from conduyt.transports.serial import SerialTransport
from conduyt.modules import ConduytNeoPixel


async def main():
    device = ConduytDevice(SerialTransport('<YOUR_PORT>'))
    await device.connect()

    strip = ConduytNeoPixel(device, module_id=0)
    await strip.begin(pin=6, count=30)

    await strip.set_pixel(0, 255, 0, 0)   # red
    await strip.set_pixel(1, 0, 255, 0)   # green
    await strip.show()

    await strip.fill(0, 0, 255)           # all blue
    await strip.show()

    await device.disconnect()


asyncio.run(main())
```

## Command reference

| Command | ID | Payload | Description |
|---------|-----|---------|-------------|
| Begin | `0x01` | `pin(1) + count(2)` | Initialize strip on pin with pixel count |
| SetPixel | `0x02` | `index(2) + r(1) + g(1) + b(1)` | Set one pixel's RGB color |
| SetPixelW | `0x03` | `index(2) + r(1) + g(1) + b(1) + w(1)` | Set one pixel's RGBW color (SK6812) |
| Fill | `0x04` | `r(1) + g(1) + b(1)` | Set all pixels to one color |
| Show | `0x05` | (none) | Push the buffer to the physical strip |
| Brightness | `0x06` | `level(1)` | Set global brightness, 0–255 |

## Notes

- **Always call `show()` after changing pixels.** Changes are buffered in RAM until `show()` pushes them to the strip.
- **RAM cost:** Each pixel uses ~3 bytes on the MCU. A 300-pixel strip = ~900 bytes. On the Uno R3 (2 KB RAM total), keep strips under ~50 pixels. ESP32 and Pico can handle hundreds.
- **RGBW strips** (SK6812) use `setPixelW()` with a 4th white channel value.

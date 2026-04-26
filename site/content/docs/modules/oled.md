---
title: "OLED Module"
description: "Drive an SSD1306 monochrome OLED panel over I2C — text, rectangles, bitmaps."
---

# OLED Module

Drive an SSD1306-based monochrome OLED display (the cheap 0.96" 128×64 panels everyone has) over I2C. Send text, draw rectangles, blit 1-bit bitmaps; the firmware buffers everything off-screen until you call `show()`.

## Firmware setup

```ini
; platformio.ini
build_flags = -DCONDUYT_MODULE_OLED
lib_deps =
    adafruit/Adafruit GFX Library
    adafruit/Adafruit SSD1306
```

```cpp
#include <Conduyt.h>

ConduytSerial transport(Serial, 115200);
ConduytDevice device("DisplayBot", "1.0.0", transport);

void setup() {
  Serial.begin(115200);
  Wire.begin();
  device.addModule(new ConduytModuleOLED());
  device.begin();
}

void loop() {
  device.poll();
}
```

## Wiring

```
SSD1306 OLED      Board
─────────         ─────
SDA           ──► SDA pin (Uno: A4, ESP32: 21, Pico: GP4)
SCL           ──► SCL pin (Uno: A5, ESP32: 22, Pico: GP5)
VCC           ──► 3V3
GND           ──► GND
```

I2C address: most modules are `0x3C`. A few clones with the SA0 pad jumpered to VDD are `0x3D`. Pass `addr=0` to the wrapper to use the firmware default of `0x3C`.

## Host usage

### JavaScript

```javascript
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'
import { ConduytOLED } from 'conduyt-js/modules/oled'

const device = await ConduytDevice.connect(new SerialTransport({ path: '<YOUR_PORT>' }))
const oled = new ConduytOLED(device)

await oled.begin(128, 64)
await oled.clear()
await oled.text(0, 0,  1, 'Hello')
await oled.text(0, 16, 2, 'CONDUYT')
await oled.drawRect(0, 48, 128, 16, true)   // filled bar
await oled.show()
```

### Python

```python
from conduyt import ConduytDevice
from conduyt.transports.serial import SerialTransport
from conduyt.modules import ConduytOLED

device = ConduytDevice(SerialTransport('<YOUR_PORT>'))
await device.connect()

oled = ConduytOLED(device, module_id=0)
await oled.begin(width=128, height=64, i2c_addr=0x3C)
await oled.clear()
await oled.text(0, 0, 1, "Hello")
await oled.show()
```

## Command reference

| Command | ID | Payload | Description |
|---------|-----|---------|-------------|
| Begin | `0x01` | `width(1) + height(1) + addr(1)` | Init the panel. addr=0 → 0x3C default |
| Clear | `0x02` | (none) | Zero the off-screen buffer |
| Text | `0x03` | `x(1) + y(1) + size(1) + str(N)` | Draw text. Remaining bytes are the string |
| DrawRect | `0x04` | `x(1) + y(1) + w(1) + h(1) + fill(1)` | Outline (fill=0) or filled rect |
| DrawBitmap | `0x05` | `x(1) + y(1) + w(1) + h(1) + data(N)` | 1-bit bitmap, ceil(w*h/8) bytes |
| Show | `0x06` | (none) | Flush off-screen buffer to the panel |

## Notes

- All draw commands paint into an off-screen buffer. Nothing appears on the panel until you call `show()`.
- Text bytes are limited to 64 chars per packet by the firmware buffer — chunk longer strings yourself.
- `size` is the Adafruit_GFX text scale. `1` = 6×8 pixels per character, `2` = 12×16, etc.
- Bitmaps are 1 bit per pixel, MSB-first within each byte. A 16×16 bitmap is 32 bytes.

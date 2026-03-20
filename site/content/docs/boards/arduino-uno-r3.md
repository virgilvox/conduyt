---
title: "Arduino Uno R3"
description: "Classic Arduino Uno board guide - ATmega328P, serial transport, memory constraints."
---

# Arduino Uno R3

The classic Arduino Uno with the ATmega328P. The most widely available Arduino board and a good starting point for learning CONDUYT. Limited memory means you'll want to keep module usage minimal.

## Specs

| Property | Value |
|----------|-------|
| MCU | ATmega328P (AVR), 16 MHz |
| Flash | 32 KB (0.5 KB used by bootloader) |
| RAM | 2 KB SRAM |
| GPIO | 20 pins (14 digital + 6 analog) |
| ADC | 6 channels (10-bit), pins A0–A5 |
| PWM | 6 channels (pins 3, 5, 6, 9, 10, 11) |
| I2C | 1 bus (SDA = A4, SCL = A5) |
| SPI | 1 bus (SS = 10, MOSI = 11, MISO = 12, SCK = 13) |
| UART | 1 port (TX = pin 1, RX = pin 0) |
| WiFi | No |
| BLE | No |
| OTA | No |

## Firmware setup

### Arduino IDE

Select **Arduino Uno** from **Tools → Board → Arduino AVR Boards**. This board package comes pre-installed with the Arduino IDE - no extra setup needed.

### PlatformIO

```ini
; platformio.ini
[env:uno]
platform = atmelavr
board = uno
framework = arduino
lib_deps = conduyt
```

```bash
pio run --target upload
```

## Transport

Serial only (over USB). The Uno has no WiFi or BLE hardware.

```cpp
#include <Conduyt.h>

ConduytSerial  transport(Serial, 115200);
ConduytDevice  device("MyDevice", "1.0.0", transport);

void setup() {
  Serial.begin(115200);
  device.begin();
}

void loop() {
  device.poll();
}
```

## Built-in LED

**Pin 13**. This is the standard Arduino LED pin used in all blink examples.

## Memory constraints

With only 2 KB of RAM, the Uno is tight. Here's what costs memory:

| Feature | RAM cost | Guideline |
|---------|----------|-----------|
| CONDUYT core | ~400 bytes | Always present |
| Each module | ~20–100 bytes | Stick to 1–2 modules |
| Each datastream | ~20 bytes | Keep to 3–4 max |
| Receive buffer | 256 bytes (default) | Can reduce to 128 |

To reduce the receive buffer:

```cpp
// Add this BEFORE #include <Conduyt.h>
#define CONDUYT_MAX_PAYLOAD 128
#include <Conduyt.h>
```

**Other tips:**
- Avoid Arduino `String` objects - they fragment the heap. Use `char[]` arrays instead.
- Don't use `Serial.print()` for debug output while CONDUYT is running - it shares the same UART.
- Compile with `build_flags = -Os` (PlatformIO default) for smallest binary size.

## Common issues

- **"not in sync" during upload:** Make sure the correct port is selected and all serial monitors are closed. Try: hold RESET, click Upload, release RESET when you see "Uploading..."
- **Erratic behavior after flashing:** Usually an out-of-RAM condition. Reduce modules, datastreams, or payload buffer size.
- **Pins 0 and 1 don't work as GPIO:** These are the hardware UART (Serial TX/RX). They can't be used for GPIO while serial transport is active.

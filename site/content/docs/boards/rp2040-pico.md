---
title: "Raspberry Pi Pico"
description: "RP2040 Pico board guide — dual-core, PIO, USB serial transport."
---

# Raspberry Pi Pico

The Raspberry Pi Pico features the RP2040 — a dual-core ARM Cortex-M0+ with generous RAM and the unique PIO (Programmable I/O) subsystem. Good for projects needing precise timing or multiple serial buses.

## Specs

| Property | Value |
|----------|-------|
| MCU | RP2040, dual-core ARM Cortex-M0+, 133 MHz |
| Flash | 2 MB |
| RAM | 264 KB SRAM |
| GPIO | 26 pins |
| ADC | 3 channels (12-bit), pins GP26–GP28 |
| PWM | 16 channels |
| I2C | 2 buses |
| SPI | 2 buses |
| UART | 2 ports |
| WiFi | No (use **Pico W** for WiFi/BLE) |
| BLE | No (use **Pico W** for WiFi/BLE) |
| OTA | No |

## Firmware setup

### PlatformIO

```ini
; platformio.ini
[env:pico]
platform = raspberrypi
board = pico
framework = arduino
lib_deps = conduyt
```

```bash
pio run --target upload
```

### Arduino IDE

1. Go to **Tools → Board → Boards Manager**
2. Search for **pico** and install **Raspberry Pi Pico/RP2040**
3. Select **Raspberry Pi Pico** from the board list
4. Select the serial port from **Tools → Port**

## Transport

USB serial:

```cpp
#include <Conduyt.h>

ConduytSerial  transport(Serial, 115200);
ConduytDevice  device("PicoDevice", "1.0.0", transport);

void setup() {
  Serial.begin(115200);
  device.begin();
}

void loop() {
  device.poll();
}
```

## Browser flashing

1. **Unplug** the Pico from USB
2. Hold the **BOOTSEL** button (small white button on the board)
3. **While holding BOOTSEL**, plug the USB cable into the Pico
4. Release BOOTSEL — the Pico appears as a USB mass storage device (like a flash drive) named `RPI-RP2`
5. Go to the [Playground](/playground), click **Flash**, select **Raspberry Pi Pico**

If the Pico doesn't appear as a drive, make sure you're holding BOOTSEL **before** plugging in, not after.

## Built-in LED

**Pin 25** (directly wired, no PWM support on this pin).

On the **Pico W**, the LED is connected through the WiFi chip. Use `LED_BUILTIN` instead of a pin number:

```cpp
pinMode(LED_BUILTIN, OUTPUT);
digitalWrite(LED_BUILTIN, HIGH);
```

## Common issues

- **No serial port appearing:** The Pico's USB serial only appears after firmware that calls `Serial.begin()` is running. If you have a blank Pico, flash via BOOTSEL mode first.
- **Upload fails in Arduino IDE:** Hold BOOTSEL, plug in the board, release BOOTSEL, then click Upload. Some IDE versions auto-detect BOOTSEL mode.
- **Only 3 analog pins:** The RP2040 has ADC on GP26, GP27, and GP28 only. Other pins don't support `mode('analog')`.

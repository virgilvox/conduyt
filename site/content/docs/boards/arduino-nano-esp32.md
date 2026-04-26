---
title: "Arduino Nano ESP32"
description: "Nano ESP32 board guide — ESP32-S3 in Nano form factor, WiFi/BLE, 8 MB flash."
---

# Arduino Nano ESP32

The Nano ESP32 wraps an ESP32-S3 in the Nano form factor: WiFi and BLE on a board the size of a postage stamp. It has 8 MB of flash, 8 MB of PSRAM, and the same 14 digital + 8 analog pin layout as the classic Nano, but with all the ESP32-S3's peripherals underneath.

## Specs

| Property | Value |
|---|---|
| MCU | ESP32-S3 (Xtensa LX7, dual-core), 240 MHz |
| Flash | 8 MB |
| PSRAM | 8 MB |
| GPIO | 20 user pins (D0–D13, A0–A5) — silicon pins differ from Nano numbering |
| ADC | A0–A7 |
| PWM | All output-capable pins via LEDC |
| I2C | 1 user bus exposed (Wire) |
| SPI | 1 user bus exposed |
| UART | 3 ports (only Serial0/Serial1 routed to pins) |
| WiFi | 802.11 b/g/n |
| BLE | 5.0 |
| OTA | Supported |

## Flashing

USB-CDC native, plus ROM bootloader for first-flash. The [Playground](/playground) drives `esp-web-tools` to flash bin/partitions/bootloader. After first flash, OTA can update over WiFi.

## Notes

- The Nano-style pin numbers (D0–D13, A0–A7) map to non-contiguous ESP32-S3 silicon GPIOs. Use the Arduino `D0`/`A0` constants — don't hard-code raw GPIO numbers.
- The board ships with PSRAM enabled by default. Heap allocations greater than ~50 KB transparently come from PSRAM.
- Strapping pins (the ESP32-S3 boot/strap config) are not exposed on the public Nano pin map, so you don't need to worry about them in normal use.

## Compile flag

```ini
[env:nano_esp32]
platform = espressif32
board = arduino_nano_esp32
framework = arduino
```

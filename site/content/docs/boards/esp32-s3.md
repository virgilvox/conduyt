---
title: "ESP32-S3"
description: "ESP32-S3 board guide — dual-core, native USB, WiFi + BLE 5, 45 GPIOs and AI accelerator."
---

# ESP32-S3

The ESP32-S3 is what you'd build if you took the original ESP32 and modernized everything: dual Xtensa LX7 cores at 240 MHz, native USB-OTG, WiFi + BLE 5, AI vector instructions, more PSRAM, more GPIOs. For most new CONDUYT projects, S3 is the right ESP-family pick.

## Specs

| Property | Value |
|---|---|
| MCU | Xtensa LX7 dual-core, 240 MHz |
| Flash | 4–32 MB (module-dependent) |
| RAM | 512 KB SRAM |
| PSRAM | up to 32 MB |
| GPIO | 45 user pins (some reserved) |
| ADC | ADC1 (GPIO 1–10), ADC2 (11–20) |
| PWM | LEDC routable to any output GPIO |
| I2C | 2 buses |
| SPI | 4 user buses (one reserved for flash/PSRAM) |
| UART | 3 ports |
| WiFi | 802.11 b/g/n |
| BLE | 5.0, BLE Mesh |
| Native USB | Yes — CDC, JTAG, MSC, HID |
| OTA | Supported |

## Flashing

Same flow as the rest of the ESP family. USB-CDC native on most dev-kits — plug in and the [Playground](/playground) handles it via `esp-web-tools`. After first flash, OTA over WiFi is the easy path.

## Notes

- The S3 is BLE 5.0 (not 4.x like the original ESP32). LE Audio and 2M PHY are supported in firmware.
- Dual-core means CONDUYT polling can live on core 1 while WiFi/IP runs on core 0. The Arduino core defaults to running `loop()` on core 1, which is what you want.
- PSRAM-equipped variants transparently spill large allocations off-chip. For module buffers (NeoPixel, OLED bitmaps) this means much higher per-module pixel/byte budgets than non-PSRAM ESP32s.

## Compile flag

```ini
[env:esp32s3]
platform = espressif32
board = esp32-s3-devkitc-1
framework = arduino
```

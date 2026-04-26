---
title: "ESP32-C3"
description: "ESP32-C3 board guide — single-core RISC-V with WiFi + BLE 5 in a compact package."
---

# ESP32-C3

The ESP32-C3 is the budget end of the modern ESP family: single-core RISC-V at 160 MHz, WiFi, BLE 5, and ~22 GPIOs. The RISC-V core means it doesn't share Xtensa toolchain quirks with the rest of the family — a refreshing simplification for new builds where you don't need dual cores or USB-OTG.

## Specs

| Property | Value |
|---|---|
| MCU | RISC-V single-core, 160 MHz |
| Flash | 4 MB (varies) |
| RAM | 400 KB SRAM |
| GPIO | 22 user pins |
| ADC | GPIO 0–4 (ADC1), GPIO 5 (ADC2) |
| PWM | LEDC routable to any output GPIO |
| I2C | 1 bus |
| SPI | 3 user buses (one reserved for flash) |
| UART | 2 ports |
| WiFi | 802.11 b/g/n |
| BLE | 5.0 |
| Native USB | Yes — USB-Serial-JTAG (CDC) |
| OTA | Supported |

## Flashing

USB-Serial-JTAG via the dev-kit's USB-C, or UART for first-flash. The [Playground](/playground) handles both via `esp-web-tools`. After first flash, OTA works.

## Notes

- Single-core means CONDUYT polling and WiFi share the same core. For high-bandwidth work (NeoPixel + WiFi streaming) consider the [ESP32-S3](/docs/boards/esp32-s3) instead.
- USB on the C3 is USB-Serial-JTAG — it provides JTAG debugging out of the box without an external probe.
- Strapping pins: GPIO 2, 8, 9 are the boot mode strapping pins on most C3 dev-kits. Avoid using them as plain digital pins unless you've checked the schematic.

## Compile flag

```ini
[env:esp32c3]
platform = espressif32
board = esp32-c3-devkitm-1
framework = arduino
```

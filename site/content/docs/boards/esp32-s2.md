---
title: "ESP32-S2"
description: "ESP32-S2 board guide — single-core, native USB, WiFi (no BLE), more GPIO than the original ESP32."
---

# ESP32-S2

The ESP32-S2 is the single-core sibling of the original ESP32: same Xtensa LX7 architecture but only one core, no Bluetooth, and **native USB** (no on-board USB-serial bridge needed). 43 GPIOs and a built-in temperature sensor make it a solid choice when you need lots of pins and WiFi but don't need BLE.

## Specs

| Property | Value |
|---|---|
| MCU | Xtensa LX7 single-core, 240 MHz |
| Flash | 4 MB (varies by module) |
| RAM | 320 KB SRAM |
| PSRAM | optional 2 MB |
| GPIO | 43 user pins (some reserved for strap / flash) |
| ADC | ADC1 (GPIO 1–10), ADC2 (11–20) |
| PWM | LEDC routable to any output GPIO |
| I2C | 2 buses |
| SPI | 3 user buses (FSPI / HSPI / VSPI; one pair reserved for flash) |
| UART | 2 user UARTs |
| WiFi | 802.11 b/g/n |
| BLE | **No** (S2 is WiFi-only) |
| Native USB | Yes — CDC, JTAG, MSC, etc. |
| OTA | Supported |

## Flashing

USB-OTG native or via UART. The [Playground](/playground) flashes via `esp-web-tools`, same flow as ESP32. After first flash, OTA over WiFi works.

## Notes

- No Bluetooth. If you need wireless pairing, look at the [ESP32](/docs/boards/esp32), [ESP32-S3](/docs/boards/esp32-s3), or [ESP32-C3](/docs/boards/esp32-c3) — all of those have BLE.
- Single core means there's no second core for the WiFi/IP stack to live on. Heavy CONDUYT polling + WiFi traffic share the core. Use FreeRTOS task priorities.
- GPIO 26 / 27 / 32 / 33 are commonly the strapping/flash pins on common modules — check your specific dev-board pinout before assuming a pin is free.

## Compile flag

```ini
[env:esp32s2]
platform = espressif32
board = esp32-s2-saola-1
framework = arduino
```

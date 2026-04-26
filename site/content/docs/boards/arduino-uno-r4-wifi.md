---
title: "Arduino Uno R4 WiFi"
description: "Uno R4 WiFi board guide — Renesas RA4M1, ESP32-S3 co-processor, dual I2C, USB DFU."
---

# Arduino Uno R4 WiFi

The Uno R4 WiFi pairs the same Renesas RA4M1 (Cortex-M4) as the [Minima](/docs/boards/arduino-uno-r4) with an ESP32-S3 co-processor for WiFi/BLE, and adds a Qwiic-friendly second I2C bus, a 12×8 LED matrix, and DAC on A0. CONDUYT runs on the RA4M1; the ESP32-S3 is reachable via the Arduino `WiFi`/`WiFiS3` libraries from your firmware sketch.

## Specs

| Property | Value |
|---|---|
| MCU | Renesas RA4M1 (ARM Cortex-M4), 48 MHz |
| Flash | 256 KB |
| RAM | 32 KB |
| GPIO | 20 user pins (D0–D13, A0–A5) |
| ADC | A0–A5 (A0 is also DAC-capable) |
| PWM | All D0–D13 except via timer assignment; A4/A5 also PWM-capable |
| I2C | 2 buses — Wire on A4/A5, Wire1 on the Qwiic connector |
| SPI | 1 bus — D10 (CS), D11 (COPI), D12 (CIPO), D13 (SCK) |
| UART | 1 port |
| WiFi/BLE | via on-board ESP32-S3 |
| OTA | Not currently advertised (use USB DFU) |

## Flashing

Same as the Minima: hold reset and click ▶︎ in the [Playground](/playground) — the board enters DFU mode and is flashed via WebUSB. No external programmer required.

## Notes

- A4/A5 are I2C SDA/SCL by default and shared with their analog functions. Reading analog on those pins while I2C is active will conflict.
- The ESP32-S3 co-processor is on UART internal lines and is not addressable as a CONDUYT module yet.
- The 12×8 LED matrix isn't exposed as a CONDUYT module — drive it from your sketch with the `Arduino_LED_Matrix` library.

## Compile flag

```ini
[env:uno_r4_wifi]
platform = renesas-ra
board = uno_r4_wifi
framework = arduino
```

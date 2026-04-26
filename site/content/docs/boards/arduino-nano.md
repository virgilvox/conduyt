---
title: "Arduino Nano"
description: "Classic Arduino Nano (ATmega328P) board guide — same silicon as the Uno R3 in a smaller footprint."
---

# Arduino Nano

The Arduino Nano is functionally an Uno R3 in a smaller package: same ATmega328P silicon, same 32 KB flash, same 2 KB RAM, but with a mini-USB connector and breadboard-friendly DIP pin spacing. Most clones use the CH340 USB-serial bridge, originals use the FT232.

## Specs

| Property | Value |
|---|---|
| MCU | ATmega328P, 16 MHz |
| Flash | 32 KB (0.5 KB bootloader) |
| RAM | 2 KB |
| GPIO | 14 digital (D0–D13) + 8 analog (A0–A7) |
| ADC | A0–A7 (A6/A7 are analog-only — no digital function) |
| PWM | D3, D5, D6, D9, D10, D11 |
| I2C | 1 bus — A4 (SDA), A5 (SCL) |
| SPI | 1 bus — D11 (COPI), D12 (CIPO), D13 (SCK), D10 (SS) |
| UART | 1 port — D0 (RX), D1 (TX) — used by Serial-over-USB |
| OTA | Not supported |

## Flashing

USB cable plus STK500 bootloader. Flash from the [Playground](/playground) or `pio run -t upload -e nano`. If your clone needs the `ATmegaBOOT_168_atmega328.hex` "old bootloader" set `board_upload.protocol = arduino` and `board_upload.speed = 57600` in `platformio.ini`.

## Notes

- A6 and A7 are analog-only. They cannot be used as digital pins or as I2C/SPI.
- 2 KB RAM is the same constraint as the Uno R3 — keep dynamic allocation tight, prefer `F("string literals")` for serial output.
- The Nano shares pins between the SPI and the SD-card pinout convention used by some shields. Make sure your wiring uses the right alternate function.

## Compile flag

```ini
[env:nano]
platform = atmelavr
board = nanoatmega328
framework = arduino
```

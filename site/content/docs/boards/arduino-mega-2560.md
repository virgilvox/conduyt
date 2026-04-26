---
title: "Arduino Mega 2560"
description: "Mega 2560 board guide — ATmega2560, 54 digital + 16 analog pins, 4 hardware UARTs."
---

# Arduino Mega 2560

The Mega 2560 is the AVR-family big sibling: 54 digital pins, 16 analog inputs, 256 KB flash, 8 KB RAM, and four hardware UARTs. If you've outgrown the Uno's pin count but want to stay on the AVR architecture, this is the board.

## Specs

| Property | Value |
|---|---|
| MCU | ATmega2560, 16 MHz |
| Flash | 256 KB (8 KB used by bootloader) |
| RAM | 8 KB |
| GPIO | 54 digital (D0–D53) |
| ADC | 16 analog inputs (A0–A15) |
| PWM | 15 PWM outputs (D2–D13, D44–D46) |
| I2C | 1 bus — D20 (SDA), D21 (SCL) |
| SPI | 1 bus — D50 (CIPO), D51 (COPI), D52 (SCK), D53 (SS) |
| UART | 4 ports — Serial / Serial1 (D18/D19) / Serial2 (D16/D17) / Serial3 (D14/D15) |
| OTA | Not supported (no off-chip flash) |

## Flashing

Plug into USB. The on-board ATmega16U2 acts as the USB-serial bridge and the bootloader handles uploads via STK500 protocol — same flow as the [Uno R3](/docs/boards/arduino-uno-r3). Flash from the [Playground](/playground) or `pio run -t upload -e mega2560`.

## Notes

- 8 KB of RAM is more than the Uno but still tight for ambitious projects. Watch your `String` and dynamic allocation.
- Because Serial is the host transport for CONDUYT, use Serial1/2/3 for any other UART devices you wire up.
- D13 has the on-board LED. Useful as a status indicator that doesn't conflict with anything.

## Compile flag

```ini
[env:mega2560]
platform = atmelavr
board = megaatmega2560
framework = arduino
```

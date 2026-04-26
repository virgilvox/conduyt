---
title: "Arduino Nano Every"
description: "Nano Every board guide — ATmega4809 (megaAVR-0), drop-in pin layout with 6 KB RAM."
---

# Arduino Nano Every

The Nano Every is the modern Nano: same form factor and pin layout, but with the megaAVR-0 ATmega4809 chip — 48 MHz, 48 KB flash, 6 KB RAM, faster ADC, hardware event system. It's still 5V tolerant and runs at the same 16 MHz CPU clock as the classic Nano in default Arduino mode.

## Specs

| Property | Value |
|---|---|
| MCU | ATmega4809 (megaAVR-0), 16 MHz default (48 MHz available) |
| Flash | 48 KB |
| RAM | 6 KB |
| GPIO | 14 digital (D0–D13) + 8 analog (A0–A7) |
| ADC | A0–A7 |
| PWM | D3, D5, D6, D9, D10 |
| I2C | 1 bus — A4 (SDA), A5 (SCL) |
| SPI | 1 bus — D11 (COPI), D12 (CIPO), D13 (SCK), D10 (SS) |
| UART | 1 port |
| OTA | Not supported |

## Flashing

USB-serial via the on-board nEDBG/SAMD11 chip. Flash from the [Playground](/playground) or `pio run -t upload -e nano_every`. Uploads use the JTAG2UPDI protocol — different from the classic Nano.

## Notes

- megaAVR-0 has different timer peripherals than the AVR — `Wire.h`'s `requestFrom(addr, count)` overload set differs and CONDUYT's I2C path casts the args explicitly to disambiguate.
- The on-chip MCU sigrow ID is read via the megaAVR-0 SIGROW peripheral (not classic AVR `SIGRD`/`boot_signature_byte_get`).
- 3x the RAM of the classic Nano makes module-heavy firmware (with NeoPixel buffers, OLED bitmaps, etc.) much more comfortable.

## Compile flag

```ini
[env:nano_every]
platform = atmelmegaavr
board = nano_every
framework = arduino
```

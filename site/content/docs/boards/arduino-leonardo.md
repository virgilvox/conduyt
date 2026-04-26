---
title: "Arduino Leonardo"
description: "Leonardo board guide — ATmega32U4, native USB-HID for keyboard/mouse emulation."
---

# Arduino Leonardo

The Leonardo's distinguishing trait is the ATmega32U4: the MCU and the USB controller are the same chip. That means it can present itself as a USB keyboard, mouse, MIDI device, or composite device — useful for HID-style projects layered on top of CONDUYT serial.

## Specs

| Property | Value |
|---|---|
| MCU | ATmega32U4, 16 MHz |
| Flash | 32 KB (4 KB bootloader) |
| RAM | 2.5 KB |
| GPIO | 20 digital (D0–D13, A0–A5) + interior pins |
| ADC | A0–A5 plus A6–A11 on D4, D6, D8, D9, D10, D12 |
| PWM | D3, D5, D6, D9, D10, D11, D13 |
| I2C | 1 bus — D2 (SDA), D3 (SCL) |
| SPI | 1 bus — D14 (CIPO), D15 (SCK), D16 (COPI) — on the ICSP header |
| UART | Serial1 on D0/D1 (Serial is the USB-virtual port) |
| OTA | Not supported |

## Flashing

USB plug + auto-reset. Note the bootloader window is shorter than the Uno's (~750 ms) — if uploads fail intermittently, double-tap the reset button to force the bootloader, then flash. Flash from the [Playground](/playground) or `pio run -t upload -e leonardo`.

## Notes

- `Serial` is the USB CDC virtual port. CONDUYT uses this for transport, but it remains "fully open" only after the host opens it — `if (!Serial)` is a real check on this board.
- I2C lives on D2/D3, not the analog pins. Keyboard/mouse libraries use D2 (`PCINT`) — be aware of conflicts.
- A6–A11 (analog inputs on certain digital pins) can be useful when you need extra ADC channels but the docs name them inconsistently.

## Compile flag

```ini
[env:leonardo]
platform = atmelavr
board = leonardo
framework = arduino
```

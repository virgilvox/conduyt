---
title: "Teensy 3.6"
description: "Teensy 3.6 board guide — ARM Cortex-M4F at 180 MHz, 1 MB flash, microSD slot."
---

# Teensy 3.6

The Teensy 3.6 is the last of the K66-based Teensies before PJRC moved to the IMXRT family on the 4.x line. Cortex-M4F at 180 MHz (overclockable to 240), 1 MB flash, 256 KB RAM, an on-board microSD slot, and 6 hardware UARTs. If you have one already, it's a great CONDUYT host. For new builds, look at the [Teensy 4.0](/docs/boards/teensy-4-0) or [4.1](/docs/boards/teensy-4-1) — they're faster, cheaper, and currently in production.

## Specs

| Property | Value |
|---|---|
| MCU | NXP K66 Cortex-M4F, 180 MHz |
| Flash | 1 MB |
| RAM | 256 KB |
| GPIO | 62 (most expose digital + PWM + analog) |
| ADC | 25 analog input pins, two 16-bit ADCs |
| DAC | 2 channels (A21, A22) |
| PWM | 22 pins via FlexTimer/Timer0 |
| I2C | 4 buses (Wire / Wire1 / Wire2 / Wire3) |
| SPI | 3 buses |
| UART | 6 hardware UARTs |
| Native USB | Yes — high-speed, supports HID, MIDI, Audio, MSC composites |
| microSD | On-board, 4-bit SDIO |
| OTA | Not supported (no off-chip flash, no DFU bootloader by default) |

## Flashing

Teensy uses its own bootloader and the `teensy_loader_cli` (or `teensy.exe` GUI). PlatformIO handles it transparently — `pio run -t upload -e teensy36`. The [Playground](/playground) does not currently support browser flashing for Teensies (no DFU/STK500 — proprietary HID-based protocol).

## Notes

- Teensy 3.6 is **discontinued** by PJRC. Available in the wild but no new stock direct from Sparkfun/Adafruit.
- 6 UARTs and 4 I2C buses make it the most port-rich AVR/ARM Arduino-compatible. Useful when you're routing many independent peripherals.
- DAC outputs (A21, A22) are real DACs — analogWrite to those pins outputs an analog voltage, not PWM.
- Floating-point hardware (FPU) means the on-device PID module runs comfortably at high tick rates here.

## Compile flag

```ini
[env:teensy36]
platform = teensy
board = teensy36
framework = arduino
```

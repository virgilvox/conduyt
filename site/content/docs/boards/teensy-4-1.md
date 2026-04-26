---
title: "Teensy 4.1"
description: "Teensy 4.1 board guide — Cortex-M7 at 600 MHz with Ethernet, microSD, and 8 MB optional PSRAM."
---

# Teensy 4.1

The Teensy 4.1 is the bigger sibling of the [4.0](/docs/boards/teensy-4-0): same 600 MHz IMXRT1062 chip, but in a longer form factor with on-board 100 Mbps Ethernet PHY pads, microSD card slot, USB-host pins, and footprints for up to 16 MB of additional PSRAM and 16 MB of QSPI flash. If you need wired networking on a Teensy or you're streaming a lot of data, this is the one.

## Specs

| Property | Value |
|---|---|
| MCU | NXP IMXRT1062 Cortex-M7, 600 MHz, FPU |
| Flash | 8 MB on-chip |
| RAM | 1 MB on-chip + up to 16 MB optional PSRAM |
| GPIO | 55 (digital), 42 broken out on the Teensy 4.1 board edges |
| ADC | 18 analog input pins |
| PWM | 35 PWM-capable pins |
| I2C | 3 buses |
| SPI | 3 buses |
| UART | 8 hardware UARTs |
| Ethernet | On-board RMII pads (add a magjack) — 100 Mbps |
| microSD | On-board, 4-bit SDIO |
| Native USB | Yes — 480 Mbps high-speed |
| USB Host | Yes — for USB MIDI, HID, etc. |
| OTA | Not supported |

## Flashing

Same flow as the [Teensy 4.0](/docs/boards/teensy-4-0) — `teensy_loader_cli` via PlatformIO. The [Playground](/playground) does not currently support browser flashing for Teensies.

## Notes

- The Ethernet PHY is on-board but you still need an external magjack and a few passives to make it usable. The Teensy 4.1 schematic has the recommended layout.
- 16 MB PSRAM (footprint-equipped, you solder it on) gives you absurd headroom for buffers — useful for large NeoPixel strips, image buffers, etc.
- 8 hardware UARTs is the highest count of any Arduino-compatible board. Useful when you're aggregating data from many sensors and don't want software-serial timing jitter.
- USB Host pins let you act as the USB controller for downstream devices (MIDI controllers, keyboards). The CONDUYT serial transport uses the standard USB-CDC port — these are separate.

## Compile flag

```ini
[env:teensy41]
platform = teensy
board = teensy41
framework = arduino
```

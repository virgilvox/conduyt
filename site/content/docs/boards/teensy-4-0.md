---
title: "Teensy 4.0"
description: "Teensy 4.0 board guide — Cortex-M7 at 600 MHz, the fastest Arduino-compatible board out there."
---

# Teensy 4.0

The Teensy 4.0 jumped to the NXP IMXRT1062 — Cortex-M7 at 600 MHz — making it the fastest Arduino-compatible board on the market. 2 MB flash, 1 MB RAM, hardware FPU, and 24 PWM-capable pins in a board the size of a USB stick. CONDUYT runs comfortably on it with massive headroom for module work and high-frequency datastreams.

## Specs

| Property | Value |
|---|---|
| MCU | NXP IMXRT1062 Cortex-M7, 600 MHz, FPU |
| Flash | 2 MB |
| RAM | 1 MB (split: 512 KB tightly-coupled + 512 KB OCRAM) |
| GPIO | 40 |
| ADC | 14 analog input pins, two 12-bit ADCs |
| PWM | 31 PWM-capable pins |
| I2C | 3 buses (Wire / Wire1 / Wire2) |
| SPI | 3 buses |
| UART | 7 hardware UARTs |
| Native USB | Yes — 480 Mbps high-speed |
| OTA | Not supported (proprietary bootloader, no DFU) |

## Flashing

Same as the [Teensy 3.6](/docs/boards/teensy-3-6) — `teensy_loader_cli` via `pio run -t upload -e teensy40`. The [Playground](/playground) does not currently support browser flashing for Teensies.

## Notes

- 600 MHz is fast enough to run software DSP, audio mixing, or many simultaneous modules without breaking a sweat.
- Two RAM regions: TCM (tightly-coupled, 512 KB, single-cycle) is the default for code and stacks. OCRAM (512 KB) is on-chip but cached. Big buffers default to OCRAM.
- The IMXRT1062 has hardware crypto (AES, hash) you can reach via the Teensy core libraries if your application needs it.
- The on-chip MCU unique ID is read via the OCOTP fuse bank — the firmware does this transparently for `HELLO_RESP`.

## Compile flag

```ini
[env:teensy40]
platform = teensy
board = teensy40
framework = arduino
```

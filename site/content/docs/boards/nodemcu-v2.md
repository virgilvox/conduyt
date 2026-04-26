---
title: "NodeMCU v2 (ESP8266)"
description: "NodeMCU v2 board guide — ESP8266, WiFi-only, classic Lua/Arduino dev-kit on a budget."
---

# NodeMCU v2 (ESP8266)

The NodeMCU v2 is the ESP8266 dev-kit that put WiFi on every project: cheap, ubiquitous, WiFi-only (no BLE), with enough GPIO and I2C for most CONDUYT module use cases. The protocol works the same as on the ESP32, just without BLE/MQTT-bridge transports.

## Specs

| Property | Value |
|---|---|
| MCU | Tensilica L106, 80 MHz (160 MHz overclock supported) |
| Flash | 4 MB |
| RAM | 80 KB |
| GPIO | 11 usable pins (D0–D10 on the board, with caveats) |
| ADC | 1 channel (A0, 10-bit, max ~1V or 3.3V depending on resistor divider) |
| PWM | Software PWM on any output pin (no hardware PWM peripheral) |
| I2C | Software-bit-banged (Wire library) — typically D1 (SCL) / D2 (SDA) |
| SPI | 1 user-accessible HSPI bus |
| UART | 1 hardware UART (Serial); Serial1 is TX-only |
| WiFi | 802.11 b/g/n |
| BLE | **No** |
| OTA | Supported (via ArduinoOTA library) |

## Flashing

USB-serial via the on-board CP2102. The [Playground](/playground) flashes via `esp-web-tools`. First flash needs the bootloader to enter; after that, OTA over WiFi is the easy path.

## Notes

- Only one ADC, max 1V at the chip — most boards include a resistor divider so the visible A0 pin tolerates 3.3V.
- D8 / GPIO15 must be LOW at boot; D3 / GPIO0 must be HIGH at boot. If you wire those pins to active-driven peripherals, the board may not boot.
- "Software" PWM means PWM frequency tops out around a few kHz before timing jitters — fine for LEDs and servos, not great for motor speed control.
- ESP8266 has tighter RAM than ESP32. Watch your dynamic allocations and prefer `PROGMEM` for large constants.

## Compile flag

```ini
[env:nodemcuv2]
platform = espressif8266
board = nodemcuv2
framework = arduino
```

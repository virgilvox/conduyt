---
title: "ESP32"
description: "ESP32 board guide - WiFi, BLE, MQTT, OTA, and all CONDUYT transports."
---

# ESP32

The ESP32 is the most fully-featured CONDUYT target. It supports every transport (Serial, BLE, MQTT, TCP, WebSocket) and has WiFi for networked projects.

## Specs

| Property | Value |
|----------|-------|
| MCU | Xtensa LX6, dual-core, 240 MHz |
| Flash | 4 MB |
| RAM | 520 KB SRAM |
| GPIO | 34 pins |
| ADC | 18 channels (12-bit) |
| PWM | 16 channels |
| I2C | 2 buses |
| SPI | 3 buses |
| UART | 3 ports |
| WiFi | 802.11 b/g/n (2.4 GHz only) |
| BLE | 4.2 |
| OTA | Supported |

## Firmware setup

### PlatformIO

```ini
; platformio.ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
lib_deps = conduyt
```

```bash
pio run --target upload
```

### Arduino IDE

1. Go to **File → Preferences**
2. In **Additional Board Manager URLs**, add:
   ```
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```
3. Go to **Tools → Board → Boards Manager**, search for **esp32**, and install the **ESP32** package by Espressif
4. Select **ESP32 Dev Module** from **Tools → Board → ESP32 Arduino**
5. Select your port from **Tools → Port**
6. Click Upload

## Transports

The ESP32 supports all CONDUYT transports. Pick the one that fits your project:

```cpp
// USB Serial (simplest - just plug in)
ConduytSerial transport(Serial, 115200);

// Bluetooth Low Energy (wireless, no network needed)
#define CONDUYT_TRANSPORT_BLE
ConduytBLE transport("MyDevice");

// MQTT over WiFi (networked, needs a broker)
#define CONDUYT_TRANSPORT_MQTT
#include <WiFi.h>
#include <PubSubClient.h>
WiFiClient wifi;
PubSubClient mqtt(wifi);
ConduytMQTT transport(mqtt, "device-001");

// TCP over WiFi (direct network connection, no broker)
#include <WiFi.h>
WiFiServer server(3333);
ConduytTCP transport(server);
```

See the transport-specific guides for full setup:
- [Connect over Serial](/docs/how-to/connect-serial)
- [Connect over BLE](/docs/how-to/connect-ble)
- [Connect over MQTT](/docs/how-to/connect-mqtt)

## Built-in LED

**Pin 2** on most ESP32 dev boards (DevKitC, NodeMCU-32S, DOIT). Some boards differ:

- **ESP32-S3** - uses an addressable RGB NeoPixel instead of a simple LED
- **ESP32-C3** - pin 8 on some boards

If in doubt, check your board's pinout diagram.

## Browser flashing

Go to the [Playground](/playground), click **Flash**, select **ESP32**, and click **Install CONDUYT Firmware**. The web flasher auto-detects your chip variant and handles bootloader, partitions, and firmware.

Some boards require holding the **BOOT** button during flashing. If the flash fails, hold BOOT, click Flash again, and release BOOT after flashing starts.

## OTA updates

Enable over-the-air firmware updates by adding the build flag:

```ini
build_flags = -DCONDUYT_OTA
```

The host can then push new firmware using `OTA_BEGIN`, `OTA_CHUNK`, and `OTA_FINALIZE` commands.

## Common issues

- **Upload fails:** Hold the **BOOT** button while clicking Upload. Release after the upload starts. Some boards auto-reset, others don't.
- **WiFi won't connect:** The ESP32 only supports **2.4 GHz** networks. 5 GHz SSIDs are invisible to it. Also verify SSID and password are correct (case-sensitive).
- **BLE disconnects when WiFi is active:** BLE and WiFi share the same 2.4 GHz radio. Running both simultaneously can cause instability. Pick one transport per project when possible.
- **Inaccurate analog readings:** The ESP32's 12-bit ADC has known nonlinearity issues. For precision measurements, use an external ADC (ADS1115, MCP3008).
- **GPIO 6-11:** These are connected to the internal SPI flash. Do not use them as GPIO - it will crash the board.

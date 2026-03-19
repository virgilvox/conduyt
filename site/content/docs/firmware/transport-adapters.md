---
title: Transport Adapters
description: Available transport layers for CONDUYT firmware
---

# Transport Adapters

CONDUYT is transport-agnostic. The same binary protocol works over any of these:

## Available Transports

| Transport | Class | COBS | Platform | Include Guard |
|---|---|---|---|---|
| Serial (UART/USB) | `ConduytSerial` | Yes | All | — (default) |
| USB CDC | `ConduytUSBSerial` | Yes | RP2040, SAMD, nRF52 | — |
| MQTT | `ConduytMQTT` | No | ESP32, ESP8266 | `CONDUYT_TRANSPORT_MQTT` |
| BLE (NUS) | `ConduytBLE` | Yes | ESP32, nRF52 | `CONDUYT_TRANSPORT_BLE` |
| TCP Server | `ConduytTCP` | No | ESP32, ESP8266 | `CONDUYT_TRANSPORT_TCP` |
| CLASP | `ConduytCLASP` | Yes | ESP32 | `CONDUYT_TRANSPORT_CLASP` |

## Serial (Default)

```cpp
ConduytSerial transport(Serial, 115200);
ConduytDevice device("MyBoard", "1.0.0", transport);
```

## MQTT

```cpp
#define CONDUYT_TRANSPORT_MQTT
#include <Conduyt.h>

WiFiClient wifiClient;
ConduytMQTT transport(wifiClient, "broker.local", 1883, "device-001");
ConduytDevice device("MQTTBoard", "1.0.0", transport);
```

Topics follow the pattern `conduyt/{deviceId}/cmd` and `conduyt/{deviceId}/evt/{typeHex}`.

## BLE

```cpp
#define CONDUYT_TRANSPORT_BLE
#include <Conduyt.h>

ConduytBLE transport("MyConduytDevice");
ConduytDevice device("BLEBoard", "1.0.0", transport);
```

Uses Nordic UART Service (NUS) UUIDs. COBS framing handles packet boundaries within BLE characteristic writes.

## COBS Framing

Serial and BLE transports use COBS (Consistent Overhead Byte Stuffing) to frame packets. COBS ensures 0x00 never appears in the encoded data, so 0x00 serves as a reliable packet delimiter.

TCP and MQTT transports don't need COBS — TCP has stream semantics with length-prefixed reads, and MQTT delivers discrete messages.

The `needsCOBS` flag on each transport tells `ConduytDevice` whether to apply COBS encoding/decoding.

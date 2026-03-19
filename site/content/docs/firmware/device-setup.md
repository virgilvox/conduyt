---
title: Device Setup
description: Setting up CONDUYT firmware on your microcontroller
---

# Device Setup

## Minimal Sketch

```cpp
#include <Conduyt.h>

ConduytSerial  transport(Serial, 115200);
ConduytDevice  device("MyBoard", "1.0.0", transport);

void setup() {
  device.begin();
}

void loop() {
  device.poll();  // non-blocking, one packet per call
}
```

That's it. The device will respond to HELLO, PING, and all pin control commands.

## Adding Modules

Enable modules with `#define` before including Conduyt.h:

```cpp
#define CONDUYT_MODULE_SERVO
#define CONDUYT_MODULE_NEOPIXEL
#include <Conduyt.h>

ConduytSerial  transport(Serial, 115200);
ConduytDevice  device("MyBoard", "1.0.0", transport);

void setup() {
  device.addModule(new ConduytModuleServo());
  device.addModule(new ConduytModuleNeoPixel());
  device.begin();
}
```

## Adding Datastreams

Datastreams are named, typed channels for higher-level data:

```cpp
device.addDatastream("temperature", CONDUYT_FLOAT32, "celsius", false);  // read-only
device.addDatastream("setpoint",    CONDUYT_FLOAT32, "celsius", true);   // writable

// Handle writes from the host
device.onDatastreamWrite("setpoint", [](ConduytPayloadReader &payload, ConduytContext &ctx) {
  float val = payload.readFloat32();
  pid.setTarget(val);
  ctx.ack();
});

// Push values from the device
void loop() {
  device.poll();
  if (tempTimer.elapsed()) {
    device.writeDatastream("temperature", sensor.readTemp());
  }
}
```

## Supported Boards

CONDUYT auto-detects your board and configures memory limits:

| Board | RAM Budget | Max Modules | Max Subs | Max Datastreams |
|---|---|---|---|---|
| ATmega328 (Uno) | 128B buf | 4 | 8 | 4 |
| ESP32 | 512B buf | 8 | 16 | 16 |
| ESP8266 | 512B buf | 8 | 16 | 16 |
| nRF52 | 512B buf | 8 | 16 | 16 |
| RP2040 (Pico) | 512B buf | 8 | 16 | 16 |
| STM32 | 512B buf | 8 | 16 | 16 |
| SAMD | 256B buf | 6 | 12 | 8 |
| Teensy | 512B buf | 8 | 16 | 16 |

All limits are overridable via `#define` before including Conduyt.h.

## Transport Options

```cpp
// Serial (all boards)
ConduytSerial transport(Serial, 115200);

// MQTT (ESP32/8266 with WiFi)
WiFiClient wifi;
ConduytMQTT transport(wifi, "mqtt://broker.local", 1883, "my-device");

// BLE (ESP32)
ConduytBLE transport("CONDUYT-Device");

// TCP (any board with Client)
WiFiClient client;
ConduytTCP transport(client, "192.168.1.100", 3000);
```

The transport accepts any Arduino `Client&` — your networking hardware is irrelevant to the protocol.

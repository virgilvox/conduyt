---
title: What is Conduyt?
description: A deep dive into the CONDUYT protocol architecture, core concepts, and design philosophy.
---

# What is Conduyt?

CONDUYT is a binary protocol that lets you control microcontrollers from a host computer. You flash a firmware library onto a board, then talk to it from JavaScript, Python, Go, Rust, or Swift over any transport — USB serial, BLE, MQTT, WebSocket, or TCP.

This page walks through the architecture and core concepts. If you want to jump straight to code, try the [Playground Quick Start](/docs/getting-started/quickstart-playground) or the [Arduino IDE Quick Start](/docs/getting-started/quickstart-arduino-ide).

## Architecture

Every CONDUYT system has two halves:

```
┌──────────────┐                    ┌──────────────┐
│  Host (PC)   │  binary packets    │   Device     │
│              │ ◄────────────────► │  (Arduino)   │
│  JS / Python │   over serial,     │              │
│  Go / Rust   │   BLE, MQTT, etc.  │  C++ firmware │
└──────────────┘                    └──────────────┘
```

**Device side** — An Arduino sketch includes the CONDUYT library, picks a transport, and calls `device.begin()` / `device.poll()`. That is the entire firmware. The library handles pin control, module dispatch, capability reporting, and packet parsing.

**Host side** — Your application imports an SDK, opens a transport, and sends commands. The SDK handles packet encoding, CRC validation, sequence tracking, and capability discovery. You work with high-level abstractions like `device.pin(13).write(1)`.

**The wire** — A compact binary protocol. Fixed 8-byte header, CRC8 integrity check, optional COBS framing on byte-stream transports. A complete PIN_WRITE command is 10 bytes. See [Why Binary](/docs/concepts/why-binary) for the rationale.

## Transports

A transport is the physical channel between host and device. The protocol is identical across all transports — swap the wire, keep your application code.

**Firmware picks a transport class:**

```cpp
ConduytSerial transport(Serial, 115200);                          // USB
ConduytBLE    transport("MyDevice");                              // Bluetooth
ConduytMQTT   transport(wifi, "broker", 1883, "device-001");     // WiFi
```

**Host picks a matching one:**

```javascript
new SerialTransport({ path: '/dev/ttyUSB0' })   // USB serial
new BLETransport()                               // Web Bluetooth
new MQTTTransport({ broker: 'mqtt://...' })      // MQTT
```

The transport handles framing differences transparently. Serial and BLE use COBS encoding. MQTT and WebSocket are message-oriented and skip framing entirely. See [Transport Architecture](/docs/concepts/transport-architecture) for the details.

## Capabilities

When the host connects, the device sends a HELLO_RESP packet describing itself:

- How many pins it has and what each pin supports (digital in/out, analog, PWM, I2C, SPI, interrupts)
- Which modules are loaded (servo, NeoPixel, DHT, etc.)
- Which datastreams are declared (named typed channels)
- Maximum payload size, firmware name, firmware version

The SDK parses this into a capabilities object and validates every operation before sending. Request PWM on a digital-only pin? The SDK throws immediately, no round trip wasted. See [Capability Model](/docs/concepts/capability-model).

## Modules

Modules are opt-in firmware plugins for specific hardware. Servos, NeoPixel LED strips, DHT temperature sensors, OLED displays, stepper motors, PID controllers.

```cpp
// Firmware: enable and register
#define CONDUYT_MODULE_SERVO
#include <Conduyt.h>

device.addModule(new ConduytModuleServo());
```

```javascript
// Host: use the discovered module
const servo = new ConduytServo(device)
await servo.attach(9)
await servo.write(90)
```

The host discovers modules automatically through the capability handshake — no hardcoding. You can also [write your own modules](/docs/how-to/add-module) for custom hardware.

## Datastreams

Datastreams are named, typed data channels for application-level data. A temperature sensor publishes a `float32` called `"temperature"` with unit `"celsius"`. A thermostat exposes a writable `"setpoint"` channel.

```cpp
// Firmware: declare and push
device.addDatastream("temperature", CONDUYT_TYPE_FLOAT32, "celsius", false);
device.writeDatastream("temperature", 22.5f);
```

```javascript
// Host: subscribe to updates
for await (const value of device.datastream('temperature').subscribe()) {
  console.log('Temperature:', value)
}
```

Use pins for GPIO (on/off, PWM, analog reads). Use datastreams for structured application data. See [Use Datastreams](/docs/how-to/use-datastreams) for the full guide.

## Next steps

- [Quick Start: Playground](/docs/getting-started/quickstart-playground) — flash and control a board from your browser in 2 minutes
- [Quick Start: Arduino IDE](/docs/getting-started/quickstart-arduino-ide) — local setup with Arduino IDE and Node.js in 5 minutes
- [Sensor Dashboard](/docs/tutorials/sensor-dashboard) — wire a DHT22, use the module system, read from Python

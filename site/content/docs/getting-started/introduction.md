---
title: Introduction
description: What is CONDUYT and why does it exist
---

# Introduction

Conduyt is an open binary protocol and firmware library for extending hardware control from a host to a connected microcontroller device.

## What It Replaces

| Protocol | Year | Problem |
|---|---|---|
| Firmata | 2006 | Pseudo-binary MIDI encoding, serial-only, no real capability negotiation |
| Johnny-Five | 2012 | Great host SDK, but inherits all Firmata limitations, Node.js only |
| Blynk 2.0 | 2021 | Solved the right problems, but proprietary cloud required |

## Core Principles

- **Transport Agnostic** — Same binary framing over serial, BLE, MQTT, WebSocket, or CLASP
- **Capability First** — Device speaks first. HELLO_RESP is the source of truth
- **Lightweight Binary** — No JSON on the MCU. 8 bytes overhead per packet
- **Module System** — Servo, NeoPixel, OLED as opt-in firmware plugins
- **No Cloud Dependency** — Self-hostable. Auth is the broker's problem

## Quick Example

### Arduino Firmware

```cpp
#include <Conduyt.h>

ConduytSerial  transport(Serial, 115200);
ConduytDevice  device("MyBoard", "1.0.0", transport);

void setup() { device.begin(); }
void loop()  { device.poll();  }
```

### JavaScript Host

```js
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'

const device = await ConduytDevice.connect(
  new SerialTransport({ path: '/dev/ttyUSB0' })
)

await device.pin(13).mode('output')
await device.pin(13).write(1)  // LED on
```

## SDKs

| SDK | Language | Install |
|---|---|---|
| conduyt-firmware | Arduino / C++ | `#include <Conduyt.h>` |
| [conduyt-js](https://www.npmjs.com/package/conduyt-js) | JavaScript / TypeScript | `npm install conduyt-js` |
| [conduyt-py](https://pypi.org/project/conduyt-py/) | Python 3.10+ | `pip install conduyt-py` |
| [conduyt/sdk/go](https://github.com/virgilvox/conduyt/tree/main/sdk/go) | Go | `go get github.com/virgilvox/conduyt/sdk/go` |
| [conduyt](https://crates.io/crates/conduyt) | Rust | `cargo add conduyt` |
| ConduytKit | Swift | `.package(url: "https://github.com/virgilvox/conduyt")` |

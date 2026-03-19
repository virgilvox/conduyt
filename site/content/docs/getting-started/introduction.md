---
title: Introduction
description: What is CONDUYT and why does it exist
---

# Introduction

CONDUYT (**G**eneric **R**emote **A**ctuator **F**irmware **T**ransport) is an open binary protocol and firmware library for extending hardware control from a host to a connected microcontroller device.

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
| conduyt-js | JavaScript / TypeScript | `npm install conduyt-js` |
| conduyt-py | Python 3.10+ | `pip install conduyt-py` |
| conduyt-go | Go | `go get github.com/conduyt-io/conduyt-go` |
| conduyt-rs | Rust | `cargo add conduyt` |
| ConduytKit | Swift | `.package(url: "github.com/conduyt-io/ConduytKit")` |

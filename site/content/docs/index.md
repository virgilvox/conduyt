---
title: CONDUYT Documentation
description: Learn how to control microcontrollers from any language using the CONDUYT binary protocol.
---

# CONDUYT Documentation

CONDUYT is a binary protocol for controlling microcontrollers from a host computer. Flash a firmware library onto your board, then write code in JavaScript, Python, Go, Rust, or Swift to control it over serial, BLE, MQTT, or any transport.

## How it works

```
┌──────────────┐                    ┌──────────────┐
│  Host (PC)   │  binary packets    │   Device     │
│              │ ◄────────────────► │  (Arduino)   │
│  JS / Python │   over serial,     │              │
│  Go / Rust   │   BLE, MQTT, etc.  │  C++ firmware │
└──────────────┘                    └──────────────┘
```

The **device** runs a small firmware sketch - just `device.begin()` and `device.poll()`. It handles pin control, modules, and protocol logic.

The **host** imports an SDK, connects over any transport, and sends commands: toggle pins, read sensors, control servos. The SDK handles packet encoding, CRC validation, and capability discovery.

Between them is a compact binary protocol. Fixed 8-byte headers, CRC8 checksums, COBS framing on serial. A complete "turn on LED" command is 10 bytes.

## Pick a starting point

### Try it in your browser

The [Playground](/playground) lets you flash firmware, write code, and control hardware entirely from a Chromium browser. No installs required.

[Open the Playground &rarr;](/playground)

### Set up locally

| Path | Toolchain | Time |
|------|-----------|------|
| [Quick Start: Arduino IDE](/docs/getting-started/quickstart-arduino-ide) | Arduino IDE 2 + Node.js | ~5 min |
| [Quick Start: PlatformIO](/docs/tutorials/first-blink) | VS Code + PlatformIO + Node.js | ~10 min |
| [Quick Start: Playground](/docs/getting-started/quickstart-playground) | Chrome/Edge browser only | ~2 min |

## Core concepts

**Transports** - Serial, BLE, MQTT, WebSocket, TCP. Same protocol, same packets. Swap the wire, keep the code.

**Capabilities** - On connect, the device describes itself: pin count, pin modes, loaded modules, declared datastreams, firmware version. The SDK validates operations before sending.

**Modules** - Opt-in firmware plugins for servos, NeoPixels, DHT sensors, and more. Enable with a compile flag, register in your sketch, and the host discovers them automatically.

**Datastreams** - Named, typed data channels for application-level data. Temperature readings, setpoints, status indicators. Read, write, and subscribe by name.

## How it compares

Conduyt draws inspiration from projects like Firmata, Johnny-Five, and Blynk, and takes a different approach:

| Protocol | Year | Approach | CONDUYT's approach |
|----------|------|----------|-------------------|
| Firmata | 2006 | MIDI encoding, serial only | Binary packets, any transport |
| Johnny-Five | 2012 | Node.js, built on Firmata | Five SDKs, native binary protocol |
| Blynk 2.0 | 2021 | Cloud-dependent architecture | Self-hostable, no cloud required |

## How these docs are organized

- **Getting Started** - Quick starts for every toolchain. Pick one and go.
- **Tutorials** - Step-by-step projects that teach the protocol through building.
- **Boards** - Per-board setup, specs, transport support, and known issues.
- **Modules** - Servo, NeoPixel, DHT - firmware setup and host SDK usage.
- **SDKs & APIs** - Full API reference for each language SDK.
- **How-To Guides** - Targeted recipes: connecting over a specific transport, writing modules, managing brokers.
- **Reference** - Wire format, packet types, error codes, datastream types.
- **Concepts** - Design decisions: why binary, how transports work, capability negotiation.

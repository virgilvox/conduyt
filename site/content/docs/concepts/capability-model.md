---
title: "The Capability Model"
description: "How Conduyt devices self-describe their hardware"
---

# The Capability Model

Conduyt devices describe themselves. On connection, the host sends a HELLO packet (type 0x02). The device responds with HELLO_RESP (type 0x81) containing a complete description of its hardware and loaded software. The host SDK parses this response and uses it to validate every subsequent operation.

## What HELLO_RESP contains

The HELLO_RESP payload includes:

- **Pin count and per-pin capabilities**: a bitmask for each pin indicating which modes it supports (digital input, digital output, PWM, analog input, I2C, SPI, interrupt).
- **Bus counts**: number of I2C, SPI, and UART buses available.
- **Loaded modules**: each module's name, version, and claimed pins.
- **Declared datastreams**: each datastream's name, type, unit, writability flag, and retain flag.
- **Max payload size**: the largest payload the device can handle in a single packet.
- **Firmware name and version**: identifies the firmware running on the device.
- **MCU ID**: a unique identifier for the physical microcontroller.
- **OTA capability flag**: whether the device supports over-the-air firmware updates.

This is not a summary or a hint. It is the complete picture.

## Validation at the source

The host SDK parses HELLO_RESP into a structured capabilities object that applications and tooling can introspect. The structured form is exposed as `device.capabilities` (TypeScript: `HelloResp`) and includes every pin's capability bitmask, every datastream, every module, and the bus counts. Tools like the [Playground Panel](/docs/getting-started/panel) use it to filter widget pin dropdowns to compatible pins only.

The SDK also throws `ConduytCapabilityError` for the cases it can validate cheaply at call time — datastream lookups by name, module lookups by name, and I2C bus index out of range. Pin-level validation in the SDK is not yet enforced; the firmware backstops invalid pin requests instead (see below). If you want strict pin validation in your application, read `device.capabilities.pins[N].capabilities` and check the bit yourself before issuing the command.

The firmware always validates pin operations against its own canonical board profile and replies with a `PIN_MODE_UNSUPPORTED` NAK rather than touching unsafe hardware. The most consequential example: on the Renesas RA4M1 (Uno R4), `analogRead` on a non-ADC pin would otherwise block the firmware indefinitely waiting on a conversion that never completes. The firmware-side guard makes that unreachable.

## Where the per-board capability data comes from

Each supported board has a profile in `protocol/boards/<id>.yml` that names every pin and lists its capabilities, ADC channel, and bus assignments. Each silicon family has a profile in `protocol/mcus/<family>.yml` describing the chip itself (resolution, MCU-ID source). At firmware build time, the codegen turns these into a single `board_profiles_generated.h` that the firmware library compiles against. Adding a new board is one YAML file — no firmware code change.

Sketches that run on hardware the library doesn't ship a profile for, or that wire custom shields that change a pin's role, can override individual pins before `device.begin()`:

```cpp
device.declarePinCaps(8, CONDUYT_PIN_CAP_DIGITAL_OUT | CONDUYT_PIN_CAP_PWM_OUT);
device.declareI2cBus(1, /*sda*/ 27, /*scl*/ 26);   // Qwiic header on R4 WiFi, etc.
device.declareSpiBus(0, /*cs*/ 10, /*copi*/ 11, /*cipo*/ 12, /*sck*/ 13);
```

These overrides are merged into HELLO_RESP at handshake time, so the host SDK sees them like any other profile data.

## Contrast with Firmata

Firmata defines a CAPABILITY_QUERY message that serves a similar purpose. In practice, most Firmata host libraries hardcode the Arduino Uno pin map. When you connect a different board (a Mega, an ESP32, a Teensy), the host library guesses wrong. Pins are mapped incorrectly, capabilities are assumed rather than queried, and debugging requires cross-referencing datasheets with library source code.

Conduyt makes the device the single source of truth. The firmware running on the device knows its own hardware. The host asks and trusts the answer. No device databases, no board definition files, no guessing.

## Module discovery

Each loaded module appears in HELLO_RESP with its name, version, and the pins it has claimed. When the host connects to a device running a motor driver module and a NeoPixel module, the capabilities object reflects both. The host SDK can enumerate available modules, check their versions, and determine which pins are under module control, all without configuration files.

This is relevant for generic tools. A dashboard application connecting to an unknown device can inspect its modules and render appropriate controls. A CLI tool can list loaded modules without prior knowledge of the firmware.

## Datastream discovery

Each declared datastream appears in HELLO_RESP with its name, type, unit, writability flag, and retain flag. The host knows the type of every datastream at connection time, not at the point where data arrives.

A temperature datastream declared as `float32` with unit `"C"` tells the host SDK everything it needs: how to decode the payload bytes, what the values represent, and what unit to display. A writable datastream declared as `uint8` tells the host it can send values, and that those values are single unsigned bytes.

The retain flag indicates whether the device stores the last value and replays it on connection. This maps naturally to MQTT retained messages when the transport is MQTT.

## Multi-device setups

A host managing 10 different boards queries each one on connection and adapts its behavior per device. Board A has 14 digital pins and a servo module. Board B has 40 pins, three I2C buses, and a datastream publishing accelerometer readings. Board C is an ESP32 with WiFi and OTA support.

No central configuration file maps device IDs to capabilities. Each device carries its own description. Adding a new device to the system requires connecting it. The host learns what it can do by asking.

## OTA capability

HELLO_RESP includes an `ota_capable` bit. The host SDK checks this flag before attempting a firmware update. Devices that do not support OTA (a bare ATmega328 on a serial link, for example) report this upfront. The host does not waste time initiating an update sequence that will fail.

## SDK differences

The JavaScript, Python, and Go SDKs parse HELLO_RESP into typed capability objects with accessor methods for pins, modules, datastreams, and device metadata.

The Rust SDK takes a different approach: `connect()` returns `Vec<u8>` containing the raw HELLO payload. Parsing is left to the caller. This reflects Rust's preference for zero-cost abstractions and gives callers control over allocation and error handling. A parsing utility is available but not mandatory.

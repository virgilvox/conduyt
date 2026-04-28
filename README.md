# CONDUYT

[![Firmware CI](https://github.com/virgilvox/conduyt/actions/workflows/firmware-ci.yml/badge.svg)](https://github.com/virgilvox/conduyt/actions/workflows/firmware-ci.yml)
[![JS CI](https://github.com/virgilvox/conduyt/actions/workflows/js-ci.yml/badge.svg)](https://github.com/virgilvox/conduyt/actions/workflows/js-ci.yml)
[![Python CI](https://github.com/virgilvox/conduyt/actions/workflows/py-ci.yml/badge.svg)](https://github.com/virgilvox/conduyt/actions/workflows/py-ci.yml)
[![Go CI](https://github.com/virgilvox/conduyt/actions/workflows/go-ci.yml/badge.svg)](https://github.com/virgilvox/conduyt/actions/workflows/go-ci.yml)
[![Rust CI](https://github.com/virgilvox/conduyt/actions/workflows/rust-ci.yml/badge.svg)](https://github.com/virgilvox/conduyt/actions/workflows/rust-ci.yml)
[![Swift CI](https://github.com/virgilvox/conduyt/actions/workflows/swift-ci.yml/badge.svg)](https://github.com/virgilvox/conduyt/actions/workflows/swift-ci.yml)
[![WASM CI](https://github.com/virgilvox/conduyt/actions/workflows/wasm-ci.yml/badge.svg)](https://github.com/virgilvox/conduyt/actions/workflows/wasm-ci.yml)
[![Conformance](https://github.com/virgilvox/conduyt/actions/workflows/conformance.yml/badge.svg)](https://github.com/virgilvox/conduyt/actions/workflows/conformance.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Open binary protocol for host-to-device hardware control.

Conduyt is a structured, transport-agnostic binary protocol for host-to-device hardware control. One firmware library handles framing, dispatch, and capabilities. Host SDKs in five languages connect over Serial, BLE, MQTT, WebSocket, or TCP. Flash a sketch, connect from any language, control pins, read sensors, drive modules.

## Quick Start

### Arduino Firmware

```cpp
#include <Conduyt.h>

ConduytSerial  transport(Serial, 115200);
ConduytDevice  device("MyDevice", "1.0.0", transport);

void setup() { device.begin(); }
void loop()  { device.poll(); }
```

### JavaScript Host

```js
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'

const device = await ConduytDevice.connect(
  new SerialTransport({ path: '/dev/ttyUSB0' })
)
await device.pin(13).mode('output')
await device.pin(13).write(1)

// 'A0' as a pin name puts the proxy in analog mode automatically.
const value = await device.pin('A0').read()
// Or be explicit: await device.pin(0).analogRead()

await device.disconnect()
```

### Python Host

```python
from conduyt import ConduytDevice
from conduyt.transports.serial import SerialTransport

device = ConduytDevice(SerialTransport("/dev/ttyUSB0"))
await device.connect()
await device.pin(13).mode("output")
await device.pin(13).write(1)

# 'A0' as a pin name puts the proxy in analog mode automatically.
value = await device.pin("A0").read()
# Or be explicit: await device.pin(0).analog_read()

await device.disconnect()
```

## What Conduyt Does

- Binary packet protocol with CRC8, COBS framing, and sequence tracking
- Pin control (digital, analog, PWM), pin subscriptions with configurable interval and threshold
- I2C, SPI passthrough for direct bus access from the host
- Module system for reusable hardware drivers (Servo, NeoPixel, DHT, OLED, Stepper, Encoder, PID)
- Datastream abstraction for named, typed, subscribable device telemetry
- OTA firmware updates over any transport
- High-speed analog streaming with configurable sample rate

## Supported Hardware

| Board | Platform | OTA | Browser Flash |
|-------|----------|-----|---------------|
| Arduino Uno R3 | AVR (ATmega328P) | No | No |
| Arduino Uno R4 Minima | Renesas RA4M1 | No | Yes (WebUSB DFU) |
| ESP32 DevKit | Espressif32 | Yes | Yes (esp-web-tools) |
| NodeMCU v2 | ESP8266 | No | No |
| nRF52840 DK | Nordic nRF52 | No | No |
| Raspberry Pi Pico | RP2040 | No | Yes (WebUSB) |
| Teensy 4.1 | Teensy | No | No |

## SDKs

| Language | Package | Install | Status |
|----------|---------|---------|--------|
| JavaScript/TypeScript | [`conduyt-js`](https://www.npmjs.com/package/conduyt-js) | `npm install conduyt-js` | v0.3.3 |
| Python | [`conduyt-py`](https://pypi.org/project/conduyt-py/) | `pip install conduyt-py` | v0.3.3 |
| Go | [`conduyt/sdk/go`](https://github.com/virgilvox/conduyt/tree/main/sdk/go) | `go get github.com/virgilvox/conduyt/sdk/go` | v0.3.3 |
| Rust | [`conduyt`](https://crates.io/crates/conduyt) | `cargo add conduyt` | v0.3.3 |
| Swift | `ConduytKit` | Swift Package Manager | v0.3.3 |
| WASM (Browser) | [`conduyt-wasm`](https://www.npmjs.com/package/conduyt-wasm) | `npm install conduyt-wasm` | v0.3.3 |

## Playground

Try CONDUYT in the browser — no installs needed. Flash firmware, write code, control hardware.

**[conduyt.io/playground](https://conduyt.io/playground)**

## Wire Format

Every Conduyt packet is 8 bytes of header followed by a variable-length payload.

```
 0      1      2      3      4      5      6      7
+------+------+------+------+------+------+------+------+----------+
| 0x43 | 0x44 | VER  | TYPE | SEQ  | LEN (u16le) | CRC8 | PAYLOAD  |
+------+------+------+------+------+------+------+------+----------+
  magic  magic   1     cmd/   0-255  payload len   header   0..N
  'C'    'D'           evt                         crc      bytes
```

CRC8 covers bytes 0 through 6. Transports that need framing (Serial, BLE) wrap each packet in COBS encoding with a 0x00 delimiter.

## Project Structure

```
conduyt/
  firmware/         Arduino/PlatformIO library (C++)
    src/conduyt/    Device, transports, modules, core wire/cobs/crc
    examples/       Ready-to-flash sketches
  sdk/
    js/             JavaScript/TypeScript SDK
    python/         Python SDK (async + sync)
    go/             Go SDK
    rust/           Rust SDK (no_std core + std device)
    swift/          Swift SDK (ConduytKit)
  broker/           MQTT broker (Mosquitto, Docker)
  conformance/      Cross-SDK test vectors
  protocol/         constants.json (source of truth)
  site/             Documentation site (Nuxt)
```

## Documentation

Full documentation at [github.com/virgilvox/conduyt](https://github.com/virgilvox/conduyt).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. Copyright (c) 2026 LumenCanvas.

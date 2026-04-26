---
title: "JavaScript SDK"
description: "Pure-TS CONDUYT client for Node.js, Bun, Deno, and browsers — with WebSerial, BLE, and module wrappers."
---

# JavaScript SDK

`conduyt-js` is the pure-TypeScript SDK. It runs everywhere JavaScript runs — Node.js, Bun, Deno, browsers — and ships ESM-first with full TypeScript types. The protocol primitives (wire/COBS/CRC8) are reimplemented in TypeScript; for a smaller browser bundle that uses the WASM-compiled Rust core instead, see the [WASM SDK](/docs/sdks/wasm).

## Install

```bash
npm install conduyt-js
```

Or with `pnpm`, `bun`, `yarn` — same package.

## Quick start

### Node.js / Bun (USB-Serial)

```javascript
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'

const transport = new SerialTransport({ path: '/dev/cu.usbmodem14101', baudRate: 115200 })
const device = await ConduytDevice.connect(transport)

console.log('connected to', device.firmwareName)

await device.pinMode(13, 'output')
await device.pinWrite(13, 1)

await device.disconnect()
```

### Browser (WebSerial)

```javascript
import { ConduytDevice } from 'conduyt-js'
import { WebSerialTransport } from 'conduyt-js/transports/web-serial'

const port = await navigator.serial.requestPort()
const transport = new WebSerialTransport({ port, baudRate: 115200 })
const device = await ConduytDevice.connect(transport)

await device.pinMode(13, 'output')
await device.pinWrite(13, 1)
```

## Modules

The SDK ships typed wrappers for every CONDUYT firmware module. Import only what you need:

```javascript
import { ConduytServo }    from 'conduyt-js/modules/servo'
import { ConduytNeoPixel } from 'conduyt-js/modules/neopixel'
import { ConduytOLED }     from 'conduyt-js/modules/oled'
import { ConduytDHT }      from 'conduyt-js/modules/dht'
import { ConduytEncoder }  from 'conduyt-js/modules/encoder'
import { ConduytStepper }  from 'conduyt-js/modules/stepper'
import { ConduytPID }      from 'conduyt-js/modules/pid'
```

Each constructor takes a connected `ConduytDevice` and resolves the module ID by name from the `HELLO_RESP`. See the per-module pages under [Modules](/docs/modules) for command reference and examples.

## Datastreams

Datastreams are firmware-side named values (sensor readings, knobs, status) that auto-stream to the host. They appear in `HELLO_RESP.datastreams` and you subscribe by name:

```javascript
device.onDatastream('temperature', (value) => {
  console.log('temp:', value)
})
await device.streamStart()
```

## Transports

| Transport | Module | Where it works |
|---|---|---|
| Node.js Serial | `conduyt-js/transports/serial` | Node, Bun, Electron — uses `serialport` |
| WebSerial | `conduyt-js/transports/web-serial` | Chrome / Edge / Opera browsers |
| Mock | `conduyt-js/transports/mock` | Tests — captures sent bytes, lets you inject responses |

WebBluetooth and WebUSB transports are planned. For embedded targets that need a tiny binary instead of full TypeScript, use the [WASM SDK](/docs/sdks/wasm) directly.

## TypeScript

Full types ship in the package. `device.module('servo')` returns a typed proxy so the IDE knows what commands the module accepts.

## Versioning

The SDK follows the protocol version. `0.3.x` SDKs only talk to firmware running protocol version 2 (the current spec). The protocol version byte is exported as `PROTOCOL_VERSION` for runtime checks.

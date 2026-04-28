---
title: JavaScript API
description: conduyt-js SDK reference
---

# JavaScript API

The `conduyt-js` package. Works in Node.js and browsers depending on transport.

```bash
npm install conduyt-js
```

## Quick Example

```js
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'

// Connect and perform HELLO handshake
const device = await ConduytDevice.connect(
  new SerialTransport({ path: '/dev/ttyUSB0', baudRate: 115200 })
)

// Inspect device capabilities
console.log(device.capabilities.firmwareName)
console.log(device.capabilities.pins.length, 'pins')

// Control a pin
await device.pin(13).mode('output')
await device.pin(13).write(1)

// Read a datastream
const temp = await device.datastream('temperature').read()

// Send a module command
const servo = device.module('servo')
await servo.cmd(0x02, new Uint8Array([90]))  // write angle 90

await device.disconnect()
```

This script uses pin control, datastream reads, and module commands. The full API for each is documented below.

## ConduytDevice

### Static Factory

```typescript
static async connect(transport: ConduytTransport, options?: ConnectOptions): Promise<ConduytDevice>
```

Creates a device, connects, and sends HELLO in one call. Returns a connected `ConduytDevice` with `capabilities` populated.

### Constructor and Connection

```typescript
const device = new ConduytDevice(transport, options?)
const hello: HelloResp = await device.connect()
```

### Methods

| Method | Return | Description |
|---|---|---|
| `async connect()` | `Promise<HelloResp>` | Connect and perform HELLO handshake |
| `async disconnect()` | `Promise<void>` | Close the transport |
| `async ping()` | `Promise<void>` | Send PING, wait for PONG |
| `async reset()` | `Promise<void>` | Send RESET command |
| `pin(num)` | `PinProxy` | Get a pin proxy |
| `datastream(name)` | `DatastreamProxy` | Get a datastream proxy |
| `module(name)` | `ModuleProxy` | Get a module proxy |
| `i2c(bus?)` | `I2CProxy` | Get an I2C proxy (default bus 0) |
| `on(eventType, handler)` | `void` | Listen for device events |

### Properties

| Property | Type | Description |
|---|---|---|
| `capabilities` | `HelloResp \| null` | Parsed HELLO_RESP, null before connect |
| `connected` | `boolean` | Connection state |

## PinProxy

Returned by `device.pin(id)`. `id` is either a numeric pin (0, 13) or an analog name like `'A0'` (which puts the proxy in analog mode automatically).

| Method | Return | Description |
|---|---|---|
| `async mode(mode)` | `Promise<void>` | Set pin mode: `"input"`, `"output"`, `"pwm"`, `"analog"`, `"input_pullup"` |
| `async write(value)` | `Promise<void>` | Write digital (0/1) or PWM (0-255) value |
| `async read()` | `Promise<number>` | Read using the pin's stored mode (or analog if the proxy was made with `'A0'`) |
| `async analogRead()` | `Promise<number>` | Explicit analog read (0-1023 on most boards) |
| `async digitalRead()` | `Promise<number>` | Explicit digital read (0 or 1) |
| `subscribe(opts?)` | `AsyncIterable<number>` | Subscribe to pin events. Options: `mode`, `intervalMs`, `threshold` |

`subscribe(opts)` options:

| Option | Type | Default | Description |
|---|---|---|---|
| `mode` | number (`SUB_MODE.*`) | `ANALOG_POLL` (0x04) | `CHANGE` (0x01), `RISING` (0x02), `FALLING` (0x03), `ANALOG_POLL` (0x04) |
| `intervalMs` | number | 100 | Poll interval for analog mode |
| `threshold` | number | 0 | Only emit when value moves by more than threshold |

```ts
import { ConduytDevice, SUB_MODE } from 'conduyt-js'

// Analog poll: yields the latest reading every interval
for await (const v of device.pin('A0').subscribe({ intervalMs: 50 })) { ... }

// Falling edge: yields once per detected edge
for await (const _ of device.pin(2).subscribe({ mode: SUB_MODE.FALLING })) { ... }
```

## DatastreamProxy

Returned by `device.datastream(name)`. The proxy looks up the datastream's descriptor in `device.capabilities.datastreams` and uses it to encode writes and decode reads.

| Method / Getter | Return | Description |
|---|---|---|
| `descriptor` | `DatastreamDescriptor \| null` | The descriptor from `HELLO_RESP`, or null if the name is unknown |
| `async read()` | `Promise<Uint8Array>` | Read the current raw payload |
| `async write(value)` | `Promise<void>` | Write a value. Accepts `boolean`, `number`, `string`, or `Uint8Array`; the SDK encodes per the declared type. Throws `ConduytCapabilityError` if the stream is read-only or unknown |
| `subscribe(opts?)` | `AsyncIterable<DatastreamValue>` | Subscribe to pushed values. Option: `threshold` (numeric streams only) |

```ts
// Subscribe yields each value the device pushes:
for await (const t of device.datastream('temperature').subscribe()) {
  console.log(t)
}
```

## ModuleProxy

Returned by `device.module(name)`.

| Method | Return | Description |
|---|---|---|
| `async cmd(cmdByte, data?)` | `Promise<Uint8Array \| void>` | Send a module command. Returns MOD_RESP data if the module responds. |
| `onEvent(handler)` | `void` | Register handler for unsolicited MOD_EVENT packets |

## I2CProxy

Returned by `device.i2c(bus?)`.

| Method | Return | Description |
|---|---|---|
| `async write(addr, data)` | `Promise<void>` | Write bytes to I2C address |
| `async read(addr, count)` | `Promise<Uint8Array>` | Read N bytes from I2C address |
| `async readReg(addr, reg, count)` | `Promise<Uint8Array>` | Read N bytes from register at I2C address |

## Transports

| Transport | Import | Environment |
|---|---|---|
| Serial | `conduyt-js/transports/serial` | Node.js |
| WebSerial | `conduyt-js/transports/web-serial` | Browser |
| BLE | `conduyt-js/transports/ble` | Browser |
| MQTT | `conduyt-js/transports/mqtt` | Node.js + Browser |
| CLASP | `conduyt-js/transports/clasp` | Browser |
| WebSocket | `conduyt-js/transports/websocket` | Both |
| Mock | `conduyt-js/transports/mock` | Testing |

All transports implement the `ConduytTransport` interface:

```typescript
interface ConduytTransport {
  connect(): Promise<void>
  disconnect(): Promise<void>
  send(packet: Uint8Array): Promise<void>
  onReceive(handler: (packet: Uint8Array) => void): void
  readonly connected: boolean
  readonly needsCOBS: boolean
}
```

Direct transports that operate on byte streams (Serial, WebSerial, BLE) set `needsCOBS = true` so `ConduytDevice` applies COBS framing. Message-oriented transports (MQTT, WebSocket, Mock) set it to `false`.

### ReconnectTransport

Wrap any transport to add exponential-backoff reconnection.

```ts
import { ConduytDevice, ReconnectTransport } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'

const transport = new ReconnectTransport(
  new SerialTransport({ path: '/dev/ttyACM0' }),
  { initialDelay: 1000, maxDelay: 30000, multiplier: 2, maxAttempts: 0 }
)
transport.onReconnect = () => {
  console.log('reconnected')
}
const device = await ConduytDevice.connect(transport)
```

## Error Classes

### ConduytNAKError

Thrown when the device responds with NAK.

| Property | Type | Description |
|---|---|---|
| `errorName` | `string` | Error name (e.g., "INVALID_PIN") |
| `code` | `number` | Raw error code byte |

### ConduytTimeoutError

Thrown when a command receives no response within the timeout period.

### ConduytDisconnectedError

Thrown when a command is attempted on a disconnected device.

### ConduytCapabilityError

Thrown when an operation targets hardware the device does not support (e.g., I2C on a board with no I2C bus).

## Module Wrappers

High-level classes for built-in firmware modules. Each wraps `ModuleProxy` with typed methods.

| Class | Import | Firmware Module |
|---|---|---|
| `ConduytServo` | `conduyt-js/modules/servo` | servo |
| `ConduytNeoPixel` | `conduyt-js/modules/neopixel` | neopixel |
| `ConduytEncoder` | `conduyt-js/modules/encoder` | encoder |
| `ConduytStepper` | `conduyt-js/modules/stepper` | stepper |
| `ConduytDHT` | `conduyt-js/modules/dht` | dht |
| `ConduytOLED` | `conduyt-js/modules/oled` | oled1306 |
| `ConduytPID` | `conduyt-js/modules/pid` | pid |

Usage:

```typescript
import { ConduytServo } from 'conduyt-js/modules/servo'

const servo = new ConduytServo(device)
await servo.attach(9, 500, 2500)
await servo.write(90)
await servo.detach()
```

## Types

```typescript
interface HelloResp {
  firmwareName: string
  firmwareVersion: [number, number, number]
  mcuId: Uint8Array
  otaCapable: boolean
  pins: PinCapability[]
  i2cBuses: number
  spiBuses: number
  uartCount: number
  maxPayload: number
  modules: ModuleDescriptor[]
  datastreams: DatastreamDescriptor[]
}

interface PinCapability {
  pin: number
  capabilities: number  // bitmask of PIN_CAP values
}
```

Use the `PIN_CAP` constants to test individual bits:

```typescript
import { PIN_CAP } from 'conduyt-js'

const pin = device.capabilities.pins[13]
const hasPWM = (pin.capabilities & PIN_CAP.PWM_OUT) !== 0
```

```typescript
interface ModuleDescriptor {
  moduleId: number
  name: string
  versionMajor: number
  versionMinor: number
  pins: number[]
}

interface DatastreamDescriptor {
  index: number
  name: string
  type: number   // DS_TYPE value
  unit: string
  writable: boolean
  pinRef: number  // 0xFF if none
  retain: boolean
}

interface ConduytPacket {
  version: number
  type: number
  seq: number
  payload: Uint8Array
}
```

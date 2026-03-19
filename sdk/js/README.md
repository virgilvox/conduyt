# conduyt-js

CONDUYT protocol SDK for JavaScript and TypeScript. Host-side hardware control over Serial, BLE, MQTT, WebSocket, or TCP.

## Install

```bash
npm install conduyt-js
```

## Quick Start

```js
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'

const device = await ConduytDevice.connect(
  new SerialTransport({ path: '/dev/ttyUSB0' })
)

// Pin control
await device.pin(13).mode('output')
await device.pin(13).write(1)
const value = await device.pin(A0).read('analog')

// Pin subscription (async iterable)
for await (const reading of device.pin(A0).subscribe({ mode: 'analog', intervalMs: 100 })) {
  console.log(reading)
}

await device.disconnect()
```

### Module Usage

```js
import { ConduytServo } from 'conduyt-js/modules/servo'

const servo = new ConduytServo(device)
await servo.attach(9)
await servo.write(90)
```

### I2C

```js
const i2c = device.i2c()
await i2c.write(0x3C, new Uint8Array([0x00, 0xAE]))
const data = await i2c.readReg(0x68, 0x75, 1)
```

## API Reference

### ConduytDevice

| Method | Returns | Description |
|--------|---------|-------------|
| `ConduytDevice.connect(transport)` | `Promise<ConduytDevice>` | Connect and run HELLO handshake |
| `connect()` | `Promise<HelloResp>` | Manual connect, returns capabilities |
| `disconnect()` | `Promise<void>` | Close connection |
| `ping()` | `Promise<void>` | Ping/pong roundtrip |
| `reset()` | `Promise<void>` | Reset device state, clear subscriptions |
| `pin(num)` | `PinProxy` | Pin control object |
| `datastream(name)` | `DatastreamProxy` | Datastream control object |
| `module(name)` | `ModuleProxy` | Module control object |
| `i2c(bus?)` | `I2CProxy` | I2C bus control |
| `on(event, handler)` | `void` | Event listener |

### PinProxy

| Method | Returns | Description |
|--------|---------|-------------|
| `mode(mode)` | `Promise<void>` | Set pin mode: `'input'`, `'output'`, `'pwm'`, `'analog'`, `'input_pullup'` |
| `write(value)` | `Promise<void>` | Digital/PWM write |
| `read(mode?)` | `Promise<number>` | Digital or analog read |
| `subscribe(options)` | `AsyncIterable<number>` | Subscribe to pin changes |

### Errors

| Class | When |
|-------|------|
| `ConduytNAKError` | Device rejected a command |
| `ConduytTimeoutError` | No response within timeout |
| `ConduytDisconnectedError` | Transport disconnected mid-operation |
| `ConduytCapabilityError` | Pin or feature not supported by device |

## Transports

| Transport | Import | Use Case |
|-----------|--------|----------|
| `SerialTransport` | `conduyt-js/transports/serial` | Node.js USB/UART |
| `WebSerialTransport` | `conduyt-js/transports/web-serial` | Browser Web Serial API |
| `BLETransport` | `conduyt-js/transports/ble` | Bluetooth Low Energy |
| `MQTTTransport` | `conduyt-js/transports/mqtt` | MQTT broker relay |
| `WebSocketTransport` | `conduyt-js/transports/websocket` | WebSocket connection |
| `CLASPTransport` | `conduyt-js/transports/clasp` | CLASP tunnel |
| `MockTransport` | `conduyt-js/transports/mock` | Testing |

## Modules

| Module | Import | Hardware |
|--------|--------|----------|
| `ConduytServo` | `conduyt-js/modules/servo` | Hobby servos |
| `ConduytNeoPixel` | `conduyt-js/modules/neopixel` | WS2812/SK6812 LEDs |
| `ConduytDHT` | `conduyt-js/modules/dht` | DHT11/DHT22 sensors |
| `ConduytOLED` | `conduyt-js/modules/oled` | SSD1306 OLED displays |
| `ConduytStepper` | `conduyt-js/modules/stepper` | Stepper motors |
| `ConduytEncoder` | `conduyt-js/modules/encoder` | Rotary encoders |
| `ConduytPID` | `conduyt-js/modules/pid` | PID controller |

## Reconnection

```js
import { ReconnectTransport } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'

const transport = new ReconnectTransport(
  new SerialTransport({ path: '/dev/ttyUSB0' }),
  { maxAttempts: 10, initialDelay: 500 }
)
const device = await ConduytDevice.connect(transport)
```

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.7 (optional)

## License

MIT. Copyright (c) 2026 LumenCanvas.

---
title: JavaScript / TypeScript
description: conduyt-js SDK guide
---

# JavaScript / TypeScript SDK

## Install

```bash
npm install conduyt-js
```

## Connect

```typescript
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'

const device = await ConduytDevice.connect(
  new SerialTransport({ path: '/dev/ttyUSB0' })
)

console.log(device.capabilities.firmwareName)
console.log(device.capabilities.pins.length, 'pins')
console.log(device.capabilities.modules.map(m => m.name))
```

## Pin Control

```typescript
// Digital output
await device.pin(13).mode('output')
await device.pin(13).write(1)  // HIGH
await device.pin(13).write(0)  // LOW

// PWM
await device.pin(9).mode('pwm')
await device.pin(9).write(128)  // 50% duty

// Analog read
const value = await device.pin(0).read()  // 0-1023

// Subscription (AsyncIterator)
for await (const val of device.pin(0).subscribe({ intervalMs: 50, threshold: 5 })) {
  console.log('pot:', val)
}
```

## Datastreams

```typescript
// Subscribe to device-pushed values
for await (const temp of device.datastream('temperature').subscribe()) {
  console.log(`${temp}°C`)
}

// Write to a writable datastream
await device.datastream('setpoint').write(25.0)
```

## Modules

```typescript
import { ConduytServo } from 'conduyt-js/modules/servo'

const servo = new ConduytServo(device)
await servo.attach(9, 500, 2500)
await servo.write(90)
await servo.detach()
```

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

All transports implement the same `ConduytTransport` interface. The `ConduytDevice` class works identically regardless of which transport you use.

## Error Handling

```typescript
import { ConduytNAKError, ConduytTimeoutError } from 'conduyt-js'

try {
  await device.pin(99).mode('output')
} catch (err) {
  if (err instanceof ConduytNAKError) {
    console.log(err.errorName)  // "INVALID_PIN"
    console.log(err.code)       // 0x04
  }
}
```

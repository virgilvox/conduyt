---
title: 'Quick Start: JavaScript'
description: Control a CONDUYT device from Node.js or the browser
---

# Quick Start: JavaScript

## Install

```bash
npm install conduyt-js
```

## Connect and Blink

```typescript
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'

const transport = new SerialTransport({ path: '/dev/ttyUSB0', baudRate: 115200 })
const device = new ConduytDevice(transport)

await device.connect()

// Blink pin 13
await device.pin(13).mode('output')
await device.pin(13).write(1)
await new Promise(r => setTimeout(r, 1000))
await device.pin(13).write(0)

await device.disconnect()
```

## Read Analog

```typescript
const value = await device.pin(0).read('analog')
console.log('Analog:', value) // 0–4095
```

## Use a Module

```typescript
import { ConduytServo } from 'conduyt-js/modules/servo'

const servo = new ConduytServo(device)
await servo.attach(9)
await servo.write(90) // center position
```

## Transports

| Transport | Install | Use Case |
|---|---|---|
| Serial | `conduyt-js/transports/serial` | USB / UART (Node.js) |
| WebSerial | `conduyt-js/transports/web-serial` | Browser USB |
| BLE | `conduyt-js/transports/ble` | Browser Bluetooth |
| MQTT | `conduyt-js/transports/mqtt` | IoT / remote |
| WebSocket | `conduyt-js/transports/websocket` | Browser / bridge |
| Mock | `conduyt-js/transports/mock` | Unit testing |

## Error Handling

```typescript
import { ConduytNAKError, ConduytTimeoutError } from 'conduyt-js'

try {
  await device.pin(99).write(1)
} catch (e) {
  if (e instanceof ConduytNAKError) {
    console.error('Device error:', e.errorName) // INVALID_PIN
  }
}
```

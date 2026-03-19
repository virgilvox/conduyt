---
title: Python
description: Python SDK API guide for conduyt-py
---

# Python SDK Guide

## Installation

```bash
pip install conduyt-py

# With transport extras:
pip install conduyt-py[serial]   # pyserial-asyncio
pip install conduyt-py[mqtt]     # aiomqtt
pip install conduyt-py[all]      # everything
```

Requires Python 3.10+.

## Async API

```python
import asyncio
from conduyt import ConduytDevice
from conduyt.transports.serial import SerialTransport

async def main():
    transport = SerialTransport('/dev/ttyUSB0')
    device = ConduytDevice(transport, timeout_ms=5000)

    hello = await device.connect()
    print(f"Firmware: {hello.firmware_name}")
    print(f"Version: {hello.firmware_version}")
    print(f"Pins: {len(hello.pins)}")
    print(f"Modules: {[m.name for m in hello.modules]}")

    await device.ping()
    await device.disconnect()

asyncio.run(main())
```

## Synchronous Wrapper

```python
from conduyt import ConduytDeviceSync
from conduyt.transports.mock import MockTransport

device = ConduytDeviceSync(MockTransport())
device.connect()
device.ping()
device.close()
```

## Pin Control

```python
pin = device.pin(13)
await pin.mode('output')
await pin.write(255)        # PWM
value = await pin.read()    # 16-bit
```

Pin modes: `input`, `output`, `pwm`, `analog`, `input_pullup`.

## Modules

```python
from conduyt.modules import ConduytServo, ConduytNeoPixel, ConduytDHT

# Servo
servo = ConduytServo(device, module_id=0)
await servo.attach(9)
await servo.write(90)
await servo.detach()

# NeoPixel
neo = ConduytNeoPixel(device, module_id=1)
await neo.begin(pin=6, count=30)
await neo.fill(255, 0, 0)
await neo.show()

# DHT
dht = ConduytDHT(device, module_id=2)
await dht.begin(pin=4, sensor_type=22)
reading = await dht.read()
print(f"Temp: {reading.temperature}°C, Humidity: {reading.humidity}%")
```

## Error Handling

```python
from conduyt import ConduytNAKError, ConduytTimeoutError, ConduytDisconnectedError

try:
    await device.pin(99).write(1)
except ConduytNAKError as e:
    print(f"Device error: {e.error_name} (0x{e.code:02x})")
except ConduytTimeoutError:
    print("Command timed out")
except ConduytDisconnectedError:
    print("Device disconnected")
```

## Transports

| Transport | Import | Requirements |
|---|---|---|
| Mock | `conduyt.transports.mock` | — |
| Serial | `conduyt.transports.serial` | `pip install conduyt-py[serial]` |
| MQTT | `conduyt.transports.mqtt` | `pip install conduyt-py[mqtt]` |

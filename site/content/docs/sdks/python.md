---
title: "Python SDK"
description: "Async Python client for CONDUYT — serial, MQTT bridges, and typed module wrappers."
---

# Python SDK

`conduyt-py` is the official Python SDK. It's pure Python (no C extensions), uses `asyncio`, and runs on CPython 3.11+ as well as PyPy. Optional extras pull in `pyserial-asyncio` for serial transport and `aiomqtt` for MQTT bridging.

## Install

```bash
# Just the protocol primitives (wire/COBS/CRC8)
pip install conduyt-py

# With serial transport
pip install conduyt-py[serial]

# Everything (serial + MQTT)
pip install conduyt-py[all]
```

## Quick start

```python
import asyncio
from conduyt import ConduytDevice
from conduyt.transports.serial import SerialTransport


async def main():
    transport = SerialTransport('/dev/cu.usbmodem14101', baudrate=115200)
    device = ConduytDevice(transport)
    await device.connect()
    print(f"connected to {device.firmware_name}")

    await device.pin_mode(13, 'output')
    await device.pin_write(13, 1)

    await device.disconnect()


asyncio.run(main())
```

## Modules

Typed module wrappers are in `conduyt.modules`. Import only what you use:

```python
from conduyt.modules import (
    ConduytServo,
    ConduytNeoPixel,
    ConduytOLED,
    ConduytDHT,
    ConduytEncoder,
    ConduytStepper,
    ConduytPID,
)

servo = ConduytServo(device, module_id=0)
await servo.attach(pin=9)
await servo.write(angle=90)
```

Pass the module ID returned by `HELLO_RESP.modules` (often `0` if you only registered one module). See the per-module pages under [Modules](/docs/modules) for full command references.

## Datastreams

```python
def on_temp(value):
    print(f"temperature: {value}°C")

device.on_datastream('temperature', on_temp)
await device.stream_start()
```

## Transports

| Transport | Import path | Extra install |
|---|---|---|
| Serial | `conduyt.transports.serial.SerialTransport` | `pip install conduyt-py[serial]` |
| MQTT | `conduyt.transports.mqtt.MqttTransport` | `pip install conduyt-py[mqtt]` |
| Mock | `conduyt.transports.mock.MockTransport` | (built-in, for tests) |

## Sync vs async

The SDK is `async`-first because the wire protocol is event-driven (datastreams, module events, NAKs all arrive unsolicited). For one-off scripts, wrap in `asyncio.run(main())`. For long-running apps, treat the device like any other async resource.

## Type checking

The SDK ships `py.typed`. Install `mypy` and you'll get full inference on every method, packet shape, and module command.

## Versioning

The SDK follows the protocol version. `conduyt-py 1.x` requires firmware running protocol version 2. The version byte is `conduyt.core.constants.PROTOCOL_VERSION`.

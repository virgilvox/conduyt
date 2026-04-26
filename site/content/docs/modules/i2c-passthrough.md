---
title: "I2C Passthrough"
description: "Talk to arbitrary I2C peripherals from the host using the core I2C commands."
---

# I2C Passthrough

This isn't a real module — it's a capability marker. CONDUYT already exposes `I2C_WRITE` and `I2C_READ` commands at the protocol level, so any peripheral that speaks I2C can be driven directly from the host without writing custom firmware. Enabling `CONDUYT_MODULE_I2C_PASSTHROUGH` registers a stub module so it appears in `HELLO_RESP.modules` — letting host code feature-detect "yes, this firmware speaks raw I2C."

Use this when you want to drive a sensor or peripheral that doesn't have a dedicated module yet — temperature sensors, RTCs, expanders, EEPROMs, anything I2C — by sending register reads/writes from the host SDK.

## Firmware setup

```ini
; platformio.ini
build_flags = -DCONDUYT_MODULE_I2C_PASSTHROUGH
```

```cpp
#include <Conduyt.h>

ConduytSerial transport(Serial, 115200);
ConduytDevice device("I2CHub", "1.0.0", transport);

void setup() {
  Serial.begin(115200);
  Wire.begin();   // initialize the bus
  device.addModule(new ConduytModuleI2CPassthrough());
  device.begin();
}

void loop() {
  device.poll();
}
```

## Host usage

The marker module itself has no commands — every `MOD_CMD` to it returns `NAK 0x09`. Drive I2C through `device.i2cWrite` and `device.i2cRead` directly.

### JavaScript

```javascript
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'

const device = await ConduytDevice.connect(new SerialTransport({ path: '<YOUR_PORT>' }))

// Read 2 bytes from register 0x00 of an MPU-6050 (addr 0x68)
await device.i2cWrite(0x68, new Uint8Array([0x00]))   // point to register 0x00
const data = await device.i2cRead(0x68, 2)
console.log('WHO_AM_I + 1:', data)
```

### Python

```python
from conduyt import ConduytDevice
from conduyt.transports.serial import SerialTransport

device = ConduytDevice(SerialTransport('<YOUR_PORT>'))
await device.connect()

# Read 2 bytes from register 0x00 of an MPU-6050 (addr 0x68)
await device.i2c_write(0x68, b"\x00")
data = await device.i2c_read(0x68, 2)
print(data.hex())
```

## Why this exists as a module

`I2C_WRITE` / `I2C_READ` work whether or not this module is registered — they're core protocol commands, not module commands. The marker module exists so the host can:

1. Discover that the firmware has I2C wired up (`Wire.begin()` was called) by checking `HELLO_RESP.modules` for the `i2c_pass` entry.
2. Show "I2C available" in playgrounds and dashboards instead of probing blindly.

If you only need raw I2C access and don't care about advertising it, you can leave this module disabled and still call `device.i2cWrite` / `device.i2cRead`.

## Notes

- Bus speed: defaults to 100 kHz. Call `Wire.setClock(400000)` after `Wire.begin()` for fast-mode I2C if your peripherals support it.
- Multiple buses: ESP32, RP2040, and Teensy boards have multiple I2C ports. CONDUYT's core I2C commands target the first bus. Custom firmware can extend this if needed.
- For higher-level abstractions over I2C peripherals (DHT, OLED, etc.), use the dedicated modules — they're easier and more reliable than driving registers from the host every time.

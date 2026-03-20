---
title: "DHT Module"
description: "Read temperature and humidity from DHT11/DHT22 sensors."
---

# DHT Module

Read temperature (Celsius) and relative humidity (%) from DHT11 and DHT22 sensors.

## Firmware setup

```ini
; platformio.ini
build_flags = -DCONDUYT_MODULE_DHT
```

```cpp
#include <Conduyt.h>

ConduytSerial transport(Serial, 115200);
ConduytDevice device("WeatherStation", "1.0.0", transport);

void setup() {
  Serial.begin(115200);
  device.addModule(new ConduytModuleDHT());
  device.begin();
}

void loop() {
  device.poll();
}
```

## Wiring

### DHT22 (bare 4-pin sensor)

```
DHT22 (front view)
┌─────────┐
│  ┌───┐  │
│  │   │  │
│  └───┘  │
└─┬─┬─┬─┬┘
  1 2 3 4

1=VCC  2=DATA  3=NC  4=GND
```

| DHT22 Pin | Connect to | Notes |
|-----------|-----------|-------|
| 1 (VCC) | **3.3V** (ESP32) or **5V** (Uno) | ESP32 GPIO is 3.3V - match VCC to it |
| 2 (DATA) | **D4** (digital pin 4) | |
| 3 (NC) | Leave unconnected | |
| 4 (GND) | **GND** | |

**Required:** 10k ohm pull-up resistor between VCC and DATA.

### 3-pin breakout boards

Breakout boards have the pull-up resistor built in. Just connect VCC, DATA, GND - no extra resistor needed. Check your breakout's labeling (often marked S/+/- or DATA/VCC/GND).

## Host usage

### JavaScript

```javascript
// dht.mjs
import { ConduytDevice } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'
import { DHT } from 'conduyt-js/modules/dht'

const device = await ConduytDevice.connect(
  new SerialTransport({ path: '<YOUR_PORT>' })
)

const dht = new DHT(device, 0)

// Initialize: pin 4, sensor type 22 (use 11 for DHT11)
await dht.begin(4, 22)

// Wait for sensor to stabilize
await new Promise(r => setTimeout(r, 2000))

// Read temperature and humidity
const { temperature, humidity } = await dht.read()
console.log(`Temperature: ${temperature.toFixed(1)} C`)
console.log(`Humidity: ${humidity.toFixed(1)} %`)

await device.disconnect()
```

### Python

```python
# dht.py
import asyncio
from conduyt import ConduytDevice
from conduyt.transports.serial import SerialTransport
from conduyt.modules import ConduytDHT


async def main():
    device = ConduytDevice(SerialTransport('<YOUR_PORT>'))
    await device.connect()

    dht = ConduytDHT(device, module_id=0)

    # pin=4, sensor_type=22 for DHT22 (or 11 for DHT11)
    await dht.begin(pin=4, sensor_type=22)

    # Wait for sensor to stabilize after power-on
    await asyncio.sleep(2)

    reading = await dht.read()
    print(f"Temperature: {reading.temperature:.1f} C")
    print(f"Humidity: {reading.humidity:.1f} %")

    await device.disconnect()


asyncio.run(main())
```

## Command reference

| Command | ID | Payload | Description |
|---------|-----|---------|-------------|
| Begin | `0x01` | `pin(1) + type(1)` | Initialize sensor. type = `11` (DHT11) or `22` (DHT22) |
| Read | `0x02` | (none) | Read sensor. Returns MOD_RESP with 8 bytes |

### Read response format

```
temperature (4 bytes, float32, little-endian)
humidity    (4 bytes, float32, little-endian)
```

## DHT11 vs DHT22

| Feature | DHT11 | DHT22 |
|---------|-------|-------|
| Temperature range | 0–50 C | -40–80 C |
| Temperature accuracy | ±2 C | ±0.5 C |
| Humidity range | 20–80% | 0–100% |
| Min read interval | 1 second | 2 seconds |
| sensor_type value | `11` | `22` |

## Troubleshooting

- **Returns 0.0 / 0.0:** the sensor hasn't stabilized yet. Add a 2-second delay after `begin()` before the first `read()`.
- **Returns NaN:** check wiring. The pull-up resistor is required for bare sensors. Also verify VCC matches your board's voltage (3.3V for ESP32, 5V for Uno).
- **Stale readings:** DHT sensors have a minimum sampling interval. Reading faster than 2 seconds (DHT22) or 1 second (DHT11) returns cached data.

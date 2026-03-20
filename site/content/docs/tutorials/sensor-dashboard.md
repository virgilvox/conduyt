---
title: "Sensor Dashboard: Temperature Readings from Python"
description: "Wire a DHT22 sensor, flash Conduyt firmware with the DHT module, and read sensor data from a Python script."
---

# Sensor Dashboard: Temperature Readings from Python

Wire a DHT22 temperature/humidity sensor, flash CONDUYT firmware with the DHT module enabled, and read live sensor data from a Python script.

## Prerequisites

- **Arduino Uno or ESP32** dev board
- **DHT22 sensor** — either the bare 4-pin component or a 3-pin breakout board
- **10k ohm resistor** — only needed for the bare 4-pin sensor (breakout boards have one built in)
- **Breadboard and jumper wires**
- **USB cable** for your board
- **[PlatformIO CLI](https://docs.platformio.org/en/latest/core/installation/index.html)** — verify:
  ```bash
  pio --version
  ```
- **Python 3.10+** — verify:
  ```bash
  python3 --version
  # Python 3.10.x or higher
  ```

## 1. Wire the DHT22

### If you have the bare 4-pin sensor

Looking at the front of the sensor (the side with holes), the pins from left to right are:

```
DHT22 (front view)
┌─────────┐
│  ┌───┐  │
│  │   │  │
│  └───┘  │
└─┬─┬─┬─┬┘
  1 2 3 4

Pin 1: VCC
Pin 2: DATA
Pin 3: NC (not connected)
Pin 4: GND
```

| DHT22 Pin | Connect to | Notes |
|-----------|-----------|-------|
| 1 (VCC) | **5V** on Uno, **3.3V** on ESP32 | ESP32 GPIO is 3.3V — using 5V for VCC risks damage |
| 2 (DATA) | **D4** (digital pin 4) | |
| 3 (NC) | Leave unconnected | |
| 4 (GND) | **GND** | |

**Also:** connect a 10k ohm resistor between VCC (pin 1) and DATA (pin 2). This is the pull-up resistor required by the DHT protocol.

### If you have a 3-pin breakout board

Breakout boards have a built-in pull-up resistor. Just connect:

| Breakout Pin | Connect to |
|-------------|-----------|
| VCC (or +) | **5V** (Uno) / **3.3V** (ESP32) |
| DATA (or S) | **D4** |
| GND (or -) | **GND** |

## 2. Flash the firmware

Create a PlatformIO project:

```bash
mkdir conduyt-sensor && cd conduyt-sensor
pio project init --board uno --project-option "framework=arduino"
```

Open `platformio.ini` and replace its contents:

```ini
; platformio.ini
[env:uno]
platform = atmelavr
board = uno
framework = arduino
lib_deps = conduyt
build_flags = -DCONDUYT_MODULE_DHT
```

The `-DCONDUYT_MODULE_DHT` build flag tells the CONDUYT library to compile the DHT module into the firmware. Without it, the DHT code is excluded to save flash and RAM on constrained boards.

**For ESP32**, change the env section:

```ini
[env:esp32]
platform = espressif32
board = esp32dev
framework = arduino
lib_deps = conduyt
build_flags = -DCONDUYT_MODULE_DHT
```

Now write the firmware. Create `src/main.cpp`:

```cpp
// src/main.cpp
#include <Arduino.h>
#include <Conduyt.h>

ConduytSerial transport(Serial, 115200);
ConduytDevice device("WeatherStation", "1.0.0", transport);

void setup() {
  Serial.begin(115200);

  // Register the DHT module so the host can discover and control it
  device.addModule(new ConduytModuleDHT());
  device.begin();
}

void loop() {
  device.poll();
}
```

`addModule()` registers the DHT module. It will appear in the HELLO_RESP handshake so the host knows this device supports DHT commands. The `poll()` loop processes incoming packets, including module commands.

Plug in your board and flash:

```bash
pio run --target upload
```

Expected output:

```
Writing | ################################################## | 100%
avrdude done.  Thank you.
======== [SUCCESS] Took 5.41 seconds ========
```

## 3. Install the Python SDK

Create a virtual environment and install the SDK:

```bash
cd ..
mkdir conduyt-dashboard && cd conduyt-dashboard
python3 -m venv .venv
source .venv/bin/activate       # Linux/macOS
# .venv\Scripts\activate        # Windows PowerShell
pip install conduyt-py[serial]
```

Expected output:

```
Successfully installed conduyt-py-0.1.0 pyserial-3.5
```

## 4. Find your serial port

```bash
# macOS
ls /dev/cu.usb*

# Linux
ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null

# Windows: open Device Manager → Ports (COM & LPT)
```

## 5. Connect and verify the module

Create `dashboard.py` — replace `<YOUR_PORT>` with your port:

```python
# dashboard.py
import asyncio
from conduyt import ConduytDevice
from conduyt.transports.serial import SerialTransport


async def main():
    device = ConduytDevice(SerialTransport('<YOUR_PORT>'))
    hello = await device.connect()

    print(f"Firmware:  {hello.firmware_name}")
    print(f"Pins:      {len(hello.pins)}")
    print(f"Modules:   {[m.name for m in hello.modules]}")

    await device.disconnect()


asyncio.run(main())
```

```bash
python dashboard.py
```

Expected output:

```
Firmware:  WeatherStation
Pins:      20
Modules:   ['dht']
```

The `modules` list shows `'dht'` because the firmware registered `ConduytModuleDHT`. If you see `Modules: []`, double-check that `build_flags = -DCONDUYT_MODULE_DHT` is in your `platformio.ini` and re-flash.

## 6. Read the sensor

Replace the contents of `dashboard.py`:

```python
# dashboard.py
import asyncio
from conduyt import ConduytDevice
from conduyt.transports.serial import SerialTransport
from conduyt.modules import ConduytDHT


async def main():
    device = ConduytDevice(SerialTransport('<YOUR_PORT>'))
    await device.connect()

    # Create a DHT module wrapper
    # module_id=0 because it's the first (and only) module registered in the firmware
    # If you registered multiple modules, the second would be module_id=1, etc.
    dht = ConduytDHT(device, module_id=0)

    # Initialize the sensor
    # pin=4: the GPIO pin the DATA wire is connected to
    # sensor_type=22: use 22 for DHT22, or 11 for DHT11
    await dht.begin(pin=4, sensor_type=22)

    # Read temperature and humidity
    reading = await dht.read()
    print(f"Temperature: {reading.temperature} C")
    print(f"Humidity:    {reading.humidity} %")

    await device.disconnect()


asyncio.run(main())
```

```bash
python dashboard.py
```

Expected output (values depend on your environment):

```
Temperature: 23.4 C
Humidity:    51.2 %
```

**If you get NaN or 0.0:** the sensor needs ~2 seconds after power-on to stabilize. Add `await asyncio.sleep(2)` after `dht.begin()` and before `dht.read()`.

## 7. Continuous monitoring

Replace `dashboard.py` to poll every 2 seconds:

```python
# dashboard.py
import asyncio
from conduyt import ConduytDevice
from conduyt.transports.serial import SerialTransport
from conduyt.modules import ConduytDHT


async def main():
    device = ConduytDevice(SerialTransport('<YOUR_PORT>'))
    await device.connect()

    dht = ConduytDHT(device, module_id=0)
    await dht.begin(pin=4, sensor_type=22)

    print("Reading sensor every 2 seconds. Press Ctrl+C to stop.\n")
    try:
        while True:
            reading = await dht.read()
            print(f"Temp: {reading.temperature:.1f} C  |  Humidity: {reading.humidity:.1f} %")
            await asyncio.sleep(2)
    except KeyboardInterrupt:
        pass

    await device.disconnect()
    print("\nDisconnected.")


asyncio.run(main())
```

```bash
python dashboard.py
```

```
Reading sensor every 2 seconds. Press Ctrl+C to stop.

Temp: 23.4 C  |  Humidity: 51.2 %
Temp: 23.5 C  |  Humidity: 51.0 %
Temp: 23.5 C  |  Humidity: 50.8 %
^C
Disconnected.
```

The 2-second interval matches the DHT22's minimum sampling period. Reading faster than that returns stale data.

## How modules work under the hood

When you call `dht.begin(pin=4, sensor_type=22)`, the Python SDK sends a MOD_CMD packet to the device. The packet contains the module ID (0), command ID (begin), and payload (pin number + sensor type). The firmware's DHT module receives this, initializes the sensor on pin 4, and sends back an ACK.

When you call `dht.read()`, another MOD_CMD is sent. The firmware module reads the physical sensor and returns the temperature and humidity as a MOD_RESP packet.

You never construct these packets yourself — the SDK module wrappers handle the protocol.

## Next steps

- [Use Datastreams](/docs/how-to/use-datastreams) — push sensor data continuously from device to host without polling
- [Write a Module](/docs/how-to/add-module) — create your own firmware module for custom hardware
- [Packet Structure](/docs/reference/packet-structure) — full wire format specification

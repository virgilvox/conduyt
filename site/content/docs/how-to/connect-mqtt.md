---
title: Connect over MQTT
description: Set up MQTT transport for networked Conduyt devices and host SDKs.
---

# Connect over MQTT

MQTT transport lets CONDUYT devices communicate over WiFi through a message broker. The device and host don't need to be on the same machine or even the same network - they just need access to the same broker.

## Prerequisites

- An **ESP32** (or other WiFi-capable board)
- A running **MQTT broker** - see [Set Up MQTT Broker](/docs/how-to/broker-setup) for a Docker Compose setup with Mosquitto. If you don't have Docker, you can install Mosquitto directly:
  ```bash
  # Ubuntu/Debian
  sudo apt install mosquitto mosquitto-clients

  # macOS (Homebrew)
  brew install mosquitto

  # Windows: download from https://mosquitto.org/download/
  ```
- Broker credentials (username/password) if authentication is enabled

## Firmware

The firmware needs WiFi credentials and broker connection details. The `device-001` string is the **device ID** - it determines the MQTT topic prefix for this device. The host must use the same device ID to find it.

```cpp
#include <WiFi.h>
#define CONDUYT_TRANSPORT_MQTT
#include <Conduyt.h>

WiFiClient wifiClient;
ConduytMQTT transport(wifiClient, "192.168.1.100", 1883, "device-001");
ConduytDevice device("MQTTSensor", "1.0.0", transport);

void setup() {
  Serial.begin(115200);

  // Connect to WiFi
  WiFi.begin("YourSSID", "YourPassword");
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" connected!");
  Serial.println(WiFi.localIP());

  // Set MQTT credentials (must match your broker user)
  transport.setAuth("conduyt-device", "yourpassword");

  device.begin();
}

void loop() {
  device.poll();
}
```

Replace `"192.168.1.100"` with your broker's IP address, and `"YourSSID"` / `"YourPassword"` with your WiFi credentials.

**What happens if `setAuth()` is not called?** The transport connects without credentials. If your broker has `allow_anonymous false`, the connection will be rejected and `device.poll()` will silently retry.

Flash this to your ESP32:

```ini
; platformio.ini
[env:esp32]
platform = espressif32
board = esp32dev
framework = arduino
lib_deps = conduyt
build_flags = -DCONDUYT_TRANSPORT_MQTT
```

```bash
pio run --target upload
```

Open the serial monitor to verify WiFi connection:

```bash
pio device monitor --baud 115200
# Connecting to WiFi... connected!
# 192.168.1.42
```

## JavaScript host

```bash
npm install conduyt-js
```

Create `mqtt-read.mjs`:

```javascript
// mqtt-read.mjs
import { ConduytDevice } from 'conduyt-js'
import { MQTTTransport } from 'conduyt-js/transports/mqtt'

const transport = new MQTTTransport({
  broker: 'mqtt://192.168.1.100:1883',
  deviceId: 'device-001',         // must match the firmware's device ID
  username: 'conduyt-host',
  password: 'yourpassword'
})

const device = await ConduytDevice.connect(transport)

console.log('Firmware:', device.capabilities.firmwareName)

// Read analog pin
const value = await device.pin(0).read()
console.log('Pin 0 value:', value)

await device.disconnect()
```

```bash
node mqtt-read.mjs
```

Expected output:

```
Firmware: MQTTSensor
Pin 0 value: 512
```

## Python host

```bash
pip install conduyt-py[mqtt]
```

Create `mqtt-read.py`:

```python
# mqtt-read.py
import asyncio
from conduyt import ConduytDevice
from conduyt.transports.mqtt import MQTTTransport


async def main():
    transport = MQTTTransport(
        broker='192.168.1.100',
        port=1883,
        device_id='device-001',      # must match the firmware's device ID
        username='conduyt-host',
        password='yourpassword'
    )

    device = ConduytDevice(transport)
    hello = await device.connect()

    print(f"Firmware: {hello.firmware_name}")

    value = await device.pin(0).read()
    print(f"Pin 0 value: {value}")

    await device.disconnect()


asyncio.run(main())
```

```bash
python mqtt-read.py
```

## Topic structure

All topics are prefixed with `conduyt/{deviceId}/`:

| Topic | Direction | Purpose |
|-------|-----------|---------|
| `conduyt/device-001/cmd/{typeHex}` | Host → Device | Commands (e.g. `cmd/11` = PIN_WRITE) |
| `conduyt/device-001/evt/{typeHex}` | Device → Host | Events (e.g. `evt/90` = PIN_EVENT) |
| `conduyt/device-001/hello` | Device → Broker | HELLO_RESP binary payload, retained |
| `conduyt/device-001/status` | Broker (LWT) | `"online"` or `"offline"`, retained |
| `conduyt/device-001/ds/{name}/cmd` | Host → Device | Write to a named datastream |
| `conduyt/device-001/ds/{name}/evt` | Device → Host | Datastream value pushes |

## QoS strategy

The current SDKs publish every CONDUYT packet at a single QoS level. Default is QoS 1 (at-least-once); both the JS and Python `MQTTTransport` accept a `qos: 0 | 1 | 2` option to override that uniformly. Per-packet-type QoS routing is not implemented today; the table below is the *recommended* future strategy if you fork the transport for stricter guarantees.

| Packet Type | Recommended QoS | Why |
|-------------|-----|-----|
| PIN_WRITE, PIN_MODE | 1 | Must arrive; writes are idempotent so redelivery is safe |
| PIN_EVENT, STREAM_DATA | 0 | High frequency; stale data is worthless |
| OTA_CHUNK | 2 | Firmware chunks must arrive exactly once |
| DS_EVENT | 1 | Important but idempotent |
| HELLO, HELLO_RESP | 1 | Connection handshake must complete |

## Last Will and Testament

When the device connects to the broker, it registers an LWT:

- On connect: publishes `"online"` to `conduyt/{deviceId}/status` with `retain=true`
- On unexpected disconnect: the broker publishes `"offline"` to the same topic

The JS host SDK subscribes to the `status` topic on connect; the Python SDK currently subscribes only to `evt/#`. Neither host SDK fires a "disconnect" event from the status message today. If you need that, listen for the topic via your own MQTT client and react to `"offline"` payloads, or wrap the transport in `ReconnectTransport` (JS only) to auto-reconnect on link drops.

## Framing

MQTT is message-oriented - each MQTT publish is one complete CONDUYT packet. No COBS framing is applied. This differs from serial and BLE, which are byte streams and need COBS to delimit packets.

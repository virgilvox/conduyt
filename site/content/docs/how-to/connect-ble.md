---
title: Connect over BLE
description: Set up Bluetooth Low Energy communication between a host and a Conduyt device.
---

# Connect over BLE

BLE transport enables wireless communication without a network or broker. It works point-to-point: one host connects directly to one device.

## Prerequisites

- **ESP32** or **nRF52** board (ESP32-S3, ESP32-C3, nRF52832, nRF52840 all work)
- A host with Bluetooth: **Chrome/Edge** browser (WebBluetooth), **iOS/macOS** (ConduytKit), or any platform with BLE APIs

## Firmware

```cpp
#define CONDUYT_TRANSPORT_BLE
#include <Conduyt.h>

// The string is the BLE advertised name - visible in the browser/phone picker
// Keep it under 20 characters (BLE advertisement payload limit is 31 bytes total,
// and the name shares space with service UUIDs and flags)
ConduytBLE transport("MyDevice");
ConduytDevice device("BLEDevice", "1.0.0", transport);

void setup() {
  device.begin();   // starts BLE advertising automatically
}

void loop() {
  device.poll();
}
```

Flash with PlatformIO:

```ini
; platformio.ini
[env:esp32]
platform = espressif32
board = esp32dev
framework = arduino
lib_deps = conduyt
build_flags = -DCONDUYT_TRANSPORT_BLE
```

```bash
pio run --target upload
```

After flashing, the device starts advertising immediately. You should see "MyDevice" in any BLE scanner app.

## BLE transport details

CONDUYT defines its own GATT service with three characteristics. The UUIDs are the firmware-side defaults; both the firmware (`firmware/src/conduyt/transport/ConduytBLE.h`) and the JS SDK (`sdk/js/src/transports/ble.ts`) use these by default.

| Characteristic | UUID | Direction |
|----------------|------|-----------|
| Service | `0000cd01-0000-1000-8000-00805f9b34fb` | - |
| TX (notifications) | `0000cd02-0000-1000-8000-00805f9b34fb` | Device to Host |
| RX (write) | `0000cd03-0000-1000-8000-00805f9b34fb` | Host to Device |

If you build a custom BLE central (raw CoreBluetooth, native Android, MicroPython BLE), scan and subscribe against these exact UUIDs. The JS `BLETransport` constructor accepts `{ serviceUUID, txCharUUID, rxCharUUID }` overrides if you ever need to point at a different service.

BLE is a byte stream, so CONDUYT applies **COBS framing** to delimit packets, same as serial. The transport handles this automatically.

**MTU:** The default BLE MTU is 20 bytes. CONDUYT packets larger than 20 bytes are automatically split across multiple BLE writes by the transport layer. For better throughput, the SDK negotiates a larger MTU (up to 512 bytes) when both sides support it.

## JavaScript (Browser - WebBluetooth)

WebBluetooth only works in **Chrome** or **Edge** on desktop. It requires a **user gesture** to trigger the device picker - you must call `connect()` inside a `click`, `keydown`, or `pointerdown` handler. Calling it on page load will fail.

```html
<!DOCTYPE html>
<html>
<head><title>CONDUYT BLE</title></head>
<body>
  <button id="connect">Connect</button>
  <button id="toggle" disabled>Toggle LED</button>
  <pre id="log"></pre>

  <script type="module">
    import { ConduytDevice } from 'conduyt-js'
    import { BLETransport } from 'conduyt-js/transports/ble'

    const logEl = document.getElementById('log')
    function print(msg) { logEl.textContent += msg + '\n' }

    let device = null
    let ledOn = false

    document.getElementById('connect').addEventListener('click', async () => {
      try {
        // This opens the browser's Bluetooth device picker
        // The picker is filtered to devices advertising the CONDUYT service
        const transport = new BLETransport()
        device = await ConduytDevice.connect(transport)

        print(`Connected to: ${device.capabilities.firmwareName}`)
        print(`Pins: ${device.capabilities.pins.length}`)

        await device.pin(13).mode('output')
        document.getElementById('toggle').disabled = false
        document.getElementById('connect').disabled = true

        // Poll device.connected to detect link drops. The SDK does not expose a
        // public 'disconnect' event today; check `device.connected` periodically
        // (or wrap the transport in ReconnectTransport for auto-reconnect).
        const checkLink = setInterval(() => {
          if (!device.connected) {
            clearInterval(checkLink)
            print('Disconnected')
            document.getElementById('toggle').disabled = true
            document.getElementById('connect').disabled = false
            device = null
            ledOn = false
          }
        }, 1000)
      } catch (err) {
        print('Failed: ' + err.message)
      }
    })

    document.getElementById('toggle').addEventListener('click', async () => {
      if (!device) return
      ledOn = !ledOn
      await device.pin(13).write(ledOn ? 1 : 0)
      print('LED ' + (ledOn ? 'ON' : 'OFF'))
    })
  </script>
</body>
</html>
```

Serve this file over HTTPS (WebBluetooth requires a secure context) or from `localhost`:

```bash
npx serve .
# Open http://localhost:3000
```

## Swift (iOS / macOS)

ConduytKit wraps CoreBluetooth and handles CONDUYT service discovery, COBS framing, and the protocol:

```swift
import ConduytKit

// BLETransport scans for the CONDUYT GATT service. Pass `name:` or `uuid:` to
// filter the picker; otherwise it connects to the first device that advertises
// the service.
let transport = BLETransport()
let device = ConduytDevice(transport: transport)

// connect() returns the raw HELLO_RESP Data; on iOS this also triggers the
// system Bluetooth permission prompt on first use.
let helloData = try await device.connect()
print("Connected, HELLO_RESP \(helloData.count) bytes")

// Pin control. ConduytKit uses flat methods on the device (no pin proxy);
// constants live on `ConduytPinMode` and `ConduytSubMode`.
try await device.pinMode(13, mode: ConduytPinMode.output)
try await device.pinWrite(13, value: 1)
print("LED on")

let value = try await device.pinRead(0)
print("A0 = \(value)")

try await device.disconnect()
```

### Using CoreBluetooth directly

If you're not using ConduytKit, scan for the CONDUYT service UUID (`0000cd01-0000-1000-8000-00805f9b34fb`), subscribe to notifications on the TX characteristic (`0000cd02-...`), and write to the RX characteristic (`0000cd03-...`). All data must pass through COBS encode/decode since BLE is a byte stream.

## Troubleshooting

### Device not found in picker

- Confirm the firmware is running and advertising. BLE advertising starts after `device.begin()`. Try pressing the RESET button on the board.
- If the device was previously paired/bonded to another host, clear the bond on both sides (forget the device in Bluetooth settings, then reset the board).
- Make sure you're within ~5 meters. BLE range drops significantly through walls.

### Connection drops frequently

- Keep the device within 5 meters for reliable communication
- Avoid running WiFi and BLE simultaneously on ESP32 - they share the same radio and can interfere with each other
- Check for 2.4 GHz interference (microwaves, other WiFi networks)

### "User cancelled" / no picker appears

WebBluetooth requires a user gesture. Make sure `connect()` is called inside a click handler, not on page load or in a `setTimeout`.

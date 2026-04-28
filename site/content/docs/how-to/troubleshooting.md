---
title: Troubleshooting
description: Common CONDUYT issues and how to fix them.
---

# Troubleshooting

## Connection issues

### "Timeout waiting for response"

The host sent a packet but the device didn't respond in time.

**Check these in order:**

1. **Wrong port?** Re-check your serial port path:
   ```bash
   # macOS
   ls /dev/cu.usb*
   # Linux
   ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null
   ```
2. **Port already open?** Close any serial monitors (Arduino IDE, PlatformIO, `screen`, `minicom`). Only one process can hold a serial port at a time.
3. **Firmware not running?** Open the Arduino IDE Serial Monitor at 115200 baud. If you see nothing, the firmware isn't running. Re-flash.
4. **Board stuck?** Press the physical RESET button on the board, wait 1 second, then reconnect.
5. **Wrong baud rate?** Both firmware and host must use the same baud rate (default: 115200).

### "Not connected" error

You tried to send a command before calling `device.connect()` or before the handshake completed.

```javascript
// Wrong - sending before connect resolves
const device = new ConduytDevice(transport)
await device.pin(13).write(1)  // throws "Not connected"

// Right - wait for connect first
const device = await ConduytDevice.connect(transport)
await device.pin(13).write(1)  // works
```

### Serial port not found

**macOS:**

```bash
ls /dev/cu.usb*
# If nothing appears, check System Information → USB
# or: system_profiler SPUSBDataType | grep -A 5 -i arduino
```

**Linux:**

```bash
ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null
# If nothing appears, check dmesg for USB events:
dmesg | tail -20
```

If the port exists but you get "Permission denied":

```bash
sudo usermod -aG dialout $USER
# IMPORTANT: you must log out and log back in for this to take effect
```

**Windows:** Open Device Manager → Ports (COM & LPT). If your board shows up with a yellow warning icon, you need drivers:
- **CH340/CH341** (many ESP32 boards): [download from WCH](https://www.wch-ic.com/downloads/CH341SER_EXE.html)
- **FTDI** (some Arduino clones): [download from FTDI](https://ftdichip.com/drivers/)
- **CDC** (Uno R4, native USB boards): built into Windows 10+, no driver needed

**All platforms:** Some USB cables are **charge-only** and don't carry data. If the port doesn't appear at all, try a different cable.

## Protocol errors

### "NAK: INVALID_PIN"

The pin number doesn't exist on the board, or the pin doesn't support the requested mode.

```javascript
// This fails on Arduino Uno - it only has pins 0-19
await device.pin(25).mode('output')  // NAK: INVALID_PIN

// This fails because pin 13 doesn't support analog input
await device.pin(13).mode('analog')  // NAK: PIN_MODE_UNSUPPORTED
```

Check the board's pin capabilities in `device.capabilities.pins`:

```javascript
const pin = device.capabilities.pins[13]
console.log('Pin 13 supports:', pin.modes)
// e.g. ['input', 'output', 'pwm']
```

### "NAK: MODULE_NOT_LOADED"

You sent a module command but the firmware doesn't have that module enabled.

**Fix:** Make sure you:
1. Added the `#define` flag in `platformio.ini`:
   ```ini
   build_flags = -DCONDUYT_MODULE_DHT
   ```
2. Registered the module in your sketch:
   ```cpp
   device.addModule(new ConduytModuleDHT());
   ```
3. Re-flashed the board after making changes

### "CRC mismatch"

The packet's CRC8 checksum failed - data was corrupted in transit.

**Common causes:**
- Baud rate mismatch between host and firmware - double-check both use 115200
- Noisy/long USB cable - try a shorter cable
- Payload exceeds the max buffer - default is 256 bytes on Uno, 512 on ESP32

## Firmware issues

### Board doesn't respond after flashing

The firmware might be crashing. Add a debug print to verify it's running:

```cpp
void loop() {
  Serial.println("alive");   // shows in serial monitor at 115200 baud
  device.poll();
}
```

If you see "alive" repeating but the host can't connect, the transport might not be initialized. Make sure `Serial.begin(115200)` is in `setup()`.

Common crash causes:
- **Out of RAM** (especially Uno R3 with 2 KB) - reduce modules, datastreams, or payload size
- **Blocking calls in loop()** - never call `delay()` in the main loop; use non-blocking timing with `millis()`
- **I2C/SPI bus locked** - a sensor not responding can hang the bus

### "not in sync" during upload (AVR boards)

The IDE can't reach the bootloader.

1. Select the correct board and port in **Tools** menu
2. Close any serial monitors
3. Try: hold RESET, click Upload, release RESET when you see "Uploading..."
4. For CH340 clones: install [CH340 drivers](https://www.wch-ic.com/downloads/CH341SER_EXE.html)

## Playground issues

### "WebSerial not supported"

WebSerial requires **Chrome** or **Edge** on desktop. Firefox, Safari, and mobile browsers don't support it.

### "No DFU device found" (Uno R4)

The board isn't in DFU mode. Double-tap the RESET button quickly (within ~500ms). The "L" LED should start pulsing slowly. If it doesn't pulse, try again faster.

### Code runs but nothing happens on the board

1. Check the Device panel - does it say "Connected"?
2. Make sure your code calls `await device.connect()` first
3. Check the Console panel for error messages
4. Try clicking **Stop**, then **Run** again

## Performance

### Slow response times

| Transport | Throughput | Tip |
|-----------|-----------|-----|
| Serial (115200) | ~11 KB/s | Increase baud to 230400, 460800, or 921600 |
| BLE | ~2 KB/s (20-byte MTU) | Negotiate larger MTU; keep packets small |
| MQTT | Adds broker hop latency | Use serial or TCP for low-latency control |

### PIN_SUBSCRIBE flooding

Subscribing with a very short interval (e.g., 10ms) floods the serial buffer.

**Fix:** Use a reasonable interval (100ms+) and set a change threshold so the device only sends updates when the value changes:

```javascript
// `intervalMs` (not `interval`) is the option name; `threshold` only emits
// when the value moves by more than this delta from the last report.
for await (const v of device.pin('A0').subscribe({ intervalMs: 100, threshold: 5 })) {
  console.log(v)
}
```

---
title: Update Firmware Over the Air
description: Flash new firmware over the existing CONDUYT connection — no USB cable, no DFU button.
---

# Update Firmware Over the Air

Once a device is running CONDUYT firmware compiled with `-DCONDUYT_OTA`, the host can replace its firmware over whatever transport is already connected (Serial, BLE, MQTT bridge, WebSerial in the browser). No USB cable, no DFU button, no `esp-web-tools`.

The flow is simple:

1. The host computes a SHA-256 of the new firmware blob.
2. It sends `OTA_BEGIN` with the total byte count + the SHA-256.
3. It streams the firmware in `OTA_CHUNK` packets at sequential offsets.
4. It sends `OTA_FINALIZE` to verify the digest and reboot into the new image.

Every SDK ships a typed `ConduytOTA` orchestrator that does all four steps for you.

## Firmware setup

OTA support is opt-in per board. Add the compile flag and let CONDUYT's `ConduytOTA` runtime hook into the device:

```ini
; platformio.ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
build_flags = -DCONDUYT_OTA
```

```cpp
#include <Conduyt.h>

ConduytSerial transport(Serial, 115200);
ConduytDevice device("MyBoard", "1.0.0", transport);

void setup() {
  Serial.begin(115200);
  device.begin();   // OTA handlers wire in automatically when CONDUYT_OTA is defined
}

void loop() {
  device.poll();
}
```

OTA today is supported on the **ESP32 family** (esp32, S2, S3, C3) and **Arduino Nano ESP32** — wherever `Update.h` is available. AVR boards (Uno R3, Nano, Mega) and most Cortex-M boards (Teensy, Pico, R4 Minima) lack the bootloader / off-chip flash needed for in-place updates and currently NAK `OTA_BEGIN` with `OTA_INVALID` (0x0F). Check `device.capabilities.otaCapable` before starting.

## Host usage

Identical wire bytes, identical chunk size auto-tuning, identical progress callback, in every SDK:

### JavaScript

```javascript
import { ConduytDevice, ConduytOTA } from 'conduyt-js'
import { SerialTransport } from 'conduyt-js/transports/serial'

const device = await ConduytDevice.connect(new SerialTransport({ path: '<YOUR_PORT>' }))
if (!device.capabilities?.otaCapable) {
  throw new Error('Firmware does not support OTA — rebuild with -DCONDUYT_OTA')
}

const fw = new Uint8Array(await fs.promises.readFile('./firmware.bin'))
const ota = new ConduytOTA(device)

await ota.flash(fw, {
  onProgress: (sent, total) => console.log(`${sent}/${total} (${(100 * sent / total).toFixed(1)}%)`),
})

console.log('Flashed — device is rebooting.')
```

### Python

```python
import asyncio
from conduyt import ConduytDevice, ConduytOTA
from conduyt.transports.serial import SerialTransport


async def main():
    device = ConduytDevice(SerialTransport('<YOUR_PORT>'))
    await device.connect()
    if not device.capabilities.ota_capable:
        raise RuntimeError("Firmware does not support OTA — rebuild with -DCONDUYT_OTA")

    with open('firmware.bin', 'rb') as f:
        fw = f.read()

    ota = ConduytOTA(device)
    await ota.flash(
        fw,
        on_progress=lambda sent, total: print(f"{sent}/{total} ({100*sent/total:.1f}%)"),
    )


asyncio.run(main())
```

### Go

```go
package main

import (
    "context"
    "fmt"
    "log"
    "os"

    conduyt "github.com/virgilvox/conduyt/sdk/go"
    "github.com/virgilvox/conduyt/sdk/go/ota"
    "github.com/virgilvox/conduyt/sdk/go/transports"
)

func main() {
    transport, _ := transports.NewSerial("/dev/cu.usbmodem14101", 115200)
    device := conduyt.NewDevice(transport, 5_000_000_000)
    ctx := context.Background()
    if _, err := device.Connect(ctx); err != nil { log.Fatal(err) }

    fw, err := os.ReadFile("firmware.bin")
    if err != nil { log.Fatal(err) }

    err = ota.Flash(ctx, device, fw, ota.Options{
        OnProgress: func(sent, total int) {
            fmt.Printf("%d / %d (%.1f%%)\n", sent, total, 100.0*float64(sent)/float64(total))
        },
    })
    if err != nil { log.Fatal(err) }
}
```

### Rust

```toml
# Cargo.toml
[dependencies]
conduyt = { version = "0.3", features = ["ota"] }
```

```rust
use conduyt::device::Device;
use conduyt::ota::{flash, FlashOptions};
use conduyt::transports::serial::SerialTransport;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let transport = SerialTransport::open("/dev/cu.usbmodem14101", 115200)?;
    let mut device = Device::new(transport);
    device.connect()?;

    let fw = std::fs::read("firmware.bin")?;
    let mut on_progress = |sent: usize, total: usize| {
        println!("{} / {} ({:.1}%)", sent, total, 100.0 * sent as f64 / total as f64);
    };
    flash(&mut device, &fw, FlashOptions {
        on_progress: Some(&mut on_progress),
        ..Default::default()
    })?;
    Ok(())
}
```

### Swift

```swift
import ConduytKit
import Foundation

let transport = BLETransport(serviceUUID: ...)
let device = ConduytDevice(transport: transport)
_ = try await device.connect()

let fwURL = Bundle.main.url(forResource: "firmware", withExtension: "bin")!
let fw = try Data(contentsOf: fwURL)

let ota = ConduytOTA(device: device)
try await ota.flash(fw, options: OTAFlashOptions(onProgress: { sent, total in
    print("\(sent) / \(total) (\(100 * Double(sent) / Double(total))%)")
}))
```

## Wire format reference

| Command | ID | Payload | NAK code on error |
|---|---|---|---|
| OTA_BEGIN | `0x70` | `total_bytes (u32 LE) + sha256 (32 bytes)` | `0x0F OTA_INVALID` |
| OTA_CHUNK | `0x71` | `offset (u32 LE) + data (N bytes)` | `0x0F OTA_INVALID` (out-of-order or after Update.write fails) |
| OTA_FINALIZE | `0x72` | (empty) | `0x0F OTA_INVALID` (digest mismatch / Update.end failure) |

After `OTA_FINALIZE` ACKs, the firmware reboots immediately. Any packet sent on the same connection in the next ~1–3 seconds will fail. Reconnect.

## Notes

- **Chunk size**: each SDK auto-sizes chunks based on `HELLO_RESP.maxPayload`. The device reserves 4 bytes of every payload for the offset header, so chunks are `(maxPayload - 4)` bytes by default. ESP32 advertises 1024, so chunks are 1020 bytes — about 2 chunks per kilobyte of firmware.
- **Sequential offsets**: chunks must be sent in ascending offset order. The firmware NAKs any out-of-order chunk to keep `Update.write` happy. None of the SDK orchestrators reorder, so this is automatic if you use them.
- **Hashing on the host**: the SHA-256 is computed on the host and verified by the firmware at finalize time. A mid-flight transport corruption that slips past CRC8 will still get caught here.
- **Rollback**: there's no rollback in the OTA spec itself — if the new firmware bricks itself, you fall back to USB / DFU. Keep a known-good build handy.

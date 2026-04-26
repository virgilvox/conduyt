---
title: "Rust SDK"
description: "no_std-compatible Rust core + std device API — embedded firmware and host clients from the same crate."
---

# Rust SDK

The Rust SDK is the source of truth for the protocol. The `conduyt` crate has a `no_std` core (wire/COBS/CRC8) for embedded use and an opt-in `std` feature that adds the full host-side device client with transports and module wrappers.

## Install

```toml
# Cargo.toml — host client (default)
[dependencies]
conduyt = { version = "0.3", features = ["std"] }

# Cargo.toml — no_std embedded
[dependencies]
conduyt = { version = "0.3", default-features = false }
```

## Quick start (host)

```rust
use conduyt::device::Device;
use conduyt::transports::serial::SerialTransport;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let transport = SerialTransport::open("/dev/cu.usbmodem14101", 115200)?;
    let mut device = Device::new(transport);

    let hello = device.connect()?;
    println!("connected — {} bytes of HELLO_RESP", hello.len());

    device.pin_mode(13, conduyt::PIN_MODE_OUTPUT)?;
    device.pin_write(13, 1)?;
    device.close()?;
    Ok(())
}
```

## Modules

Module wrappers live under `conduyt::modules`. They borrow `&mut Device<T>` so you can keep using the device after a module call returns:

```rust
use conduyt::modules::{
    servo::Servo,
    neopixel::NeoPixel,
    oled::OLED,
    dht::DHT,
    encoder::Encoder,
    stepper::Stepper,
    pid::PID,
};

let mut servo = Servo::new(&mut device, 0);   // module_id = 0
servo.attach(9, 1000, 2000)?;
servo.write(90)?;
```

Each wrapper takes the device and a `module_id` byte. Get the ID from the parsed `HELLO_RESP` (or hard-code if you control the firmware). See the per-module pages under [Modules](/docs/modules) for command references.

## no_std core

If you're writing an embedded host (or even another firmware that talks CONDUYT), use the core with `default-features = false`:

```rust
use conduyt::wire::{wire_encode, wire_decode, make_packet};

let pkt = make_packet(0x01 /* CMD_PING */, 0, &[]);
let mut buf = [0u8; 32];
let n = wire_encode_into(&pkt, &mut buf);    // no allocation
```

The no_std build pulls in `alloc` for `Vec` but no `std`. Suitable for `#[no_std]` Rust embedded targets (RP2040, ESP32-via-`esp-rs`, nRF52, STM32).

## Transports

| Transport | Module | Feature flag |
|---|---|---|
| Serial | `conduyt::transports::serial::SerialTransport` | `std` (uses `serialport` crate) |
| Mock | `conduyt::transports::MockTransport` | `std` |

For embedded transports, implement the `Transport` trait yourself — it's three methods (`connect`, `send`, `recv`) and an associated error type.

## Errors

Every device method returns `Result<T, DeviceError<T::Error>>`. `DeviceError` distinguishes:

- `Transport(_)` — your transport returned an error
- `Nak { code, name, seq }` — firmware returned NAK with a known error code
- `Timeout { seq }` — no response within the configured window
- `WireError(_)` — bad magic, CRC mismatch, version mismatch, etc.
- `NotConnected` — you called a method before `connect()`

## Versioning

The crate uses semver. `0.3.x` requires firmware running protocol version 2 — exposed as `conduyt::PROTOCOL_VERSION`.

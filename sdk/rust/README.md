# conduyt

CONDUYT protocol SDK for Rust. `no_std` core with optional `std` device client.

## Install

```toml
[dependencies]
conduyt = "0.1"
```

For `no_std` (core wire/cobs/crc only):

```toml
[dependencies]
conduyt = { version = "0.1", default-features = false }
```

## Quick Start

```rust
use conduyt::device::Device;
use conduyt::transports::MockTransport;
use conduyt::constants::*;

let transport = MockTransport::new();
let mut device = Device::new(transport);
let hello = device.connect()?;

device.pin_mode(13, PIN_MODE_OUTPUT)?;
device.pin_write(13, 1)?;
let value = device.pin_read(0)?;
println!("Pin 0: {}", value);

device.close()?;
```

### Core Only (no_std)

```rust
use conduyt::wire::{wire_encode, wire_decode};
use conduyt::crc8::crc8;
use conduyt::cobs::{cobs_encode, cobs_decode};

let encoded = wire_encode(CMD_PING, 0, &[]);
let packet = wire_decode(&encoded)?;
```

## API Reference

### Device<T: Transport>

| Method | Returns | Description |
|--------|---------|-------------|
| `Device::new(transport)` | `Device<T>` | Create device instance |
| `connect()` | `Result<Vec<u8>>` | Connect and HELLO handshake |
| `close()` | `Result<()>` | Close connection |
| `ping()` | `Result<()>` | Ping/pong roundtrip |
| `reset()` | `Result<()>` | Reset device state |
| `pin_mode(pin, mode)` | `Result<()>` | Set pin mode |
| `pin_write(pin, value)` | `Result<()>` | Digital/PWM write |
| `pin_read(pin)` | `Result<u16>` | Read pin value |
| `mod_cmd(payload)` | `Result<Vec<u8>>` | Send raw module command |

### DeviceError<E>

| Variant | When |
|---------|------|
| `Transport(E)` | Transport-level failure |
| `Nak` | Device rejected a command |
| `Timeout` | No response within timeout |
| `WireError` | Packet decode failure |
| `NotConnected` | Command sent before connect |

### Core (no_std)

| Function | Module | Description |
|----------|--------|-------------|
| `wire_encode` | `conduyt::wire` | Encode packet to bytes |
| `wire_decode` | `conduyt::wire` | Decode bytes to packet |
| `crc8` | `conduyt::crc8` | CRC8 checksum |
| `cobs_encode` | `conduyt::cobs` | COBS encode |
| `cobs_decode` | `conduyt::cobs` | COBS decode |

## Features

| Feature | Default | Description |
|---------|---------|-------------|
| `std` | Yes | Device client, transports, modules |

## Requirements

- Rust 2021 edition
- `no_std` compatible (without `std` feature)

## License

MIT. Copyright (c) 2026 LumenCanvas.

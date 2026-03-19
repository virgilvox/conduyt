# ConduytKit

CONDUYT protocol SDK for Swift. Async/await host-side hardware control for iOS and macOS.

## Install

Add to your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/virgilvox/conduyt", from: "0.1.0")
]
```

Then add `"ConduytKit"` to your target's dependencies.

## Quick Start

```swift
import ConduytKit

let transport = BLETransport()
let device = ConduytDevice(transport: transport)

let hello = try await device.connect()
print("Connected: \(hello)")

try await device.pinMode(13, mode: .output)
try await device.pinWrite(13, value: 1)
let value = try await device.pinRead(0)
print("Pin 0: \(value)")

try await device.disconnect()
```

### Module Command

```swift
let response = try await device.modCmd(Data([0x00, 0x01, 90]))
```

## API Reference

### ConduytDevice

| Method | Returns | Description |
|--------|---------|-------------|
| `init(transport:, timeout:)` | `ConduytDevice` | Create device instance |
| `connect()` | `Data` | Connect and HELLO handshake |
| `disconnect()` | `Void` | Close connection |
| `ping()` | `Void` | Ping/pong roundtrip |
| `reset()` | `Void` | Reset device state |
| `pinMode(_:, mode:)` | `Void` | Set pin mode |
| `pinWrite(_:, value:)` | `Void` | Digital/PWM write |
| `pinRead(_:)` | `UInt16` | Read pin value |
| `modCmd(_:)` | `Data` | Send raw module command |

### Transports

| Transport | Description |
|-----------|-------------|
| `BLETransport` | Bluetooth Low Energy (CoreBluetooth) |

### ConduytTransport Protocol

```swift
protocol ConduytTransport: AnyObject {
    func connect() async throws
    func disconnect() async throws
    func send(_ data: Data) async throws
    func onReceive(_ handler: @escaping (Data) -> Void)
    var connected: Bool { get }
    var needsCOBS: Bool { get }
}
```

## Requirements

- iOS 15+ or macOS 12+
- Swift 5.9+

## License

MIT. Copyright (c) 2026 LumenCanvas.

---
title: "Swift SDK"
description: "Swift Package Manager client for CONDUYT — async/await, BLE-first, iOS + macOS."
---

# Swift SDK

`ConduytKit` is the official Swift SDK. It uses async/await throughout, ships as a Swift Package, and is built for iOS / macOS / iPadOS apps that want to talk to CONDUYT-firmware boards over Bluetooth LE or USB-serial bridges.

## Install

Add the package to your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/virgilvox/conduyt.git", from: "1.0.0"),
],
targets: [
    .target(
        name: "MyApp",
        dependencies: [
            .product(name: "ConduytKit", package: "conduyt"),
        ]
    ),
]
```

In Xcode: **File → Add Package Dependencies…** → paste the GitHub URL.

Minimum platforms: iOS 15, macOS 12 (`async`/`await` requires it).

## Quick start (BLE)

```swift
import ConduytKit

// BLETransport(name: String? = nil, uuid: UUID? = nil). Pass `name:` to filter
// the picker by advertised name, `uuid:` to target a specific device, or
// neither to take the first CONDUYT-service advertiser.
let transport = BLETransport()
let device = ConduytDevice(transport: transport)

Task {
    do {
        let hello = try await device.connect()
        print("connected, \(hello.count) bytes of HELLO_RESP")

        try await device.pinMode(13, mode: ConduytPinMode.output)
        try await device.pinWrite(13, value: 1)

        try await device.disconnect()
    } catch {
        print("error: \(error)")
    }
}
```

## Modules

Module wrappers are in `ConduytKit.Modules`. Each wraps a connected device and a `moduleID`:

```swift
import ConduytKit

let servo = ConduytServo(device: device, moduleID: 0)
try await servo.attach(pin: 9, minUs: 1000, maxUs: 2000)
try await servo.write(angle: 90)

let neo = ConduytNeoPixel(device: device, moduleID: 1)
try await neo.begin(pin: 6, count: 64)
try await neo.fill(r: 0, g: 255, b: 0)
try await neo.show()
```

Available wrappers: `ConduytServo`, `ConduytNeoPixel`, `ConduytOLED`, `ConduytDHT`, `ConduytEncoder`, `ConduytStepper`, `ConduytPID`. See per-module pages under [Modules](/docs/modules/servo).

## Errors

Every async device call throws `ConduytDeviceError`:

- `.notConnected` — call `connect()` first
- `.timeout(seq:)` — no response within `timeout` (default 5s)
- `.nak(code:name:)` — firmware returned NAK with an error code
- `.disconnected` — transport closed mid-operation

## Transports

| Transport | Type | Notes |
|---|---|---|
| BLE | `BLETransport` | CoreBluetooth-based, GATT service / characteristics configured at init |
| Serial | (BYO) | Implement `ConduytTransport` against `IOKit` or `ORSSerialPort` for macOS USB |

## Concurrency

`ConduytDevice` is `actor`-style in spirit but currently uses an `NSLock` internally for the pending-continuations map. You can call methods from any task; sequence numbers are atomically allocated. For long-running listeners, store the device on `@MainActor` or another actor as appropriate for your app architecture.

## Versioning

The package follows the protocol version. `1.x` requires firmware running protocol version 2 — exposed as `ConduytProtocol.version`.

---
title: "Go SDK"
description: "Idiomatic Go client for CONDUYT — context-aware, no third-party deps, with module sub-packages."
---

# Go SDK

The Go SDK is a single module — `github.com/virgilvox/conduyt/sdk/go` — with module-specific sub-packages under `sdk/go/modules/`. It uses standard `context.Context`, has no third-party dependencies, and works with any transport that implements the `Transport` interface (USB-serial provided; bring your own for BLE / TCP / etc.).

## Install

```bash
go get github.com/virgilvox/conduyt/sdk/go@latest
```

## Quick start

```go
package main

import (
    "context"
    "fmt"
    "log"
    "time"

    conduyt "github.com/virgilvox/conduyt/sdk/go"
    "github.com/virgilvox/conduyt/sdk/go/transports"
)

func main() {
    transport, err := transports.NewSerial("/dev/cu.usbmodem14101", 115200)
    if err != nil {
        log.Fatal(err)
    }
    device := conduyt.NewDevice(transport, 5*time.Second)

    ctx := context.Background()
    hello, err := device.Connect(ctx)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println("connected to", hello.FirmwareName)

    if err := device.PinMode(ctx, 13, conduyt.PinModeOutput); err != nil {
        log.Fatal(err)
    }
    if err := device.PinWrite(ctx, 13, 1); err != nil {
        log.Fatal(err)
    }

    _ = device.Close()
}
```

## Modules

Each module is a sub-package. Import what you need:

```go
import (
    "github.com/virgilvox/conduyt/sdk/go/modules/servo"
    "github.com/virgilvox/conduyt/sdk/go/modules/neopixel"
    "github.com/virgilvox/conduyt/sdk/go/modules/oled"
    "github.com/virgilvox/conduyt/sdk/go/modules/dht"
    "github.com/virgilvox/conduyt/sdk/go/modules/encoder"
    "github.com/virgilvox/conduyt/sdk/go/modules/stepper"
    "github.com/virgilvox/conduyt/sdk/go/modules/pid"
)

s := servo.New(device, 0)   // moduleID = 0 (resolve from HELLO_RESP)
if err := s.Attach(ctx, 9, 1000, 2000); err != nil { log.Fatal(err) }
if err := s.Write(ctx, 90); err != nil { log.Fatal(err) }
```

Look up the module ID from `device.Capabilities().Modules` to avoid hard-coding it. See the per-module pages under [Modules](/docs/modules) for command reference.

## Transports

| Transport | Package | Notes |
|---|---|---|
| Serial | `transports.NewSerial(path, baud)` | Pure-Go USB-serial via `go.bug.st/serial` (vendored) |
| Mock | `transports.NewMock()` | In-memory, captures `SentPackets`, lets you `Inject` responses |

## Concurrency

`*conduyt.Device` is safe to share across goroutines for sending commands. Each method takes a `context.Context` so you can cancel or timeout per-call. Internally there's a single sequence-number counter under a mutex.

## Versioning

`conduyt-go` is versioned by git tag (`v1.0.0`, etc.). It requires firmware running protocol version 2. The version byte is exported as `conduyt.ProtocolVersion`.

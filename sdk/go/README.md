# conduyt-go

CONDUYT protocol SDK for Go. Host-side hardware control with goroutine-based receive loop.

## Install

```bash
go get github.com/conduyt-io/conduyt-go
```

## Quick Start

```go
package main

import (
    "context"
    "fmt"

    conduyt "github.com/conduyt-io/conduyt-go"
    "github.com/conduyt-io/conduyt-go/transports"
)

func main() {
    ctx := context.Background()
    transport := transports.NewMock()
    device := conduyt.NewDevice(transport)

    hello, err := device.Connect(ctx)
    if err != nil {
        panic(err)
    }
    fmt.Printf("Connected: %s v%d.%d.%d\n",
        hello.FirmwareName, hello.VerMajor, hello.VerMinor, hello.VerPatch)

    // Pin control
    pin := device.Pin(13)
    pin.Mode(ctx, conduyt.PinModeOutput)
    pin.Write(ctx, 1)

    value, _ := device.Pin(0).Read(ctx)
    fmt.Println("Pin 0:", value)

    device.Close()
}
```

### Module Usage

```go
import "github.com/conduyt-io/conduyt-go/modules/servo"

s := servo.New(device)
s.Attach(ctx, 9)
s.Write(ctx, 90)
```

## API Reference

### Device

| Method | Returns | Description |
|--------|---------|-------------|
| `NewDevice(transport)` | `*Device` | Create device instance |
| `Connect(ctx)` | `(*HelloResp, error)` | Connect and HELLO handshake |
| `Close()` | `error` | Close connection |
| `Ping(ctx)` | `error` | Ping/pong roundtrip |
| `Reset(ctx)` | `error` | Reset device state |
| `Pin(num)` | `*Pin` | Pin control object |
| `ModCmd(ctx, payload)` | `([]byte, error)` | Send raw module command |
| `Capabilities()` | `*HelloResp` | Last HELLO response |

### Pin

| Method | Returns | Description |
|--------|---------|-------------|
| `Mode(ctx, mode)` | `error` | Set pin mode |
| `Write(ctx, value)` | `error` | Digital/PWM write |
| `Read(ctx)` | `(uint16, error)` | Read pin value |

### Errors

| Type | When |
|------|------|
| `NAKError` | Device rejected a command |
| `TimeoutError` | No response within timeout |

## Transports

| Transport | Package | Use Case |
|-----------|---------|----------|
| `MockTransport` | `transports` | Testing |

## Requirements

- Go >= 1.22

## License

MIT. Copyright (c) 2026 LumenCanvas.

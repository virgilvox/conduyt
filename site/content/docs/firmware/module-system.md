---
title: Module System
description: Extending CONDUYT firmware with custom hardware modules
---

# Module System

Modules are opt-in C++ classes that add hardware capabilities to a CONDUYT device. They handle MOD_CMD packets and can emit MOD_EVENT responses.

## Module Interface

```cpp
class ConduytModuleBase {
public:
    virtual const char* name() = 0;        // max 8 chars
    virtual uint8_t versionMajor() { return 1; }
    virtual uint8_t versionMinor() { return 0; }
    virtual void begin() {}                // called after device.begin()
    virtual void handle(uint8_t cmd, ConduytPayloadReader &payload, ConduytContext &ctx) = 0;
    virtual void poll() {}                 // called every loop cycle
    virtual uint8_t pinCount() { return 0; }
    virtual const uint8_t* pins() { return nullptr; }
};
```

## Quick Module (Macro Pattern)

```cpp
#define CONDUYT_MODULE_MYMODULE
// In your .h file:

CONDUYT_MODULE(MyModule) {
public:
    const char* name() override { return "mymod"; }

    void handle(uint8_t cmd, ConduytPayloadReader &payload, ConduytContext &ctx) override {
        CONDUYT_ON_CMD(0x01) {
            uint8_t value = payload.readUInt8();
            // Do something with value
            ctx.ack();
        }
        CONDUYT_ON_CMD(0x02) {
            uint8_t buf[4];
            ConduytPayloadWriter w(buf, sizeof(buf));
            w.writeFloat32(42.0f);
            ctx.sendModResp(0, buf, w.length());
        }
    }
};
```

## Registration

```cpp
void setup() {
    device.addModule(new MyModule());
    device.begin();
}
```

Modules are indexed by registration order. The first module added is ID 0, second is ID 1, etc. Module IDs appear in HELLO_RESP.

## Context API

The `ConduytContext` passed to `handle()` provides:

| Method | Description |
|---|---|
| `ctx.ack()` | Send ACK response |
| `ctx.nak(errorCode)` | Send NAK response |
| `ctx.sendModResp(id, data, len)` | Send typed response data |
| `ctx.emitModEvent(id, code, data, len)` | Emit unsolicited event |

If the handler doesn't call any of these, ConduytDevice auto-sends ACK.

## Poll

Modules with continuous behavior (stepper pulse generation, PID loop) implement `poll()`. It's called every `device.poll()` cycle — keep it fast and non-blocking.

## Compile Guards

Each module is gated by a compile-time define:

```cpp
#define CONDUYT_MODULE_SERVO
#define CONDUYT_MODULE_NEOPIXEL
#define CONDUYT_MODULE_ENCODER
#include <Conduyt.h>
```

This keeps binary size minimal on constrained MCUs like ATmega328P.

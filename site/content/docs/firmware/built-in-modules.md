---
title: Built-in Modules
description: Reference for all CONDUYT firmware modules
---

# Built-in Modules

CONDUYT ships with 8 hardware modules. Each is opt-in via a compile define.

## Servo

**Define:** `CONDUYT_MODULE_SERVO` — **Name:** `servo`

| Cmd | Method | Payload |
|---|---|---|
| 0x01 | attach | pin(u8) + min_us(u16) + max_us(u16) |
| 0x02 | write | angle(u8) |
| 0x03 | writeMicroseconds | us(u16) |
| 0x04 | detach | — |

## NeoPixel

**Define:** `CONDUYT_MODULE_NEOPIXEL` — **Name:** `neopixel`

| Cmd | Method | Payload |
|---|---|---|
| 0x01 | begin | pin(u8) + count(u16) + type(u8) |
| 0x02 | setPixel | index(u16) + r,g,b(u8) [+ w(u8)] |
| 0x03 | setRange | start(u16) + count(u16) + r,g,b(u8) |
| 0x04 | fill | r,g,b(u8) [+ w(u8)] |
| 0x05 | show | — |
| 0x06 | setBrightness | level(u8) |

Requires: Adafruit_NeoPixel library.

## Encoder

**Define:** `CONDUYT_MODULE_ENCODER` — **Name:** `encoder`

| Cmd | Method | Payload | Response |
|---|---|---|---|
| 0x01 | attach | pin_a(u8) + pin_b(u8) | ACK |
| 0x02 | read | — | MOD_RESP: count(i32) |
| 0x03 | reset | — | ACK |

**Events:** `0x01` tick — count(i32) + delta(i16)

## Stepper

**Define:** `CONDUYT_MODULE_STEPPER` — **Name:** `stepper`

| Cmd | Method | Payload |
|---|---|---|
| 0x01 | config | step_pin(u8) + dir_pin(u8) + en_pin(u8) + steps_per_rev(u16) |
| 0x02 | move | steps(i32) + speed_hz(u16) |
| 0x03 | moveTo | position(i32) + speed_hz(u16) |
| 0x04 | stop | — |

**Events:** `0x01` done — position(i32)

## DHT

**Define:** `CONDUYT_MODULE_DHT` — **Name:** `dht`

| Cmd | Method | Payload | Response |
|---|---|---|---|
| 0x01 | begin | pin(u8) + type(u8: 11 or 22) | ACK |
| 0x02 | read | — | MOD_RESP: temp(f32) + humidity(f32) |

Requires: DHT sensor library (Adafruit).

## OLED (SSD1306)

**Define:** `CONDUYT_MODULE_OLED` — **Name:** `oled1306`

| Cmd | Method | Payload |
|---|---|---|
| 0x01 | begin | width(u8) + height(u8) + i2c_addr(u8) |
| 0x02 | clear | — |
| 0x03 | text | x(u8) + y(u8) + size(u8) + string(N) |
| 0x04 | drawRect | x(u8) + y(u8) + w(u8) + h(u8) + fill(u8) |
| 0x05 | drawBitmap | x(u8) + y(u8) + w(u8) + h(u8) + data(N) |
| 0x06 | show | — |

Requires: Adafruit_SSD1306 + Adafruit_GFX.

## PID Controller

**Define:** `CONDUYT_MODULE_PID` — **Name:** `pid`

| Cmd | Method | Payload |
|---|---|---|
| 0x01 | config | kp(f32) + ki(f32) + kd(f32) |
| 0x02 | setTarget | value(f32) |
| 0x03 | setInput | pin(u8) |
| 0x04 | setOutput | pin(u8) |
| 0x05 | enable/disable | flag(u8: 0 or 1) |

PID loop runs at 100ms intervals in `poll()`.

## I2C Passthrough

**Define:** `CONDUYT_MODULE_I2C` — **Name:** `i2c`

Not a traditional module — exists as a capability marker in HELLO_RESP. Raw I2C is handled by the core I2C_WRITE/I2C_READ commands.

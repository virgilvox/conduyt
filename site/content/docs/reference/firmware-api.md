---
title: Firmware API
description: ConduytDevice class, methods, constants, and board limits
---

# Firmware API

The CONDUYT Arduino library. Include with `#include <Conduyt.h>`.

## Quick Start Sketch

```cpp
#define CONDUYT_MODULE_SERVO
#include <Conduyt.h>

ConduytSerial transport(Serial, 115200);
ConduytDevice device("MyBoard", "1.0.0", transport);

void setup() {
    Serial.begin(115200);

    // Register a servo module (host discovers this via HELLO_RESP)
    device.addModule(new ConduytModuleServo());

    // Declare a writable datastream for servo angle
    device.addDatastream("angle", CONDUYT_TYPE_UINT8, "degrees", true);
    device.onDatastreamWrite("angle", [](ConduytPayloadReader &payload, ConduytContext &ctx) {
        uint8_t angle = payload.readUInt8();
        // Apply to servo (module handles this via MOD_CMD, but datastream is also an option)
        ctx.ack();
    });

    device.begin();
}

void loop() {
    device.poll();
}
```

This sketch demonstrates the three main firmware features: pin control (built-in, no extra code), a hardware module (servo), and a named datastream (angle). The API reference below covers each in detail.

## ConduytDevice

### Constructor

```cpp
ConduytDevice(const char *name, const char *version, ConduytTransport &transport)
```

- `name`: firmware name, max 16 characters, null-padded in HELLO_RESP
- `version`: semver string parsed into major/minor/patch
- `transport`: reference to a transport instance

### Methods

| Method | Description |
|---|---|
| `void begin()` | Initialize transport, register built-in handlers. Call in `setup()`. |
| `void poll()` | Process one inbound packet. Call in `loop()`. Non-blocking. |
| `void addModule(ConduytModuleBase *module)` | Register a module. Call before `begin()`. |
| `void addDatastream(name, type, unit, writable)` | Declare a datastream. Call before `begin()`. |
| `void onDatastreamWrite(name, callback)` | Register write handler for a writable datastream. |
| `void declarePinCaps(uint8_t pin, uint8_t caps)` | Override the per-pin capability bitmask advertised in HELLO_RESP. Call before `begin()`. |
| `void declareI2cBus(uint8_t bus, uint8_t sda, uint8_t scl)` | Mark `sda`/`scl` as I2C pins on `bus` and bump `i2c_buses` if needed. |
| `void declareSpiBus(uint8_t bus, uint8_t cs, uint8_t copi, uint8_t cipo, uint8_t sck)` | Mark the four pins as SPI on `bus` and bump `spi_buses` if needed. |
| `void writeDatastream(name, float value)` | Push a FLOAT32 value to the host. |
| `void writeDatastream(name, int32_t value)` | Push an INT32 value to the host. |
| `void writeDatastream(name, bool value)` | Push a BOOL value to the host. |
| `void writeDatastream(name, const uint8_t *data, size_t len)` | Push raw bytes to the host. |
| `void sendPacket(uint8_t type, uint8_t seq, const uint8_t *payload, size_t len)` | Send a raw packet. |
| `void sendAck(uint8_t seq)` | Send ACK with the given sequence number. |
| `void sendNak(uint8_t seq, uint8_t errorCode)` | Send NAK with error code. |

### Accessors

| Accessor | Return Type | Description |
|---|---|---|
| `firmwareName()` | `const char*` | Firmware name string |
| `versionMajor()` | `uint8_t` | Major version |
| `versionMinor()` | `uint8_t` | Minor version |
| `versionPatch()` | `uint8_t` | Patch version |
| `moduleCount()` | `uint8_t` | Number of registered modules |
| `datastreamCount()` | `uint8_t` | Number of declared datastreams |
| `transport()` | `ConduytTransport&` | Reference to the transport |

### Datastream Write Callback

```cpp
void callback(ConduytPayloadReader &payload, ConduytContext &ctx)
```

Read values from `payload` using `readFloat32()`, `readInt32()`, `readUInt8()`, etc. Call `ctx.ack()` or `ctx.nak(errorCode)` to respond.

## ConduytModuleBase

Base class for all modules. Subclass this to create custom modules.

| Method | Description |
|---|---|
| `const char* name()` | Module name (max 8 chars) |
| `uint8_t versionMajor()` | Module major version |
| `uint8_t versionMinor()` | Module minor version |
| `void begin()` | Called during `device.begin()` |
| `void handle(uint8_t cmd, ConduytPayloadReader &payload, ConduytContext &ctx)` | Handle a MOD_CMD |
| `void poll()` | Called each `device.poll()` cycle |
| `uint8_t pinCount()` | Number of claimed pins |
| `const uint8_t* pins()` | Array of claimed pin numbers |

## Transport Classes

| Class | Medium | COBS | Platform |
|---|---|---|---|
| `ConduytSerial` | UART/USB | Yes | All boards |
| `ConduytUSBSerial` | USB CDC | Yes | RP2040, SAMD, nRF52 |
| `ConduytMQTT` | MQTT | No | ESP32, ESP8266 |
| `ConduytBLE` | BLE | Yes | ESP32, nRF52 |
| `ConduytTCP` | TCP Client | No | ESP32, ESP8266 |
| `ConduytCLASP` | CLASP relay | Yes | ESP32 |

CONDUYT BLE uses its own GATT service UUIDs (`0000cd0[123]-0000-1000-8000-00805f9b34fb`), not Nordic UART Service.

### Construction Examples

```cpp
// Serial (all boards)
ConduytSerial transport(Serial, 115200);

// USB CDC (RP2040, SAMD, nRF52). Constructor takes baud + optional
// connect-wait timeout; the host Serial object is referenced internally.
ConduytUSBSerial transport(115200);

// MQTT (ESP32/ESP8266). Pass a Client (WiFiClient or similar), broker host,
// port, and a unique device id used as the MQTT topic prefix.
WiFiClient wifi;
ConduytMQTT transport(wifi, "broker.local", 1883, "device-001");

// BLE (ESP32, nRF52). Optional advertised-name argument; defaults to "CONDUYT".
ConduytBLE transport("CONDUYT-Device");

// TCP client (ESP32/ESP8266). Connects out to a TCP server at host:port.
WiFiClient tcpClient;
ConduytTCP transport(tcpClient, "10.0.0.5", 3000);

// CLASP (ESP32). Connects to a relay over WebSockets on a named channel.
ConduytCLASP transport("wss://relay.example.com", "my-device-channel");
```

Non-default transports require a compile define before `#include <Conduyt.h>`:

| Transport | Define |
|---|---|
| MQTT | `CONDUYT_TRANSPORT_MQTT` |
| BLE | `CONDUYT_TRANSPORT_BLE` |
| TCP | `CONDUYT_TRANSPORT_TCP` |
| CLASP | `CONDUYT_TRANSPORT_CLASP` |

## Board Limits

| Board | Buffer | Max Modules | Max Subscriptions | Max Datastreams |
|---|---|---|---|---|
| ATmega328 (Uno) | 128B | 4 | 8 | 4 |
| ESP32 | 512B | 8 | 16 | 16 |
| ESP8266 | 512B | 8 | 16 | 16 |
| nRF52 | 512B | 8 | 16 | 16 |
| RP2040 (Pico) | 512B | 8 | 16 | 16 |
| STM32 | 512B | 8 | 16 | 16 |
| SAMD | 256B | 6 | 12 | 8 |
| Teensy | 512B | 8 | 16 | 16 |

Override any limit with `#define` before including `Conduyt.h`:

```cpp
#define CONDUYT_MAX_MODULES 12
#define CONDUYT_MAX_SUBS 32
#define CONDUYT_MAX_DATASTREAMS 32
#define CONDUYT_BUF_SIZE 1024
#include <Conduyt.h>
```

## Built-in Modules

All modules are opt-in via compile defines. Define the flag before `#include <Conduyt.h>`.

### Servo

**Define:** `CONDUYT_MODULE_SERVO`, **Name:** `servo`

| Cmd | Method | Payload |
|---|---|---|
| 0x01 | attach | pin(u8) + min_us(u16) + max_us(u16) |
| 0x02 | write | angle(u8) |
| 0x03 | writeMicroseconds | us(u16) |
| 0x04 | detach | (none) |

### NeoPixel

**Define:** `CONDUYT_MODULE_NEOPIXEL`, **Name:** `neopixel`

| Cmd | Method | Payload |
|---|---|---|
| 0x01 | begin | pin(u8) + count(u16) + type(u8) |
| 0x02 | setPixel | index(u16) + r,g,b(u8) [+ w(u8)] |
| 0x03 | setRange | start(u16) + count(u16) + r,g,b(u8) |
| 0x04 | fill | r,g,b(u8) [+ w(u8)] |
| 0x05 | show | (none) |
| 0x06 | setBrightness | level(u8) |

Requires: Adafruit_NeoPixel library.

### Encoder

**Define:** `CONDUYT_MODULE_ENCODER`, **Name:** `encoder`

| Cmd | Method | Payload | Response |
|---|---|---|---|
| 0x01 | attach | pin_a(u8) + pin_b(u8) | ACK |
| 0x02 | read | (none) | MOD_RESP: count(i32) |
| 0x03 | reset | (none) | ACK |

Events: `0x01` tick, payload: count(i32) + delta(i16)

### Stepper

**Define:** `CONDUYT_MODULE_STEPPER`, **Name:** `stepper`

| Cmd | Method | Payload |
|---|---|---|
| 0x01 | config | step_pin(u8) + dir_pin(u8) + en_pin(u8) + steps_per_rev(u16) |
| 0x02 | move | steps(i32) + speed_hz(u16) |
| 0x03 | moveTo | position(i32) + speed_hz(u16) |
| 0x04 | stop | (none) |

Events: `0x01` done, payload: position(i32)

### DHT

**Define:** `CONDUYT_MODULE_DHT`, **Name:** `dht`

| Cmd | Method | Payload | Response |
|---|---|---|---|
| 0x01 | begin | pin(u8) + type(u8: 11 or 22) | ACK |
| 0x02 | read | (none) | MOD_RESP: temp(f32) + humidity(f32) |

Requires: DHT sensor library (Adafruit).

### OLED (SSD1306)

**Define:** `CONDUYT_MODULE_OLED`, **Name:** `oled1306`

| Cmd | Method | Payload |
|---|---|---|
| 0x01 | begin | width(u8) + height(u8) + i2c_addr(u8) |
| 0x02 | clear | (none) |
| 0x03 | text | x(u8) + y(u8) + size(u8) + string(N) |
| 0x04 | drawRect | x(u8) + y(u8) + w(u8) + h(u8) + fill(u8) |
| 0x05 | drawBitmap | x(u8) + y(u8) + w(u8) + h(u8) + data(N) |
| 0x06 | show | (none) |

Requires: Adafruit_SSD1306 + Adafruit_GFX.

### PID Controller

**Define:** `CONDUYT_MODULE_PID`, **Name:** `pid`

| Cmd | Method | Payload |
|---|---|---|
| 0x01 | config | kp(f32) + ki(f32) + kd(f32) |
| 0x02 | setTarget | value(f32) |
| 0x03 | setInput | pin(u8) |
| 0x04 | setOutput | pin(u8) |
| 0x05 | enable/disable | flag(u8: 0 or 1) |

PID loop runs at 100ms intervals in `poll()`.

### I2C Passthrough

**Define:** `CONDUYT_MODULE_I2C`, **Name:** `i2c`

Not a traditional module. Exists as a capability marker in HELLO_RESP. Raw I2C operations are handled by the core I2C_WRITE, I2C_READ, and I2C_READ_REG commands.

## Constants

### Command Types (`CONDUYT_CMD_*`)

```cpp
CONDUYT_CMD_PING            0x01
CONDUYT_CMD_HELLO           0x02
CONDUYT_CMD_PIN_MODE        0x10
CONDUYT_CMD_PIN_WRITE       0x11
CONDUYT_CMD_PIN_READ        0x12
CONDUYT_CMD_PIN_SUBSCRIBE   0x13
CONDUYT_CMD_PIN_UNSUBSCRIBE 0x14
CONDUYT_CMD_I2C_WRITE       0x20
CONDUYT_CMD_I2C_READ        0x21
CONDUYT_CMD_I2C_READ_REG    0x22
CONDUYT_CMD_SPI_XFER        0x30
CONDUYT_CMD_MOD_CMD         0x40
CONDUYT_CMD_STREAM_START    0x50
CONDUYT_CMD_STREAM_STOP     0x51
CONDUYT_CMD_DS_WRITE        0x60
CONDUYT_CMD_DS_READ         0x61
CONDUYT_CMD_DS_SUBSCRIBE    0x62
CONDUYT_CMD_OTA_BEGIN       0x70
CONDUYT_CMD_OTA_CHUNK       0x71
CONDUYT_CMD_OTA_FINALIZE    0x72
CONDUYT_CMD_RESET           0xF0
```

### Event Types (`CONDUYT_EVT_*`)

```cpp
CONDUYT_EVT_PONG            0x80
CONDUYT_EVT_HELLO_RESP      0x81
CONDUYT_EVT_ACK             0x82
CONDUYT_EVT_NAK             0x83
CONDUYT_EVT_PIN_EVENT       0x90
CONDUYT_EVT_PIN_READ_RESP   0x91
CONDUYT_EVT_I2C_READ_RESP   0xA0
CONDUYT_EVT_SPI_XFER_RESP   0xB0
CONDUYT_EVT_MOD_EVENT       0xC0
CONDUYT_EVT_MOD_RESP        0xC1
CONDUYT_EVT_STREAM_DATA     0xD0
CONDUYT_EVT_DS_EVENT        0xD1
CONDUYT_EVT_DS_READ_RESP    0xD2
CONDUYT_EVT_LOG             0xE0
CONDUYT_EVT_FATAL           0xFF
```

### Error Codes (`CONDUYT_ERR_*`)

```cpp
CONDUYT_ERR_UNKNOWN_TYPE        0x01
CONDUYT_ERR_CRC_MISMATCH       0x02
CONDUYT_ERR_PAYLOAD_TOO_LARGE  0x03
CONDUYT_ERR_INVALID_PIN        0x04
CONDUYT_ERR_PIN_MODE_UNSUPPORTED 0x05
CONDUYT_ERR_I2C_NOT_AVAILABLE  0x06
CONDUYT_ERR_I2C_NACK           0x07
CONDUYT_ERR_MODULE_NOT_LOADED  0x08
CONDUYT_ERR_UNKNOWN_MODULE_CMD 0x09
CONDUYT_ERR_MODULE_BUSY        0x0A
CONDUYT_ERR_SUB_LIMIT_REACHED  0x0B
CONDUYT_ERR_OUT_OF_MEMORY      0x0C
CONDUYT_ERR_UNKNOWN_DATASTREAM 0x0D
CONDUYT_ERR_DATASTREAM_READONLY 0x0E
CONDUYT_ERR_OTA_INVALID        0x0F
CONDUYT_ERR_VERSION_MISMATCH   0x10
```

### Type Codes (`CONDUYT_TYPE_*`)

```cpp
CONDUYT_TYPE_BOOL     0x01
CONDUYT_TYPE_INT8     0x02
CONDUYT_TYPE_UINT8    0x03
CONDUYT_TYPE_INT16    0x04
CONDUYT_TYPE_UINT16   0x05
CONDUYT_TYPE_INT32    0x06
CONDUYT_TYPE_FLOAT32  0x07
CONDUYT_TYPE_STRING   0x08
CONDUYT_TYPE_BYTES    0x09
```

### Pin Capabilities (`CONDUYT_PIN_CAP_*`)

```cpp
CONDUYT_PIN_CAP_DIGITAL_IN   (1 << 0)
CONDUYT_PIN_CAP_DIGITAL_OUT  (1 << 1)
CONDUYT_PIN_CAP_PWM_OUT      (1 << 2)
CONDUYT_PIN_CAP_ANALOG_IN    (1 << 3)
CONDUYT_PIN_CAP_I2C_SDA      (1 << 4)
CONDUYT_PIN_CAP_I2C_SCL      (1 << 5)
CONDUYT_PIN_CAP_SPI          (1 << 6)
CONDUYT_PIN_CAP_INTERRUPT    (1 << 7)
```

### Pin Modes (`CONDUYT_PIN_MODE_*`)

```cpp
CONDUYT_PIN_MODE_INPUT        0x00
CONDUYT_PIN_MODE_OUTPUT       0x01
CONDUYT_PIN_MODE_PWM          0x02
CONDUYT_PIN_MODE_ANALOG       0x03
CONDUYT_PIN_MODE_INPUT_PULLUP 0x04
```

### Subscription Modes (`CONDUYT_SUB_*`)

```cpp
CONDUYT_SUB_CHANGE      0x01
CONDUYT_SUB_RISING      0x02
CONDUYT_SUB_FALLING     0x03
CONDUYT_SUB_ANALOG_POLL 0x04
```

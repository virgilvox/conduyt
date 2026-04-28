# CONDUYT Firmware

Arduino/PlatformIO library that turns any microcontroller into a CONDUYT device. Handles packet framing, command dispatch, capability reporting, and module loading. The host controls everything; the firmware runs the protocol.

## Install

### PlatformIO

```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
lib_deps = lumencanvas/Conduyt
```

### Arduino IDE

Install "Conduyt" from the Library Manager.

## Minimal Sketch

```cpp
#include <Conduyt.h>

ConduytSerial  transport(Serial, 115200);
ConduytDevice  device("MyDevice", "1.0.0", transport);

void setup() { device.begin(); }
void loop()  { device.poll(); }
```

This gives the host full pin control, I2C/SPI passthrough, and capability reporting.

## Adding Modules

Modules are compile-time opt-in. Define the feature flag before including `Conduyt.h`.

```cpp
#define CONDUYT_MODULE_SERVO
#define CONDUYT_MODULE_NEOPIXEL
#include <Conduyt.h>

ConduytSerial  transport(Serial, 115200);
ConduytDevice  device("ModuleDemo", "1.0.0", transport);

void setup() {
  // Modules use a default constructor; the host calls each module's
  // begin() command over the wire to configure pins/counts/etc.
  device.addModule(new ConduytModuleServo());
  device.addModule(new ConduytModuleNeoPixel());
  device.begin();
}

void loop() { device.poll(); }
```

## Adding Datastreams

Datastreams are named, typed values that the device pushes to the host.

```cpp
ConduytSerial  transport(Serial, 115200);
ConduytDevice  device("Thermostat", "1.0.0", transport);

void setup() {
  device.addDatastream("temperature", CONDUYT_FLOAT32, "C", false);
  device.addDatastream("setpoint", CONDUYT_FLOAT32, "C", true);
  device.onDatastreamWrite("setpoint", [](ConduytPayloadReader &r, ConduytContext &ctx) {
    float sp = r.readFloat32();
    // handle new setpoint
    ctx.ack();
  });
  device.begin();
}

void loop() {
  device.poll();
  // periodically:
  device.writeDatastream("temperature", 22.5f);
}
```

## Supported Boards

| Board | Platform | Buffer Size | Max Modules | Max Subscriptions |
|-------|----------|-------------|-------------|-------------------|
| Arduino Uno | AVR (328P) | 128 | 4 | 8 |
| Arduino Mega | AVR (2560) | 128 | 4 | 8 |
| ESP32 | Espressif32 | 512 | 8 | 16 |
| ESP8266 (NodeMCU) | Espressif8266 | 512 | 8 | 16 |
| nRF52840 DK | Nordic nRF52 | 512 | 8 | 16 |
| Raspberry Pi Pico | RP2040 | 512 | 8 | 16 |
| Teensy 4.1 | Teensy | 512 | 8 | 16 |
| SAMD21/51 | SAMD | 256 | 6 | 12 |

## Transports

| Transport | Class | Use Case |
|-----------|-------|----------|
| Serial (UART/USB) | `ConduytSerial` | Wired connection, most common |
| USB Serial | `ConduytUSBSerial` | Native USB CDC |
| BLE | `ConduytBLE` | Bluetooth Low Energy (ESP32, nRF52) |
| MQTT | `ConduytMQTT` | WiFi via MQTT broker |
| TCP | `ConduytTCP` | Direct WiFi socket |
| CLASP | `ConduytCLASP` | CLASP tunnel protocol |

## Modules

| Module | Flag | Class | Hardware |
|--------|------|-------|----------|
| Servo | `CONDUYT_MODULE_SERVO` | `ConduytModuleServo` | Hobby servos |
| NeoPixel | `CONDUYT_MODULE_NEOPIXEL` | `ConduytModuleNeoPixel` | WS2812/SK6812 LEDs |
| DHT | `CONDUYT_MODULE_DHT` | `ConduytModuleDHT` | DHT11/DHT22 sensors |
| OLED | `CONDUYT_MODULE_OLED` | `ConduytModuleOLED` | SSD1306 displays |
| Stepper | `CONDUYT_MODULE_STEPPER` | `ConduytModuleStepper` | Stepper motors |
| Encoder | `CONDUYT_MODULE_ENCODER` | `ConduytModuleEncoder` | Rotary encoders |
| PID | `CONDUYT_MODULE_PID` | `ConduytModulePID` | PID controller |
| I2C Passthrough | `CONDUYT_MODULE_I2C_PASSTHROUGH` | `ConduytModuleI2CPassthrough` | Raw I2C forwarding |

## Configuration

These constants are set per-platform in `ConduytBoard.h`. Override them before including `Conduyt.h` if needed.

| Constant | Default | Description |
|----------|---------|-------------|
| `CONDUYT_PACKET_BUF_SIZE` | 128-512 | Max payload size in bytes |
| `CONDUYT_MAX_MODULES` | 4-8 | Module slot count |
| `CONDUYT_MAX_SUBSCRIPTIONS` | 8-16 | Active pin subscription limit |
| `CONDUYT_MAX_DATASTREAMS` | 4-16 | Datastream slot count |

## Running Tests

```bash
pio test -e native
```

Runs the Unity-based test suite against the core C library and device logic on the host machine. No hardware required.

## Examples

| Example | Description |
|---------|-------------|
| `BasicBlink` | Minimal sketch, pin control only |
| `ServoControl` | Servo module with serial transport |
| `DatastreamThermostat` | Datastreams with write callbacks |
| `MQTTSensor` | WiFi sensor over MQTT |
| `BLEDevice` | BLE transport on ESP32 |
| `FullKitchen` | Multiple modules and datastreams |

## License

MIT. Copyright (c) 2026 LumenCanvas.

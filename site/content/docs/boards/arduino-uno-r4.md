---
title: "Arduino Uno R4 Minima"
description: "Uno R4 board guide - Renesas RA4M1, USB DFU browser flashing, serial transport."
---

# Arduino Uno R4 Minima

The Uno R4 uses the Renesas RA4M1 (ARM Cortex-M4) - a major upgrade from the classic Uno's ATmega328P. 16x the RAM, 8x the flash, and USB DFU support for browser-based flashing from the [Playground](/playground).

## Specs

| Property | Value |
|----------|-------|
| MCU | Renesas RA4M1 (ARM Cortex-M4), 48 MHz |
| Flash | 256 KB |
| RAM | 32 KB SRAM |
| GPIO | 20 pins |
| ADC | 6 channels (14-bit) |
| PWM | 6 channels |
| I2C | 1 bus |
| SPI | 1 bus |
| UART | 1 port |
| WiFi | No (use the Uno R4 WiFi variant for that) |
| BLE | No |
| OTA | No |

## Firmware setup

### PlatformIO

```ini
; platformio.ini
[env:uno_r4_minima]
platform = renesas-ra
board = uno_r4_minima
framework = arduino
lib_deps = conduyt
```

```bash
pio run --target upload
```

### Arduino IDE

1. Go to **Tools → Board → Boards Manager**
2. Search for **Renesas** and install **Arduino Renesas fsp Boards**
3. Select **Arduino Uno R4 Minima** from **Tools → Board → Arduino Renesas Boards**

## Transport

USB serial:

```cpp
#include <Conduyt.h>

ConduytSerial  transport(Serial, 115200);
ConduytDevice  device("MyDevice", "1.0.0", transport);

void setup() {
  Serial.begin(115200);
  device.begin();
}

void loop() {
  device.poll();
}
```

## Browser flashing (DFU)

The Uno R4 has a USB DFU bootloader, which means it can be flashed directly from Chrome/Edge using WebUSB - no IDE required.

**Step by step:**

1. **Enter DFU mode:** double-tap the RESET button quickly (two taps within ~500ms). The "L" LED will start pulsing slowly. If it doesn't pulse, tap faster.
2. Go to the [Playground](/playground) and click **Flash**
3. Select **Arduino Uno R4** and click **Flash Arduino Uno R4**
4. Chrome prompts you to select a USB device - pick the Arduino DFU device
5. Wait for the progress bar to reach 100%
6. The board automatically reboots into the new firmware

**Windows users:** if no DFU device appears in the browser prompt, you may need to install WinUSB drivers:
1. Download [Zadig](https://zadig.akeo.ie/)
2. Put the board in DFU mode (double-tap RESET)
3. In Zadig, select the Arduino DFU device and install the **WinUSB** driver

On macOS and Linux, DFU works without additional drivers.

## Built-in LED

**Pin 13**, same as the classic Uno.

## Differences from Uno R3

| Feature | Uno R3 | Uno R4 Minima |
|---------|--------|---------------|
| MCU | ATmega328P (AVR, 16 MHz) | RA4M1 (ARM, 48 MHz) |
| Flash | 32 KB | 256 KB |
| RAM | 2 KB | 32 KB |
| ADC resolution | 10-bit | 14-bit |
| USB | FTDI/16U2 serial bridge | Native USB + DFU |
| Browser flashing | No | Yes (WebUSB DFU) |
| Max modules | 1–2 (RAM limited) | 8+ comfortably |

## Common issues

- **DFU mode not entering:** You need two quick taps within ~500ms. A single tap just resets the board. Practice the rhythm - tap-tap.
- **Serial port disappears after DFU flash:** This is normal. Single-tap RESET to reboot into the new firmware. The serial port reappears.
- **Port busy after flash:** Wait 2–3 seconds after the board reboots, then reconnect.

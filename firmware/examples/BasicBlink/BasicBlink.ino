/**
 * CONDUYT — Basic Blink Example
 *
 * The simplest CONDUYT sketch. Connects over serial at 115200 baud.
 * The host can toggle pin 13 (built-in LED) and read pin states.
 * No modules, no datastreams — just raw pin control.
 */

#include <Conduyt.h>

ConduytSerial  transport(Serial, 115200);
ConduytDevice  device("BasicBlink", "1.0.0", transport);

void setup() {
  device.begin();
}

void loop() {
  device.poll();
}

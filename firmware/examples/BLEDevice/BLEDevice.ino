/**
 * CONDUYT — BLE Device Example (ESP32)
 *
 * Advertises as a BLE GATT device. A browser with Web Bluetooth
 * (or any BLE central) can discover and control it.
 */

#define CONDUYT_MODULE_SERVO
#include <Conduyt.h>
#include <conduyt/transport/ConduytBLE.h>

ConduytBLE    transport("CONDUYT-Servo");
ConduytDevice device("BLEServo", "1.0.0", transport);

void setup() {
  device.addModule(new ConduytModuleServo());
  device.addDatastream("angle", CONDUYT_FLOAT32, "degrees", true);
  device.begin();
}

void loop() {
  device.poll();
}

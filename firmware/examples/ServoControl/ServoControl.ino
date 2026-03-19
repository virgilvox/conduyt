/**
 * CONDUYT — Servo Control Example
 *
 * Control a servo over serial. Connect with conduyt-js:
 *
 *   import { ConduytDevice } from 'conduyt-js'
 *   import { SerialTransport } from 'conduyt-js/transports/serial'
 *   import { ConduytServo } from 'conduyt-js/modules/servo'
 *
 *   const device = await ConduytDevice.connect(
 *     new SerialTransport({ path: '/dev/ttyUSB0' })
 *   )
 *   const servo = new ConduytServo(device)
 *   await servo.attach(9)
 *   await servo.write(90)
 */

#define CONDUYT_MODULE_SERVO
#include <Conduyt.h>

ConduytSerial  transport(Serial, 115200);
ConduytDevice  device("ServoDemo", "1.0.0", transport);

void setup() {
  device.addModule(new ConduytModuleServo());
  device.begin();
}

void loop() {
  device.poll();
}

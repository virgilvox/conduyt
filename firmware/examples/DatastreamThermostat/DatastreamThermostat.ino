/**
 * CONDUYT — Datastream Thermostat Example
 *
 * Demonstrates named typed datastreams:
 * - "temperature" (FLOAT32, read-only) — pushed from device every 2 seconds
 * - "setpoint"    (FLOAT32, writable)  — host sets desired temperature
 * - "relay"       (BOOL, writable)     — host can toggle relay directly
 *
 * The host SDK subscribes to datastreams with `for await` syntax.
 */

#include <Conduyt.h>

ConduytSerial  transport(Serial, 115200);
ConduytDevice  device("Thermostat", "1.0.0", transport);

float targetTemp = 22.0;

unsigned long lastTempRead = 0;
const unsigned long TEMP_INTERVAL = 2000;

void onSetpoint(ConduytPayloadReader &payload, ConduytContext &ctx) {
  targetTemp = payload.readFloat32();
  ctx.ack();
}

void onRelay(ConduytPayloadReader &payload, ConduytContext &ctx) {
  bool on = payload.readBool();
  digitalWrite(8, on ? HIGH : LOW);
  ctx.ack();
}

void setup() {
  pinMode(8, OUTPUT); // relay pin

  device.addDatastream("temperature", CONDUYT_FLOAT32, "celsius", false);
  device.addDatastream("setpoint",    CONDUYT_FLOAT32, "celsius", true);
  device.addDatastream("relay",       CONDUYT_BOOL,    "",        true);

  device.onDatastreamWrite("setpoint", onSetpoint);
  device.onDatastreamWrite("relay", onRelay);

  device.begin();
}

void loop() {
  device.poll();

  if (millis() - lastTempRead >= TEMP_INTERVAL) {
    // Simulate temperature reading (replace with real sensor)
    float temp = 20.0 + (analogRead(A0) / 1023.0) * 20.0;
    device.writeDatastream("temperature", temp);
    lastTempRead = millis();
  }
}

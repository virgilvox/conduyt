/**
 * CONDUYT — Full Kitchen Sink Example (ESP32 + MQTT)
 *
 * Demonstrates: modules, datastreams, MQTT transport, all in one sketch.
 */

#include <WiFi.h>

#define CONDUYT_MODULE_SERVO
#define CONDUYT_MODULE_NEOPIXEL
#define CONDUYT_TRANSPORT_MQTT
#include <Conduyt.h>
#include <conduyt/transport/ConduytMQTT.h>

const char* WIFI_SSID   = "your-ssid";
const char* WIFI_PASS   = "your-password";
const char* MQTT_BROKER = "broker.local";

WiFiClient wifiClient;
ConduytMQTT  transport(wifiClient, MQTT_BROKER, 1883, "kitchen-01");
ConduytDevice device("FullKitchen", "1.0.0", transport);

float targetTemp = 22.0;
unsigned long lastPush = 0;

void onSetpoint(ConduytPayloadReader &payload, ConduytContext &ctx) {
  targetTemp = payload.readFloat32();
  ctx.ack();
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }

  device.addModule(new ConduytModuleServo());
  device.addModule(new ConduytModuleNeoPixel());

  device.addDatastream("temperature", CONDUYT_FLOAT32, "celsius",  false);
  device.addDatastream("humidity",    CONDUYT_FLOAT32, "percent",  false);
  device.addDatastream("setpoint",    CONDUYT_FLOAT32, "celsius",  true);
  device.addDatastream("led_mode",    CONDUYT_UINT8,   "",         true);

  device.onDatastreamWrite("setpoint", onSetpoint);

  device.begin();
}

void loop() {
  device.poll();

  if (millis() - lastPush > 2000) {
    float temp = 20.0 + (analogRead(34) / 4095.0) * 15.0;
    float hum  = 40.0 + (analogRead(35) / 4095.0) * 40.0;
    device.writeDatastream("temperature", temp);
    device.writeDatastream("humidity", hum);
    lastPush = millis();
  }
}

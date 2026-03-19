/**
 * CONDUYT DHT Module (DHT11/DHT22)
 *
 * Commands:
 *   0x01  begin(pin, type)   — type: 11 or 22
 *   0x02  read()             — triggers async read, result via MOD_EVENT
 *
 * Events:
 *   0x01  data(temp: float32, humidity: float32)
 *
 * Compile-time opt-in: #define CONDUYT_MODULE_DHT
 * Requires: DHT sensor library (Adafruit or equivalent)
 */

#ifndef CONDUYT_MODULE_DHT_H
#define CONDUYT_MODULE_DHT_H

#ifdef CONDUYT_MODULE_DHT

#include "../ConduytModuleBase.h"
#include "../ConduytContext.h"

#ifdef ARDUINO
#include <DHT.h>
#endif

class ConduytModuleDHT : public ConduytModuleBase {
public:
    const char* name() override { return "dht"; }
    uint8_t versionMajor() override { return 1; }
    uint8_t versionMinor() override { return 0; }

    void handle(uint8_t cmd, ConduytPayloadReader &payload, ConduytContext &ctx) override {
        switch (cmd) {
            case 0x01: { // begin
                _pin = payload.readUInt8();
                _type = payload.readUInt8();
#ifdef ARDUINO
                if (_dht) { delete _dht; _dht = nullptr; }
                _dht = new DHT(_pin, (_type == 22) ? DHT22 : DHT11);
                _dht->begin();
#endif
                _ready = true;
                ctx.ack();
                break;
            }
            case 0x02: { // read
                if (!_ready) { ctx.nak(0x08); break; }
#ifdef ARDUINO
                float temp = _dht->readTemperature();
                float hum = _dht->readHumidity();
                if (isnan(temp) || isnan(hum)) {
                    ctx.nak(0x0C); // OUT_OF_MEMORY (reused as sensor error)
                    break;
                }
                uint8_t buf[8];
                ConduytPayloadWriter w(buf, sizeof(buf));
                w.writeFloat32(temp);
                w.writeFloat32(hum);
                ctx.sendModResp(0, buf, w.length());
#else
                ctx.ack();
#endif
                break;
            }
            default:
                ctx.nak(0x09);
                break;
        }
    }

    uint8_t pinCount() override { return _ready ? 1 : 0; }
    const uint8_t* pins() override { return _ready ? &_pin : nullptr; }

#ifdef ARDUINO
    ~ConduytModuleDHT() { if (_dht) delete _dht; }
#endif

private:
#ifdef ARDUINO
    DHT *_dht = nullptr;
#endif
    uint8_t _pin = 0xFF;
    uint8_t _type = 11;
    bool _ready = false;
};

#endif /* CONDUYT_MODULE_DHT */
#endif /* CONDUYT_MODULE_DHT_H */

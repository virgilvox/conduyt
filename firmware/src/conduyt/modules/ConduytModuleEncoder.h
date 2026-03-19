/**
 * CONDUYT Encoder Module
 *
 * Commands:
 *   0x01  attach(pin_a, pin_b)
 *   0x02  read() -> MOD_RESP with int32 count
 *   0x03  reset()
 *
 * Events:
 *   0x01  tick(count: int32, delta: int16)
 *
 * Compile-time opt-in: #define CONDUYT_MODULE_ENCODER
 */

#ifndef CONDUYT_MODULE_ENCODER_H
#define CONDUYT_MODULE_ENCODER_H

#ifdef CONDUYT_MODULE_ENCODER

#include "../ConduytModuleBase.h"
#include "../ConduytContext.h"
#include "../ConduytDevice.h"

class ConduytModuleEncoder : public ConduytModuleBase {
public:
    const char* name() override { return "encoder"; }
    uint8_t versionMajor() override { return 1; }
    uint8_t versionMinor() override { return 0; }

    void begin() override {}

    void handle(uint8_t cmd, ConduytPayloadReader &payload, ConduytContext &ctx) override {
        switch (cmd) {
            case 0x01: { // attach
                _pinA = payload.readUInt8();
                _pinB = payload.readUInt8();
#ifdef ARDUINO
                pinMode(_pinA, INPUT_PULLUP);
                pinMode(_pinB, INPUT_PULLUP);
                _lastA = digitalRead(_pinA);
                _lastB = digitalRead(_pinB);
#endif
                _count = 0;
                _attached = true;
                ctx.ack();
                break;
            }
            case 0x02: { // read
                uint8_t buf[4];
                ConduytPayloadWriter w(buf, sizeof(buf));
                w.writeInt32(_count);
                ctx.sendModResp(0, buf, w.length());
                break;
            }
            case 0x03: { // reset
                _count = 0;
                ctx.ack();
                break;
            }
            default:
                ctx.nak(0x09);
                break;
        }
    }

    void poll() override {
#ifdef ARDUINO
        if (!_attached) return;
        uint8_t a = digitalRead(_pinA);
        uint8_t b = digitalRead(_pinB);
        if (a != _lastA) {
            int32_t prevCount = _count;
            if (a == b) _count--;
            else _count++;
            _lastA = a;
            _lastB = b;

            if (_device) {
                uint8_t buf[6];
                ConduytPayloadWriter w(buf, sizeof(buf));
                w.writeInt32(_count);
                w.writeInt16((int16_t)(_count - prevCount));
                uint8_t evtBuf[8];
                ConduytPayloadWriter ew(evtBuf, sizeof(evtBuf));
                ew.writeUInt8(0); /* module_id — resolved at runtime */
                ew.writeUInt8(0x01); /* event code: tick */
                ew.writeBytes(buf, w.length());
                _device->sendPacket(CONDUYT_EVT_MOD_EVENT, 0, evtBuf, ew.length());
            }
        }
#endif
    }

    uint8_t pinCount() override { return _attached ? 2 : 0; }
    const uint8_t* pins() override { return _attached ? _pins : nullptr; }

private:
    uint8_t _pinA = 0, _pinB = 0;
    uint8_t _pins[2] = {0, 0};
    uint8_t _lastA = 0, _lastB = 0;
    int32_t _count = 0;
    bool _attached = false;
};

#endif /* CONDUYT_MODULE_ENCODER */
#endif /* CONDUYT_MODULE_ENCODER_H */

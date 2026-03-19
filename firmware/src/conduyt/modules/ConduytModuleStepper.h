/**
 * CONDUYT Stepper Module
 *
 * Commands:
 *   0x01  config(step_pin, dir_pin, en_pin, steps_per_rev)
 *   0x02  move(steps: int32, speed_hz: uint16)
 *   0x03  moveTo(position: int32, speed_hz: uint16)
 *   0x04  stop()
 *
 * Events:
 *   0x01  done(position: int32)
 *
 * Compile-time opt-in: #define CONDUYT_MODULE_STEPPER
 */

#ifndef CONDUYT_MODULE_STEPPER_H
#define CONDUYT_MODULE_STEPPER_H

#ifdef CONDUYT_MODULE_STEPPER

#include "../ConduytModuleBase.h"
#include "../ConduytContext.h"
#include "../ConduytDevice.h"

class ConduytModuleStepper : public ConduytModuleBase {
public:
    const char* name() override { return "stepper"; }
    uint8_t versionMajor() override { return 1; }
    uint8_t versionMinor() override { return 0; }

    void handle(uint8_t cmd, ConduytPayloadReader &payload, ConduytContext &ctx) override {
        switch (cmd) {
            case 0x01: { // config
                _stepPin = payload.readUInt8();
                _dirPin = payload.readUInt8();
                _enPin = payload.readUInt8();
                _stepsPerRev = payload.readUInt16();
#ifdef ARDUINO
                pinMode(_stepPin, OUTPUT);
                pinMode(_dirPin, OUTPUT);
                if (_enPin != 0xFF) { pinMode(_enPin, OUTPUT); digitalWrite(_enPin, LOW); }
#endif
                _configured = true;
                ctx.ack();
                break;
            }
            case 0x02: { // move relative
                _targetSteps = payload.readInt32();
                _speedHz = payload.readUInt16();
                _stepsRemaining = (_targetSteps > 0) ? _targetSteps : -_targetSteps;
                _direction = (_targetSteps >= 0) ? 1 : -1;
                _stepIntervalUs = (_speedHz > 0) ? (1000000UL / _speedHz) : 1000;
                _moving = true;
                _lastStepUs = 0;
#ifdef ARDUINO
                digitalWrite(_dirPin, _direction > 0 ? HIGH : LOW);
#endif
                ctx.ack();
                break;
            }
            case 0x03: { // moveTo absolute
                int32_t target = payload.readInt32();
                _speedHz = payload.readUInt16();
                _targetSteps = target - _position;
                _stepsRemaining = (_targetSteps > 0) ? _targetSteps : -_targetSteps;
                _direction = (_targetSteps >= 0) ? 1 : -1;
                _stepIntervalUs = (_speedHz > 0) ? (1000000UL / _speedHz) : 1000;
                _moving = true;
                _lastStepUs = 0;
#ifdef ARDUINO
                digitalWrite(_dirPin, _direction > 0 ? HIGH : LOW);
#endif
                ctx.ack();
                break;
            }
            case 0x04: { // stop
                _moving = false;
                _stepsRemaining = 0;
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
        if (!_moving || !_configured) return;
        uint32_t now = micros();
        if (now - _lastStepUs >= _stepIntervalUs) {
            if (_stepsRemaining > 0) {
                digitalWrite(_stepPin, HIGH);
                delayMicroseconds(2);
                digitalWrite(_stepPin, LOW);
                _position += _direction;
                _stepsRemaining--;
                _lastStepUs = now;
            }
            if (_stepsRemaining == 0) {
                _moving = false;
                if (_device) {
                    uint8_t buf[4];
                    ConduytPayloadWriter w(buf, sizeof(buf));
                    w.writeInt32(_position);
                    uint8_t evtBuf[6];
                    ConduytPayloadWriter ew(evtBuf, sizeof(evtBuf));
                    ew.writeUInt8(0);
                    ew.writeUInt8(0x01); /* event code: done */
                    ew.writeBytes(buf, w.length());
                    _device->sendPacket(CONDUYT_EVT_MOD_EVENT, 0, evtBuf, ew.length());
                }
            }
        }
#endif
    }

    uint8_t pinCount() override { return _configured ? 3 : 0; }
    const uint8_t* pins() override {
        if (!_configured) return nullptr;
        _pins[0] = _stepPin; _pins[1] = _dirPin; _pins[2] = _enPin;
        return _pins;
    }

private:
    uint8_t _stepPin = 0, _dirPin = 0, _enPin = 0xFF;
    uint8_t _pins[3] = {0};
    uint16_t _stepsPerRev = 200;
    uint16_t _speedHz = 0;
    uint32_t _stepIntervalUs = 0;
    uint32_t _lastStepUs = 0;
    int32_t _position = 0;
    int32_t _targetSteps = 0;
    int32_t _stepsRemaining = 0;
    int8_t _direction = 1;
    bool _configured = false;
    bool _moving = false;
};

#endif /* CONDUYT_MODULE_STEPPER */
#endif /* CONDUYT_MODULE_STEPPER_H */

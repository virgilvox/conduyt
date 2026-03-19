/**
 * CONDUYT PID Controller Module
 *
 * Commands:
 *   0x01  config(kp: float32, ki: float32, kd: float32)
 *   0x02  setTarget(value: float32)
 *   0x03  setInput(pin_num: uint8)
 *   0x04  setOutput(pin_num: uint8)
 *   0x05  enable() / disable() — toggle byte
 *
 * Events:
 *   0x01  tick(input: float32, output: float32, error: float32)
 *
 * Compile-time opt-in: #define CONDUYT_MODULE_PID
 */

#ifndef CONDUYT_MODULE_PID_H
#define CONDUYT_MODULE_PID_H

#ifdef CONDUYT_MODULE_PID

#include "../ConduytModuleBase.h"
#include "../ConduytContext.h"

class ConduytModulePID : public ConduytModuleBase {
public:
    const char* name() override { return "pid"; }
    uint8_t versionMajor() override { return 1; }
    uint8_t versionMinor() override { return 0; }

    void handle(uint8_t cmd, ConduytPayloadReader &payload, ConduytContext &ctx) override {
        switch (cmd) {
            case 0x01: { // config
                _kp = payload.readFloat32();
                _ki = payload.readFloat32();
                _kd = payload.readFloat32();
                ctx.ack();
                break;
            }
            case 0x02: { // setTarget
                _target = payload.readFloat32();
                ctx.ack();
                break;
            }
            case 0x03: { // setInput pin
                _inputPin = payload.readUInt8();
                ctx.ack();
                break;
            }
            case 0x04: { // setOutput pin
                _outputPin = payload.readUInt8();
#ifdef ARDUINO
                pinMode(_outputPin, OUTPUT);
#endif
                ctx.ack();
                break;
            }
            case 0x05: { // enable/disable
                _enabled = payload.readUInt8() != 0;
                if (_enabled) {
                    _integral = 0;
                    _lastError = 0;
                    _lastMs = 0;
                }
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
        if (!_enabled || _inputPin == 0xFF || _outputPin == 0xFF) return;

        uint32_t now = millis();
        if (_lastMs == 0) { _lastMs = now; return; }
        if (now - _lastMs < _intervalMs) return;

        float dt = (now - _lastMs) / 1000.0f;
        _lastMs = now;

        float input = analogRead(_inputPin) / 1023.0f * _inputScale;
        float error = _target - input;
        _integral += error * dt;
        float derivative = (error - _lastError) / dt;
        _lastError = error;

        float output = _kp * error + _ki * _integral + _kd * derivative;

        /* Clamp to 0-255 for PWM output */
        if (output < 0) output = 0;
        if (output > 255) output = 255;

        analogWrite(_outputPin, (int)output);
#endif
    }

private:
    float _kp = 1.0f, _ki = 0.0f, _kd = 0.0f;
    float _target = 0.0f;
    float _integral = 0.0f;
    float _lastError = 0.0f;
    float _inputScale = 100.0f; /* scale analog 0-1023 to 0-100 by default */
    uint8_t _inputPin = 0xFF;
    uint8_t _outputPin = 0xFF;
    uint32_t _lastMs = 0;
    uint16_t _intervalMs = 100; /* PID tick rate */
    bool _enabled = false;
};

#endif /* CONDUYT_MODULE_PID */
#endif /* CONDUYT_MODULE_PID_H */

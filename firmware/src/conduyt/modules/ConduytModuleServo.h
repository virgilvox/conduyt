/**
 * CONDUYT Servo Module
 *
 * Commands:
 *   0x01  attach(pin, min_us, max_us)
 *   0x02  write(angle)
 *   0x03  writeMicroseconds(us)
 *   0x04  detach()
 *
 * Compile-time opt-in: #define CONDUYT_MODULE_SERVO
 */

#ifndef CONDUYT_MODULE_SERVO_H
#define CONDUYT_MODULE_SERVO_H

#ifdef CONDUYT_MODULE_SERVO

#include "../ConduytModuleBase.h"
#include "../ConduytContext.h"

#ifdef ARDUINO
#include <Servo.h>
#endif

class ConduytModuleServo : public ConduytModuleBase {
public:
    const char* name() override { return "servo"; }
    uint8_t versionMajor() override { return 1; }
    uint8_t versionMinor() override { return 0; }

    void begin() override {}

    void handle(uint8_t cmd, ConduytPayloadReader &payload, ConduytContext &ctx) override {
        switch (cmd) {
            case 0x01: { // attach
                uint8_t pin = payload.readUInt8();
                uint16_t minUs = payload.readUInt16();
                uint16_t maxUs = payload.readUInt16();
                if (minUs == 0) minUs = 544;
                if (maxUs == 0) maxUs = 2400;
                _pin = pin;
#ifdef ARDUINO
                _servo.attach(pin, minUs, maxUs);
#endif
                ctx.ack();
                break;
            }
            case 0x02: { // write angle
                uint8_t angle = payload.readUInt8();
#ifdef ARDUINO
                _servo.write(angle);
#endif
                ctx.ack();
                break;
            }
            case 0x03: { // writeMicroseconds
                uint16_t us = payload.readUInt16();
#ifdef ARDUINO
                _servo.writeMicroseconds(us);
#endif
                ctx.ack();
                break;
            }
            case 0x04: { // detach
#ifdef ARDUINO
                _servo.detach();
#endif
                ctx.ack();
                break;
            }
            default:
                ctx.nak(0x09); // UNKNOWN_MODULE_CMD
                break;
        }
    }

    uint8_t pinCount() override { return (_pin != 0xFF) ? 1 : 0; }
    const uint8_t* pins() override { return (_pin != 0xFF) ? &_pin : nullptr; }

private:
#ifdef ARDUINO
    Servo _servo;
#endif
    uint8_t _pin = 0xFF;
};

#endif /* CONDUYT_MODULE_SERVO */
#endif /* CONDUYT_MODULE_SERVO_H */

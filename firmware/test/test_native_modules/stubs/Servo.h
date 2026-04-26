/**
 * Minimal Servo stub for native module tests. Mirrors the Arduino Servo
 * library's surface area used by ConduytModuleServo. No real PWM — these
 * tests only verify the protocol-side wire bytes, not actual servo motion.
 */
#ifndef CONDUYT_TEST_STUB_SERVO_H
#define CONDUYT_TEST_STUB_SERVO_H

#include <stdint.h>

class Servo {
public:
    Servo() {}
    uint8_t attach(int pin, int minUs = 544, int maxUs = 2400) {
        _pin = (uint8_t)pin; _min = minUs; _max = maxUs; _attached = true;
        return 0;
    }
    void write(int angle) { _angle = angle; }
    void writeMicroseconds(int us) { _us = us; }
    void detach() { _attached = false; }
    bool attached() { return _attached; }

    /* Inspectable state for tests. */
    uint8_t _pin = 0;
    int _min = 0, _max = 0, _angle = -1, _us = -1;
    bool _attached = false;
};

#endif

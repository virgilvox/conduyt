/**
 * Minimal DHT stub for native module tests. Tests can override the
 * "sensor reading" via `DHT::stubTemp` / `DHT::stubHum` (inline statics)
 * to drive the module's NaN-error and MOD_RESP paths.
 */
#ifndef CONDUYT_TEST_STUB_DHT_H
#define CONDUYT_TEST_STUB_DHT_H

#include <stdint.h>

#define DHT11 11
#define DHT22 22

class DHT {
public:
    DHT(uint8_t pin, uint8_t type) : _pin(pin), _type(type) {}
    void begin() { _begun = true; }
    float readTemperature() { return stubTemp; }
    float readHumidity() { return stubHum; }

    /* C++17 inline statics — settable by tests. */
    inline static float stubTemp = 23.5f;
    inline static float stubHum  = 45.0f;

    uint8_t _pin = 0, _type = 0;
    bool _begun = false;
};

#endif

/**
 * Minimal Adafruit_NeoPixel stub for native module tests. The protocol-level
 * wire bytes are what we care about; the LED bit-banging is irrelevant on
 * the host. The class records calls so tests can inspect what the module
 * dispatched into the library.
 */
#ifndef CONDUYT_TEST_STUB_ADAFRUIT_NEOPIXEL_H
#define CONDUYT_TEST_STUB_ADAFRUIT_NEOPIXEL_H

#include <stdint.h>

#define NEO_GRB    0x52
#define NEO_KHZ800 0x0000

class Adafruit_NeoPixel {
public:
    Adafruit_NeoPixel(uint16_t count, uint8_t pin, uint16_t type)
        : _count(count), _pin(pin), _type(type) {}

    void begin() { _begun = true; }
    void show() { _showCount++; }
    void setBrightness(uint8_t b) { _brightness = b; }

    void setPixelColor(uint16_t i, uint8_t r, uint8_t g, uint8_t b, uint8_t w = 0) {
        _lastIndex = i; _lastR = r; _lastG = g; _lastB = b; _lastW = w;
        _setPixelCount++;
    }
    void setPixelColor(uint16_t i, uint32_t color) {
        _lastIndex = i; _lastColor = color; _setPixelCount++;
    }
    void fill(uint32_t color) { _fillColor = color; _fillCount++; }

    static uint32_t Color(uint8_t r, uint8_t g, uint8_t b) {
        return ((uint32_t)r << 16) | ((uint32_t)g << 8) | (uint32_t)b;
    }
    static uint32_t Color(uint8_t r, uint8_t g, uint8_t b, uint8_t w) {
        return ((uint32_t)w << 24) | ((uint32_t)r << 16) | ((uint32_t)g << 8) | (uint32_t)b;
    }

    uint16_t _count = 0, _type = 0;
    uint8_t _pin = 0, _brightness = 0;
    bool _begun = false;
    int _showCount = 0, _setPixelCount = 0, _fillCount = 0;
    uint16_t _lastIndex = 0;
    uint8_t _lastR = 0, _lastG = 0, _lastB = 0, _lastW = 0;
    uint32_t _lastColor = 0, _fillColor = 0;
};

#endif

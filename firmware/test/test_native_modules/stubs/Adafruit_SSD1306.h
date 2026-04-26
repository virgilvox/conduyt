/**
 * Minimal Adafruit_SSD1306 stub. Inherits the GFX recorder so the OLED
 * module test can verify text/rect/bitmap dispatch without linking the
 * real library.
 */
#ifndef CONDUYT_TEST_STUB_ADAFRUIT_SSD1306_H
#define CONDUYT_TEST_STUB_ADAFRUIT_SSD1306_H

#include <stdint.h>
#include "Adafruit_GFX.h"

#define SSD1306_WHITE         1
#define SSD1306_SWITCHCAPVCC  0x02

/* OLED ctor takes a Wire pointer; provide a forward declaration so we can
   accept it without dragging in a Wire stub here. ArduinoFake supplies its
   own Wire mock for the rest of the test suite. */
class TwoWire;

class Adafruit_SSD1306 : public Adafruit_GFX {
public:
    Adafruit_SSD1306(int16_t w, int16_t h, TwoWire * /*wire*/, int /*rstPin*/)
        : Adafruit_GFX(w, h) {}

    bool begin(uint8_t /*vcc*/, uint8_t addr) {
        _addr = addr; _begun = true; return true;
    }
    void clearDisplay() { _clearCount++; }
    void display() { _displayCount++; }

    uint8_t _addr = 0;
    bool _begun = false;
    int _clearCount = 0, _displayCount = 0;
};

#endif

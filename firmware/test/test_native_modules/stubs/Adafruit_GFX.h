/**
 * Minimal Adafruit_GFX stub. Just enough surface for Adafruit_SSD1306 to
 * inherit and for the OLED module to call its drawing primitives.
 */
#ifndef CONDUYT_TEST_STUB_ADAFRUIT_GFX_H
#define CONDUYT_TEST_STUB_ADAFRUIT_GFX_H

#include <stdint.h>

class Adafruit_GFX {
public:
    Adafruit_GFX(int16_t w, int16_t h) : _w(w), _h(h) {}
    void setTextSize(uint8_t s) { _textSize = s; }
    void setTextColor(uint16_t c) { _textColor = c; }
    void setCursor(int16_t x, int16_t y) { _cx = x; _cy = y; }
    void print(const char *s) { _lastPrint = s; _printCount++; }
    void drawRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t c) {
        _lastRectX = x; _lastRectY = y; _lastRectW = w; _lastRectH = h;
        _lastRectC = c; _lastRectFilled = false; _rectCount++;
    }
    void fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t c) {
        _lastRectX = x; _lastRectY = y; _lastRectW = w; _lastRectH = h;
        _lastRectC = c; _lastRectFilled = true; _rectCount++;
    }
    void drawBitmap(int16_t x, int16_t y, const uint8_t *bitmap,
                    int16_t w, int16_t h, uint16_t c) {
        _lastBmpX = x; _lastBmpY = y; _lastBmpW = w; _lastBmpH = h;
        _lastBmpC = c; _bmpCount++;
    }

    int16_t _w = 0, _h = 0;
    uint8_t _textSize = 1;
    uint16_t _textColor = 0;
    int16_t _cx = 0, _cy = 0;
    const char *_lastPrint = nullptr;
    int _printCount = 0;
    int16_t _lastRectX = 0, _lastRectY = 0, _lastRectW = 0, _lastRectH = 0;
    uint16_t _lastRectC = 0;
    bool _lastRectFilled = false;
    int _rectCount = 0;
    int16_t _lastBmpX = 0, _lastBmpY = 0, _lastBmpW = 0, _lastBmpH = 0;
    uint16_t _lastBmpC = 0;
    int _bmpCount = 0;
};

#endif

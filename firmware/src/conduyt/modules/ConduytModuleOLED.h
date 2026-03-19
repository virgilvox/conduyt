/**
 * CONDUYT OLED SSD1306 Module
 *
 * Commands:
 *   0x01  begin(width, height, i2c_addr)
 *   0x02  clear()
 *   0x03  text(x, y, size, str)
 *   0x04  drawRect(x, y, w, h, fill)
 *   0x05  drawBitmap(x, y, w, h, data)
 *   0x06  show() — flush buffer to display
 *
 * Compile-time opt-in: #define CONDUYT_MODULE_OLED
 * Requires: Adafruit_SSD1306 + Adafruit_GFX
 */

#ifndef CONDUYT_MODULE_OLED_H
#define CONDUYT_MODULE_OLED_H

#ifdef CONDUYT_MODULE_OLED

#include "../ConduytModuleBase.h"
#include "../ConduytContext.h"

#ifdef ARDUINO
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#endif

class ConduytModuleOLED : public ConduytModuleBase {
public:
    const char* name() override { return "oled1306"; }
    uint8_t versionMajor() override { return 1; }
    uint8_t versionMinor() override { return 0; }

    void handle(uint8_t cmd, ConduytPayloadReader &payload, ConduytContext &ctx) override {
        switch (cmd) {
            case 0x01: { // begin
                uint8_t w = payload.readUInt8();
                uint8_t h = payload.readUInt8();
                uint8_t addr = payload.readUInt8();
                if (addr == 0) addr = 0x3C;
#ifdef ARDUINO
                if (_display) { delete _display; _display = nullptr; }
                _display = new Adafruit_SSD1306(w, h, &Wire, -1);
                _display->begin(SSD1306_SWITCHCAPVCC, addr);
                _display->clearDisplay();
                _display->display();
#endif
                _ready = true;
                ctx.ack();
                break;
            }
            case 0x02: { // clear
#ifdef ARDUINO
                if (_display) { _display->clearDisplay(); }
#endif
                ctx.ack();
                break;
            }
            case 0x03: { // text
                uint8_t x = payload.readUInt8();
                uint8_t y = payload.readUInt8();
                uint8_t size = payload.readUInt8();
                /* Remaining bytes are the string */
                uint8_t strBuf[64];
                size_t strLen = payload.readBytes(strBuf, sizeof(strBuf) - 1);
                strBuf[strLen] = '\0';
#ifdef ARDUINO
                if (_display) {
                    _display->setTextSize(size);
                    _display->setTextColor(SSD1306_WHITE);
                    _display->setCursor(x, y);
                    _display->print((const char*)strBuf);
                }
#endif
                ctx.ack();
                break;
            }
            case 0x04: { // drawRect
                uint8_t x = payload.readUInt8();
                uint8_t y = payload.readUInt8();
                uint8_t w = payload.readUInt8();
                uint8_t h = payload.readUInt8();
                uint8_t fill = payload.readUInt8();
#ifdef ARDUINO
                if (_display) {
                    if (fill) _display->fillRect(x, y, w, h, SSD1306_WHITE);
                    else _display->drawRect(x, y, w, h, SSD1306_WHITE);
                }
#endif
                ctx.ack();
                break;
            }
            case 0x05: { // drawBitmap
                uint8_t x = payload.readUInt8();
                uint8_t y = payload.readUInt8();
                uint8_t w = payload.readUInt8();
                uint8_t h = payload.readUInt8();
#ifdef ARDUINO
                if (_display && payload.remaining() >= (size_t)((w * h + 7) / 8)) {
                    _display->drawBitmap(x, y, payload.data() + payload.position(), w, h, SSD1306_WHITE);
                }
#endif
                ctx.ack();
                break;
            }
            case 0x06: { // show
#ifdef ARDUINO
                if (_display) _display->display();
#endif
                ctx.ack();
                break;
            }
            default:
                ctx.nak(0x09);
                break;
        }
    }

#ifdef ARDUINO
    ~ConduytModuleOLED() { if (_display) delete _display; }
#endif

private:
#ifdef ARDUINO
    Adafruit_SSD1306 *_display = nullptr;
#endif
    bool _ready = false;
};

#endif /* CONDUYT_MODULE_OLED */
#endif /* CONDUYT_MODULE_OLED_H */

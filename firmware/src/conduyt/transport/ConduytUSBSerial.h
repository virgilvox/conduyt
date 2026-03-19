/**
 * CONDUYT USB Serial Transport
 *
 * Same as ConduytSerial but waits for USB CDC enumeration on boards
 * where Serial is USB (Leonardo, Pro Micro, SAMD, RP2040, Teensy).
 */

#ifndef CONDUYT_USB_SERIAL_H
#define CONDUYT_USB_SERIAL_H

#include "ConduytTransport.h"

#ifdef ARDUINO

class ConduytUSBSerial : public ConduytTransport {
public:
    ConduytUSBSerial(uint32_t baud = 115200, uint32_t timeoutMs = 5000)
        : _baud(baud), _timeoutMs(timeoutMs), _begun(false) {}

    bool begin() override {
        Serial.begin(_baud);

        // Wait for USB enumeration (with timeout)
        uint32_t start = millis();
        while (!Serial && (millis() - start < _timeoutMs)) {
            delay(10);
        }

        _begun = true;
        return true;
    }

    bool connected() override { return _begun && (bool)Serial; }

    size_t write(const uint8_t *buf, size_t len) override {
        return Serial.write(buf, len);
    }

    int available() override { return Serial.available(); }

    int read(uint8_t *buf, size_t maxLen) override {
        size_t count = 0;
        while (count < maxLen && Serial.available()) {
            int b = Serial.read();
            if (b < 0) break;
            buf[count++] = (uint8_t)b;
        }
        return (int)count;
    }

    void flush() override { Serial.flush(); }
    bool needsCOBS() override { return true; }

private:
    uint32_t _baud;
    uint32_t _timeoutMs;
    bool _begun;
};

#endif /* ARDUINO */
#endif /* CONDUYT_USB_SERIAL_H */

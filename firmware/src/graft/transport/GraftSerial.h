/**
 * GRAFT Serial Transport — COBS-framed HardwareSerial adapter
 *
 * Works on all Arduino-compatible boards with a HardwareSerial port.
 * COBS framing with 0x00 delimiter for packet boundaries.
 */

#ifndef GRAFT_SERIAL_H
#define GRAFT_SERIAL_H

#include "GraftTransport.h"

#ifdef ARDUINO
#include <Arduino.h>

class GraftSerial : public GraftTransport {
public:
    /**
     * @param serial  Reference to HardwareSerial (Serial, Serial1, etc.)
     * @param baud    Baud rate (default 115200)
     */
    GraftSerial(HardwareSerial &serial, uint32_t baud = 115200)
        : _serial(serial), _hwSerial(&serial), _baud(baud), _begun(false) {}

    /**
     * @param stream  Reference to any Stream (usb_serial_class on Teensy, etc.)
     * @param baud    Baud rate (used for HardwareSerial begin, ignored for USB)
     */
    GraftSerial(Stream &stream, uint32_t baud = 115200)
        : _serial(stream), _hwSerial(nullptr), _baud(baud), _begun(false) {}

    bool begin() override {
        if (_hwSerial) _hwSerial->begin(_baud);
        _begun = true;
        return true;
    }

    bool connected() override {
        return _begun;
    }

    size_t write(const uint8_t *buf, size_t len) override {
        return _serial.write(buf, len);
    }

    int available() override {
        return _serial.available();
    }

    int read(uint8_t *buf, size_t maxLen) override {
        size_t count = 0;
        while (count < maxLen && _serial.available()) {
            int b = _serial.read();
            if (b < 0) break;
            buf[count++] = (uint8_t)b;
        }
        return (int)count;
    }

    void flush() override {
        _serial.flush();
    }

    bool needsCOBS() override { return true; }

private:
    Stream &_serial;
    HardwareSerial *_hwSerial;
    uint32_t _baud;
    bool _begun;
};

#endif /* ARDUINO */
#endif /* GRAFT_SERIAL_H */

/**
 * CONDUYT MockTransport — In-memory transport for native testing
 *
 * Captures all written bytes and allows injecting receive data.
 * No real I/O. No Arduino dependencies.
 */

#ifndef CONDUYT_MOCK_TRANSPORT_H
#define CONDUYT_MOCK_TRANSPORT_H

#include "../../src/conduyt/transport/ConduytTransport.h"
#include "../../src/conduyt/core/conduyt_constants.h"
#include <string.h>

class MockTransport : public ConduytTransport {
public:
    /* Output capture */
    uint8_t writeBuf[2048];
    size_t  writeLen = 0;
    int     writeCallCount = 0;

    /* Input injection */
    uint8_t feedBuf[2048];
    size_t  feedLen = 0;
    size_t  feedPos = 0;

    /* State */
    bool _connected = false;
    bool _needsCOBS = false;  /* default: non-COBS for simpler testing */
    bool _beginCalled = false;

    bool begin() override {
        _beginCalled = true;
        _connected = true;
        return true;
    }

    bool connected() override {
        return _connected;
    }

    size_t write(const uint8_t *buf, size_t len) override {
        writeCallCount++;
        size_t space = sizeof(writeBuf) - writeLen;
        size_t n = (len < space) ? len : space;
        if (n > 0) {
            memcpy(writeBuf + writeLen, buf, n);
            writeLen += n;
        }
        return n;
    }

    int available() override {
        return (int)(feedLen - feedPos);
    }

    int read(uint8_t *buf, size_t maxLen) override {
        size_t avail = feedLen - feedPos;
        size_t n = (maxLen < avail) ? maxLen : avail;
        if (n > 0) {
            memcpy(buf, feedBuf + feedPos, n);
            feedPos += n;
        }
        return (int)n;
    }

    void flush() override {}

    bool needsCOBS() override {
        return _needsCOBS;
    }

    void poll() override {}

    /* ── Test helpers ──────────────────────────── */

    /** Inject raw bytes to be read by the device. */
    void feed(const uint8_t *data, size_t len) {
        size_t space = sizeof(feedBuf) - feedLen;
        size_t n = (len < space) ? len : space;
        memcpy(feedBuf + feedLen, data, n);
        feedLen += n;
    }

    /** Reset all state. */
    void reset() {
        writeLen = 0;
        writeCallCount = 0;
        feedLen = 0;
        feedPos = 0;
        _connected = false;
        _needsCOBS = false;
        _beginCalled = false;
    }

    /** Clear only the write buffer (keep feed data). */
    void clearWrite() {
        writeLen = 0;
        writeCallCount = 0;
    }

    /**
     * Find a sent packet by type in writeBuf.
     * Scans for CONDUYT magic + version + matching type byte.
     * Returns pointer to start of packet or NULL.
     */
    const uint8_t* findSentPacketByType(uint8_t type) const {
        for (size_t i = 0; i + CONDUYT_HEADER_SIZE <= writeLen; i++) {
            if (writeBuf[i] == CONDUYT_MAGIC_0 &&
                writeBuf[i + 1] == CONDUYT_MAGIC_1 &&
                writeBuf[i + 2] == CONDUYT_PROTOCOL_VERSION &&
                writeBuf[i + 3] == type) {
                return &writeBuf[i];
            }
        }
        return nullptr;
    }

    /** Count how many packets of a given type were sent. */
    int countSentPacketsByType(uint8_t type) const {
        int count = 0;
        for (size_t i = 0; i + CONDUYT_HEADER_SIZE <= writeLen; i++) {
            if (writeBuf[i] == CONDUYT_MAGIC_0 &&
                writeBuf[i + 1] == CONDUYT_MAGIC_1 &&
                writeBuf[i + 2] == CONDUYT_PROTOCOL_VERSION &&
                writeBuf[i + 3] == type) {
                count++;
                /* Skip past this packet */
                uint16_t plen = (uint16_t)writeBuf[i + 5] | ((uint16_t)writeBuf[i + 6] << 8);
                i += CONDUYT_HEADER_SIZE + plen - 1; /* -1 because loop increments */
            }
        }
        return count;
    }
};

#endif /* CONDUYT_MOCK_TRANSPORT_H */

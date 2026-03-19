/**
 * CONDUYT OTA — Over-the-Air Firmware Update
 *
 * Handles OTA_BEGIN, OTA_CHUNK, OTA_FINALIZE packet sequence.
 * Platform-specific: ESP32 uses Update.h.
 *
 * Compile guard: #define CONDUYT_OTA
 */

#ifndef CONDUYT_OTA_H
#define CONDUYT_OTA_H

#ifdef CONDUYT_OTA

#include <stdint.h>
#include "ConduytPayload.h"
#include "ConduytContext.h"

#if defined(ESP32)
#include <Update.h>
#endif

class ConduytOTA {
public:
    /**
     * Handle OTA_BEGIN: start firmware update.
     * Payload: total_bytes(uint32) + sha256(32 bytes)
     */
    void handleBegin(ConduytPayloadReader &payload, ConduytContext &ctx) {
        _totalBytes = payload.readUInt32();
        payload.readBytes(_sha256, 32);
        _received = 0;
        _active = false;

#if defined(ESP32)
        if (!Update.begin(_totalBytes)) {
            ctx.nak(0x0F); // OTA_INVALID
            return;
        }
        _active = true;
#endif
        ctx.ack();
    }

    /**
     * Handle OTA_CHUNK: write firmware data.
     * Payload: offset(uint32) + data(N bytes)
     */
    void handleChunk(ConduytPayloadReader &payload, ConduytContext &ctx) {
        if (!_active) { ctx.nak(0x0F); return; }

        uint32_t offset = payload.readUInt32();
        size_t dataLen = payload.remaining();

        if (offset != _received) {
            ctx.nak(0x0F); // Out of sequence
            return;
        }

#if defined(ESP32)
        size_t written = Update.write(
            (uint8_t *)(payload.data() + payload.position()), dataLen
        );
        if (written != dataLen) {
            ctx.nak(0x0F);
            return;
        }
#endif
        _received += dataLen;
        ctx.ack();
    }

    /**
     * Handle OTA_FINALIZE: validate and apply update.
     */
    void handleFinalize(ConduytContext &ctx) {
        if (!_active) { ctx.nak(0x0F); return; }

#if defined(ESP32)
        if (!Update.end(true)) {
            ctx.nak(0x0F);
            return;
        }
        // SHA256 validation would go here in a full implementation
        ctx.ack();
        delay(500);
        ESP.restart();
#else
        ctx.ack();
#endif
        _active = false;
    }

    bool isActive() const { return _active; }
    uint32_t totalBytes() const { return _totalBytes; }
    uint32_t receivedBytes() const { return _received; }

private:
    uint32_t _totalBytes = 0;
    uint32_t _received = 0;
    uint8_t _sha256[32] = {0};
    bool _active = false;
};

#endif /* CONDUYT_OTA */
#endif /* CONDUYT_OTA_H */

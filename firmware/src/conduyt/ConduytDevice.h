/**
 * CONDUYT Device — Main Firmware Orchestrator
 *
 * The central class that ties transport, modules, subscriptions,
 * and datastreams together. Users create one ConduytDevice in setup()
 * and call poll() in loop().
 */

#ifndef CONDUYT_DEVICE_H
#define CONDUYT_DEVICE_H

#include <stdint.h>
#include <string.h>

#include "core/conduyt_constants.h"
#include "core/conduyt_types.h"
#include "core/conduyt_wire.h"
#include "core/conduyt_cobs.h"
#include "core/conduyt_crc8.h"
#include "ConduytBoard.h"
#include "ConduytPayload.h"
#include "ConduytContext.h"
#include "ConduytModuleBase.h"
#include "transport/ConduytTransport.h"

#ifdef ARDUINO
#include <Wire.h>
#include <SPI.h>
#endif

#ifdef CONDUYT_OTA
#include "ConduytOTA.h"
#endif

/* ── Datastream Storage ───────────────────────────────── */

struct ConduytDatastreamEntry {
    char    name[CONDUYT_DS_NAME_LEN + 1];
    uint8_t type;       /* CONDUYT_TYPE_* */
    char    unit[CONDUYT_DS_UNIT_LEN + 1];
    uint8_t writable;
    uint8_t pinRef;
    uint8_t retain;
    /* Callback for host writes to writable datastreams */
    void (*onWrite)(ConduytPayloadReader &payload, ConduytContext &ctx);
};

/* ── Subscription Storage ─────────────────────────────── */

struct ConduytSubscriptionEntry {
    uint8_t  pin;
    uint8_t  mode;      /* CONDUYT_SUB_* */
    uint16_t intervalMs;
    uint16_t threshold;
    uint16_t lastValue;
    uint32_t lastReportMs;
    bool     active;
};

/* ── ConduytDevice ──────────────────────────────────────── */

class ConduytDevice {
public:
    /**
     * @param name      Firmware name (max 16 chars)
     * @param version   Firmware version string "major.minor.patch"
     * @param transport Reference to an initialized transport
     */
    ConduytDevice(const char *name, const char *version, ConduytTransport &transport);

    /** Register a module. Call before begin(). */
    void addModule(ConduytModuleBase *module);

    /**
     * Declare a datastream. Call before begin().
     * @param name     Datastream name (max 16 chars)
     * @param type     CONDUYT_TYPE_* constant
     * @param unit     Unit string (max 8 chars, "" if none)
     * @param writable true if host can write to this datastream
     */
    void addDatastream(const char *name, uint8_t type,
                       const char *unit, bool writable);

    /**
     * Set callback for host writes to a writable datastream.
     */
    void onDatastreamWrite(const char *name,
                           void (*callback)(ConduytPayloadReader &payload, ConduytContext &ctx));

    /** Initialize the device. Call once in setup() after all modules/datastreams are added. */
    void begin();

    /** Process one incoming packet. Call in loop(). Non-blocking. */
    void poll();

    /** Write a value to a datastream (device → host push). */
    void writeDatastream(const char *name, float value);
    void writeDatastream(const char *name, int32_t value);
    void writeDatastream(const char *name, bool value);
    void writeDatastream(const char *name, const uint8_t *data, size_t len);

    /** Send a raw packet. Used internally and by ConduytContext. */
    void sendPacket(uint8_t type, uint8_t seq, const uint8_t *payload, size_t len);

    /** Send ACK for a given seq. */
    void sendAck(uint8_t seq);

    /** Send NAK for a given seq with error code. */
    void sendNak(uint8_t seq, uint8_t errorCode);

    /* ── Accessors ──── */
    const char* firmwareName() const { return _name; }
    uint8_t versionMajor() const { return _verMajor; }
    uint8_t versionMinor() const { return _verMinor; }
    uint8_t versionPatch() const { return _verPatch; }
    uint8_t moduleCount() const { return _moduleCount; }
    uint8_t datastreamCount() const { return _dsCount; }
    ConduytTransport &transport() { return _transport; }

private:
    /* ── Config ──── */
    char _name[CONDUYT_FIRMWARE_NAME_LEN + 1];
    uint8_t _verMajor, _verMinor, _verPatch;
    ConduytTransport &_transport;

    /* ── Modules ──── */
    ConduytModuleBase *_modules[CONDUYT_MAX_MODULES];
    uint8_t _moduleCount;

    /* ── Datastreams ──── */
    ConduytDatastreamEntry _datastreams[CONDUYT_MAX_DATASTREAMS];
    uint8_t _dsCount;

    /* ── Subscriptions ──── */
    ConduytSubscriptionEntry _subs[CONDUYT_MAX_SUBSCRIPTIONS];
    uint8_t _subCount;

    /* ── Buffers ──── */
    uint8_t _rxBuf[CONDUYT_PACKET_BUF_SIZE + CONDUYT_HEADER_SIZE];
    size_t  _rxLen;
    uint8_t _txBuf[CONDUYT_PACKET_BUF_SIZE + CONDUYT_HEADER_SIZE];
    uint8_t _cobsBuf[CONDUYT_COBS_BUF_SIZE];

    /* ── HELLO_RESP cache ──── */
    uint8_t _helloBuf[CONDUYT_PACKET_BUF_SIZE];
    size_t  _helloLen;

    /* ── Internal methods ──── */
    void parseVersion(const char *version);
    void buildHelloResp();
    void dispatch(const ConduytPacket &pkt);
    void handlePing(const ConduytPacket &pkt);
    void handleHello(const ConduytPacket &pkt);
    void handlePinMode(const ConduytPacket &pkt);
    void handlePinWrite(const ConduytPacket &pkt);
    void handlePinRead(const ConduytPacket &pkt);
    void handlePinSubscribe(const ConduytPacket &pkt);
    void handlePinUnsubscribe(const ConduytPacket &pkt);
    void handleModCmd(const ConduytPacket &pkt);
    void handleDsWrite(const ConduytPacket &pkt);
    void handleDsRead(const ConduytPacket &pkt);
    void handleDsSubscribe(const ConduytPacket &pkt);
    void handleReset(const ConduytPacket &pkt);
    void handleI2CWrite(const ConduytPacket &pkt);
    void handleI2CRead(const ConduytPacket &pkt);
    void handleI2CReadReg(const ConduytPacket &pkt);
    void handleSPIXfer(const ConduytPacket &pkt);
    void handleStreamStart(const ConduytPacket &pkt);
    void handleStreamStop(const ConduytPacket &pkt);
    void handleOTABegin(const ConduytPacket &pkt);
    void handleOTAChunk(const ConduytPacket &pkt);
    void handleOTAFinalize(const ConduytPacket &pkt);
    void processStreaming();
    void processSubscriptions();
    int8_t findDatastream(const char *name);

    /* ── Streaming ──── */
    uint16_t _streamPinMask = 0;
    uint16_t _streamRateHz = 0;
    uint32_t _streamIntervalUs = 0;
    uint32_t _streamLastUs = 0;
    bool _streamActive = false;

    /* ── OTA ──── */
#ifdef CONDUYT_OTA
    ConduytOTA _ota;
#endif

    /* COBS framing helpers */
    void sendFramed(const uint8_t *raw, size_t rawLen);
    bool receiveFramed();
};

#endif /* CONDUYT_DEVICE_H */

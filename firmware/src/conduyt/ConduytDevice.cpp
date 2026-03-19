/**
 * CONDUYT Device — Implementation
 */

#include "ConduytDevice.h"

#ifdef ARDUINO
#include <Arduino.h>
#else
/* Desktop builds: provide millis() stub */
#include <time.h>
static uint32_t millis() {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint32_t)(ts.tv_sec * 1000 + ts.tv_nsec / 1000000);
}
#endif

/* ── Constructor ──────────────────────────────────────── */

ConduytDevice::ConduytDevice(const char *name, const char *version, ConduytTransport &transport)
    : _transport(transport), _moduleCount(0), _dsCount(0), _subCount(0),
      _rxLen(0), _helloLen(0)
{
    memset(_name, 0, sizeof(_name));
    strncpy(_name, name, CONDUYT_FIRMWARE_NAME_LEN);
    parseVersion(version);
    memset(_modules, 0, sizeof(_modules));
    memset(_datastreams, 0, sizeof(_datastreams));
    memset(_subs, 0, sizeof(_subs));
}

void ConduytDevice::parseVersion(const char *version) {
    _verMajor = 0; _verMinor = 0; _verPatch = 0;
    if (!version) return;
    int parts[3] = {0, 0, 0};
    int idx = 0;
    for (const char *p = version; *p && idx < 3; p++) {
        if (*p == '.') { idx++; }
        else if (*p >= '0' && *p <= '9') {
            parts[idx] = parts[idx] * 10 + (*p - '0');
        }
    }
    _verMajor = (uint8_t)parts[0];
    _verMinor = (uint8_t)parts[1];
    _verPatch = (uint8_t)parts[2];
}

/* ── Registration ─────────────────────────────────────── */

void ConduytDevice::addModule(ConduytModuleBase *module) {
    if (_moduleCount < CONDUYT_MAX_MODULES && module) {
        _modules[_moduleCount++] = module;
    }
}

void ConduytDevice::addDatastream(const char *name, uint8_t type,
                                 const char *unit, bool writable)
{
    if (_dsCount >= CONDUYT_MAX_DATASTREAMS) return;
    ConduytDatastreamEntry &ds = _datastreams[_dsCount];
    memset(&ds, 0, sizeof(ds));
    strncpy(ds.name, name, CONDUYT_DS_NAME_LEN);
    ds.type = type;
    if (unit) strncpy(ds.unit, unit, CONDUYT_DS_UNIT_LEN);
    ds.writable = writable ? 1 : 0;
    ds.pinRef = 0xFF;
    ds.retain = writable ? 1 : 0;  /* writable datastreams retained by default */
    ds.onWrite = nullptr;
    _dsCount++;
}

void ConduytDevice::onDatastreamWrite(const char *name,
                                     void (*callback)(ConduytPayloadReader &, ConduytContext &))
{
    int8_t idx = findDatastream(name);
    if (idx >= 0) {
        _datastreams[idx].onWrite = callback;
    }
}

int8_t ConduytDevice::findDatastream(const char *name) {
    for (uint8_t i = 0; i < _dsCount; i++) {
        if (strncmp(_datastreams[i].name, name, CONDUYT_DS_NAME_LEN) == 0) {
            return (int8_t)i;
        }
    }
    return -1;
}

/* ── Lifecycle ────────────────────────────────────────── */

void ConduytDevice::begin() {
    _transport.begin();

    /* Initialize modules */
    for (uint8_t i = 0; i < _moduleCount; i++) {
        if (_modules[i]) {
            _modules[i]->setDevice(this);
            _modules[i]->begin();
        }
    }

    /* Pre-build HELLO_RESP payload */
    buildHelloResp();
}

/* ── Poll Loop ────────────────────────────────────────── */

void ConduytDevice::poll() {
    if (!_transport.connected()) return;

    _transport.poll();

    /* Try to receive one packet */
    if (_transport.needsCOBS()) {
        if (receiveFramed()) {
            ConduytPacket pkt;
            ConduytResult res = conduyt_wire_decode(&pkt, _rxBuf, _rxLen);
            if (res == CONDUYT_OK) {
                dispatch(pkt);
            } else if (res == CONDUYT_ERR_INVALID_CRC) {
                /* Send NAK with CRC error (seq 0 since we can't trust the seq) */
                sendNak(0, CONDUYT_ERR_CRC_MISMATCH);
            }
            _rxLen = 0;
        }
    } else {
        /* Non-COBS transport: read directly */
        int avail = _transport.available();
        if (avail > 0) {
            size_t maxRead = sizeof(_rxBuf) - _rxLen;
            if ((size_t)avail > maxRead) avail = (int)maxRead;
            int n = _transport.read(_rxBuf + _rxLen, avail);
            if (n > 0) _rxLen += n;

            /* Try to decode */
            if (_rxLen >= CONDUYT_HEADER_SIZE) {
                ConduytPacket pkt;
                ConduytResult res = conduyt_wire_decode(&pkt, _rxBuf, _rxLen);
                if (res == CONDUYT_OK) {
                    dispatch(pkt);
                    /* Shift buffer */
                    size_t consumed = conduyt_wire_packet_size(pkt.payload_len);
                    if (consumed < _rxLen) {
                        memmove(_rxBuf, _rxBuf + consumed, _rxLen - consumed);
                        _rxLen -= consumed;
                    } else {
                        _rxLen = 0;
                    }
                } else if (res == CONDUYT_ERR_INVALID_CRC) {
                    sendNak(0, CONDUYT_ERR_CRC_MISMATCH);
                    _rxLen = 0;
                }
            }
        }
    }

    /* Process streaming data */
    if (_streamActive) {
        processStreaming();
    }

    /* Process active subscriptions */
    processSubscriptions();

    /* Poll modules */
    for (uint8_t i = 0; i < _moduleCount; i++) {
        if (_modules[i]) _modules[i]->poll();
    }
}

/* ── COBS Framing ─────────────────────────────────────── */

bool ConduytDevice::receiveFramed() {
    while (_transport.available()) {
        uint8_t b;
        if (_transport.read(&b, 1) != 1) break;

        if (b == 0x00) {
            /* Delimiter — decode what we have */
            if (_rxLen > 0) {
                uint8_t decoded[CONDUYT_PACKET_BUF_SIZE + CONDUYT_HEADER_SIZE];
                size_t decLen = conduyt_cobs_decode(decoded, sizeof(decoded),
                                                   _rxBuf, _rxLen);
                if (decLen > 0) {
                    memcpy(_rxBuf, decoded, decLen);
                    _rxLen = decLen;
                    return true;
                }
                _rxLen = 0; /* decode failed, discard */
            }
        } else {
            if (_rxLen < sizeof(_rxBuf)) {
                _rxBuf[_rxLen++] = b;
            } else {
                _rxLen = 0; /* overflow, discard */
            }
        }
    }
    return false;
}

void ConduytDevice::sendFramed(const uint8_t *raw, size_t rawLen) {
    if (_transport.needsCOBS()) {
        size_t cobsLen = conduyt_cobs_encode(_cobsBuf, sizeof(_cobsBuf), raw, rawLen);
        if (cobsLen > 0) {
            _transport.write(_cobsBuf, cobsLen);
            /* Send 0x00 delimiter */
            uint8_t delim = 0x00;
            _transport.write(&delim, 1);
            _transport.flush();
        }
    } else {
        _transport.write(raw, rawLen);
        _transport.flush();
    }
}

/* ── Packet Sending ───────────────────────────────────── */

void ConduytDevice::sendPacket(uint8_t type, uint8_t seq,
                              const uint8_t *payload, size_t len)
{
    ConduytPacket pkt;
    pkt.version = CONDUYT_PROTOCOL_VERSION;
    pkt.type = type;
    pkt.seq = seq;
    pkt.payload_len = (uint16_t)len;
    pkt.payload = (uint8_t *)payload;

    size_t wireLen = conduyt_wire_encode(_txBuf, sizeof(_txBuf), &pkt);
    if (wireLen > 0) {
        sendFramed(_txBuf, wireLen);
    }
}

void ConduytDevice::sendAck(uint8_t seq) {
    sendPacket(CONDUYT_EVT_ACK, seq, nullptr, 0);
}

void ConduytDevice::sendNak(uint8_t seq, uint8_t errorCode) {
    sendPacket(CONDUYT_EVT_NAK, seq, &errorCode, 1);
}

/* ── Dispatch ─────────────────────────────────────────── */

void ConduytDevice::dispatch(const ConduytPacket &pkt) {
    switch (pkt.type) {
        case CONDUYT_CMD_PING:            handlePing(pkt); break;
        case CONDUYT_CMD_HELLO:           handleHello(pkt); break;
        case CONDUYT_CMD_PIN_MODE:        handlePinMode(pkt); break;
        case CONDUYT_CMD_PIN_WRITE:       handlePinWrite(pkt); break;
        case CONDUYT_CMD_PIN_READ:        handlePinRead(pkt); break;
        case CONDUYT_CMD_PIN_SUBSCRIBE:   handlePinSubscribe(pkt); break;
        case CONDUYT_CMD_PIN_UNSUBSCRIBE: handlePinUnsubscribe(pkt); break;
        case CONDUYT_CMD_MOD_CMD:         handleModCmd(pkt); break;
        case CONDUYT_CMD_DS_WRITE:        handleDsWrite(pkt); break;
        case CONDUYT_CMD_DS_READ:         handleDsRead(pkt); break;
        case CONDUYT_CMD_DS_SUBSCRIBE:    handleDsSubscribe(pkt); break;
        case CONDUYT_CMD_RESET:           handleReset(pkt); break;
        case CONDUYT_CMD_I2C_WRITE:       handleI2CWrite(pkt); break;
        case CONDUYT_CMD_I2C_READ:        handleI2CRead(pkt); break;
        case CONDUYT_CMD_I2C_READ_REG:    handleI2CReadReg(pkt); break;
        case CONDUYT_CMD_SPI_XFER:        handleSPIXfer(pkt); break;
        case CONDUYT_CMD_STREAM_START:    handleStreamStart(pkt); break;
        case CONDUYT_CMD_STREAM_STOP:     handleStreamStop(pkt); break;
        case CONDUYT_CMD_OTA_BEGIN:       handleOTABegin(pkt); break;
        case CONDUYT_CMD_OTA_CHUNK:       handleOTAChunk(pkt); break;
        case CONDUYT_CMD_OTA_FINALIZE:    handleOTAFinalize(pkt); break;
        default:
            sendNak(pkt.seq, CONDUYT_ERR_UNKNOWN_TYPE);
            break;
    }
}

/* ── Command Handlers ─────────────────────────────────── */

void ConduytDevice::handlePing(const ConduytPacket &pkt) {
    sendPacket(CONDUYT_EVT_PONG, pkt.seq, nullptr, 0);
}

void ConduytDevice::handleHello(const ConduytPacket &pkt) {
    sendPacket(CONDUYT_EVT_HELLO_RESP, pkt.seq, _helloBuf, _helloLen);
}

void ConduytDevice::handlePinMode(const ConduytPacket &pkt) {
#ifdef ARDUINO
    if (pkt.payload_len < 2) { sendNak(pkt.seq, CONDUYT_ERR_INVALID_PIN); return; }
    ConduytPayloadReader r(pkt.payload, pkt.payload_len);
    uint8_t pin = r.readUInt8();
    uint8_t mode = r.readUInt8();

    switch (mode) {
        case CONDUYT_PIN_MODE_INPUT:        pinMode(pin, INPUT); break;
        case CONDUYT_PIN_MODE_OUTPUT:       pinMode(pin, OUTPUT); break;
        case CONDUYT_PIN_MODE_INPUT_PULLUP: pinMode(pin, INPUT_PULLUP); break;
        case CONDUYT_PIN_MODE_PWM:          pinMode(pin, OUTPUT); break;
        case CONDUYT_PIN_MODE_ANALOG:       /* No pinMode needed for analog input */ break;
        default:
            sendNak(pkt.seq, CONDUYT_ERR_PIN_MODE_UNSUPPORTED);
            return;
    }
    sendAck(pkt.seq);
#else
    sendAck(pkt.seq);
#endif
}

void ConduytDevice::handlePinWrite(const ConduytPacket &pkt) {
#ifdef ARDUINO
    if (pkt.payload_len < 2) { sendNak(pkt.seq, CONDUYT_ERR_INVALID_PIN); return; }
    ConduytPayloadReader r(pkt.payload, pkt.payload_len);
    uint8_t pin = r.readUInt8();
    uint8_t value = r.readUInt8();

    /* If payload has a 3rd byte with mode hint, use it */
    if (pkt.payload_len >= 3) {
        uint8_t mode = r.readUInt8();
        if (mode == CONDUYT_PIN_MODE_PWM) {
            analogWrite(pin, value);
        } else {
            digitalWrite(pin, value ? HIGH : LOW);
        }
    } else {
        /* Default: digital write for 0/1, PWM for other values */
        if (value <= 1) {
            digitalWrite(pin, value ? HIGH : LOW);
        } else {
            analogWrite(pin, value);
        }
    }
    sendAck(pkt.seq);
#else
    sendAck(pkt.seq);
#endif
}

void ConduytDevice::handlePinRead(const ConduytPacket &pkt) {
#ifdef ARDUINO
    if (pkt.payload_len < 1) { sendNak(pkt.seq, CONDUYT_ERR_INVALID_PIN); return; }
    ConduytPayloadReader r(pkt.payload, pkt.payload_len);
    uint8_t pin = r.readUInt8();
    uint8_t mode = (pkt.payload_len >= 2) ? r.readUInt8() : CONDUYT_PIN_MODE_INPUT;

    uint8_t respBuf[4];
    ConduytPayloadWriter w(respBuf, sizeof(respBuf));
    w.writeUInt8(pin);

    if (mode == CONDUYT_PIN_MODE_ANALOG) {
        w.writeUInt16((uint16_t)analogRead(pin));
    } else {
        w.writeUInt16(digitalRead(pin) ? 1 : 0);
    }

    sendPacket(CONDUYT_EVT_PIN_READ_RESP, pkt.seq, respBuf, w.length());
#else
    uint8_t respBuf[3] = {0, 0, 0};
    sendPacket(CONDUYT_EVT_PIN_READ_RESP, pkt.seq, respBuf, 3);
#endif
}

void ConduytDevice::handlePinSubscribe(const ConduytPacket &pkt) {
    if (pkt.payload_len < 5) { sendNak(pkt.seq, CONDUYT_ERR_INVALID_PIN); return; }

    ConduytPayloadReader r(pkt.payload, pkt.payload_len);
    uint8_t pin = r.readUInt8();
    uint8_t mode = r.readUInt8();
    uint16_t intervalMs = r.readUInt16();
    uint16_t threshold = (pkt.payload_len >= 7) ? r.readUInt16() : 0;

    /* Check for existing subscription on this pin and update in place */
    for (uint8_t i = 0; i < _subCount; i++) {
        if (_subs[i].pin == pin && _subs[i].active) {
            _subs[i].mode = mode;
            _subs[i].intervalMs = intervalMs ? intervalMs : 100;
            _subs[i].threshold = threshold;
            _subs[i].lastValue = 0;
            _subs[i].lastReportMs = millis();
            sendAck(pkt.seq);
            return;
        }
    }

    if (_subCount >= CONDUYT_MAX_SUBSCRIPTIONS) {
        sendNak(pkt.seq, CONDUYT_ERR_SUB_LIMIT_REACHED);
        return;
    }

    ConduytSubscriptionEntry &sub = _subs[_subCount];
    sub.pin = pin;
    sub.mode = mode;
    sub.intervalMs = intervalMs ? intervalMs : 100;
    sub.threshold = threshold;
    sub.lastValue = 0;
    sub.lastReportMs = millis();
    sub.active = true;
    _subCount++;

    sendAck(pkt.seq);
}

void ConduytDevice::handlePinUnsubscribe(const ConduytPacket &pkt) {
    if (pkt.payload_len < 1) { sendNak(pkt.seq, CONDUYT_ERR_INVALID_PIN); return; }
    uint8_t pin = pkt.payload[0];

    for (uint8_t i = 0; i < _subCount; i++) {
        if (_subs[i].pin == pin && _subs[i].active) {
            _subs[i].active = false;
            sendAck(pkt.seq);
            return;
        }
    }
    sendNak(pkt.seq, CONDUYT_ERR_INVALID_PIN);
}

void ConduytDevice::handleModCmd(const ConduytPacket &pkt) {
    if (pkt.payload_len < 2) { sendNak(pkt.seq, CONDUYT_ERR_MODULE_NOT_LOADED); return; }

    uint8_t moduleId = pkt.payload[0];
    uint8_t cmd = pkt.payload[1];

    if (moduleId >= _moduleCount || !_modules[moduleId]) {
        sendNak(pkt.seq, CONDUYT_ERR_MODULE_NOT_LOADED);
        return;
    }

    ConduytPayloadReader payload(pkt.payload + 2, pkt.payload_len - 2);
    ConduytContext ctx(*this, pkt.seq);
    _modules[moduleId]->handle(cmd, payload, ctx);

    /* Auto-ack if module didn't respond */
    if (!ctx.responded()) {
        sendAck(pkt.seq);
    }
}

void ConduytDevice::handleDsWrite(const ConduytPacket &pkt) {
    if (pkt.payload_len < 2) { sendNak(pkt.seq, CONDUYT_ERR_UNKNOWN_DATASTREAM); return; }

    uint8_t dsIndex = pkt.payload[0];
    if (dsIndex >= _dsCount) {
        sendNak(pkt.seq, CONDUYT_ERR_UNKNOWN_DATASTREAM);
        return;
    }

    ConduytDatastreamEntry &ds = _datastreams[dsIndex];
    if (!ds.writable) {
        sendNak(pkt.seq, CONDUYT_ERR_DATASTREAM_READONLY);
        return;
    }

    ConduytPayloadReader payload(pkt.payload + 1, pkt.payload_len - 1);
    ConduytContext ctx(*this, pkt.seq);

    if (ds.onWrite) {
        ds.onWrite(payload, ctx);
    }

    if (!ctx.responded()) {
        sendAck(pkt.seq);
    }
}

void ConduytDevice::handleDsRead(const ConduytPacket &pkt) {
    /* For now, NAK — full implementation requires storing last values */
    sendNak(pkt.seq, CONDUYT_ERR_UNKNOWN_DATASTREAM);
}

void ConduytDevice::handleDsSubscribe(const ConduytPacket &pkt) {
    /* Datastream subscriptions are handled similarly to pin subscriptions */
    sendAck(pkt.seq);
}

void ConduytDevice::handleReset(const ConduytPacket &pkt) {
    /* Clear all subscriptions */
    for (uint8_t i = 0; i < _subCount; i++) {
        _subs[i].active = false;
    }
    _subCount = 0;
    _rxLen = 0;
    sendAck(pkt.seq);
}

/* ── I2C Handlers ─────────────────────────────────────── */

void ConduytDevice::handleI2CWrite(const ConduytPacket &pkt) {
#ifdef ARDUINO
    if (pkt.payload_len < 2) { sendNak(pkt.seq, CONDUYT_ERR_I2C_NOT_AVAILABLE); return; }
    ConduytPayloadReader r(pkt.payload, pkt.payload_len);
    uint8_t addr = r.readUInt8();
    if (addr < 0x08 || addr > 0x77) { sendNak(pkt.seq, CONDUYT_ERR_I2C_NOT_AVAILABLE); return; }
    size_t dataLen = pkt.payload_len - 1;

    Wire.beginTransmission(addr);
    for (size_t i = 0; i < dataLen; i++) {
        Wire.write(r.readUInt8());
    }
    uint8_t result = Wire.endTransmission();
    if (result == 0) {
        sendAck(pkt.seq);
    } else {
        sendNak(pkt.seq, CONDUYT_ERR_I2C_NACK);
    }
#else
    sendAck(pkt.seq);
#endif
}

void ConduytDevice::handleI2CRead(const ConduytPacket &pkt) {
#ifdef ARDUINO
    if (pkt.payload_len < 2) { sendNak(pkt.seq, CONDUYT_ERR_I2C_NOT_AVAILABLE); return; }
    ConduytPayloadReader r(pkt.payload, pkt.payload_len);
    uint8_t addr = r.readUInt8();
    if (addr < 0x08 || addr > 0x77) { sendNak(pkt.seq, CONDUYT_ERR_I2C_NOT_AVAILABLE); return; }
    uint8_t count = r.readUInt8();

    uint8_t respBuf[CONDUYT_PACKET_BUF_SIZE];
    ConduytPayloadWriter w(respBuf, sizeof(respBuf));

    uint8_t received = Wire.requestFrom(addr, count);
    for (uint8_t i = 0; i < received; i++) {
        w.writeUInt8(Wire.read());
    }
    sendPacket(CONDUYT_EVT_I2C_READ_RESP, pkt.seq, respBuf, w.length());
#else
    sendPacket(CONDUYT_EVT_I2C_READ_RESP, pkt.seq, nullptr, 0);
#endif
}

void ConduytDevice::handleI2CReadReg(const ConduytPacket &pkt) {
#ifdef ARDUINO
    if (pkt.payload_len < 3) { sendNak(pkt.seq, CONDUYT_ERR_I2C_NOT_AVAILABLE); return; }
    ConduytPayloadReader r(pkt.payload, pkt.payload_len);
    uint8_t addr = r.readUInt8();
    if (addr < 0x08 || addr > 0x77) { sendNak(pkt.seq, CONDUYT_ERR_I2C_NOT_AVAILABLE); return; }
    uint8_t reg = r.readUInt8();
    uint8_t count = r.readUInt8();

    Wire.beginTransmission(addr);
    Wire.write(reg);
    uint8_t result = Wire.endTransmission(false);
    if (result != 0) {
        sendNak(pkt.seq, CONDUYT_ERR_I2C_NACK);
        return;
    }

    uint8_t respBuf[CONDUYT_PACKET_BUF_SIZE];
    ConduytPayloadWriter w(respBuf, sizeof(respBuf));

    uint8_t received = Wire.requestFrom(addr, count);
    for (uint8_t i = 0; i < received; i++) {
        w.writeUInt8(Wire.read());
    }
    sendPacket(CONDUYT_EVT_I2C_READ_RESP, pkt.seq, respBuf, w.length());
#else
    sendPacket(CONDUYT_EVT_I2C_READ_RESP, pkt.seq, nullptr, 0);
#endif
}

/* ── SPI Handler ──────────────────────────────────────── */

void ConduytDevice::handleSPIXfer(const ConduytPacket &pkt) {
#ifdef ARDUINO
    if (pkt.payload_len < 2) { sendNak(pkt.seq, CONDUYT_ERR_UNKNOWN_TYPE); return; }
    ConduytPayloadReader r(pkt.payload, pkt.payload_len);
    uint8_t csPin = r.readUInt8();
    size_t dataLen = pkt.payload_len - 1;

    uint8_t respBuf[CONDUYT_PACKET_BUF_SIZE];
    ConduytPayloadWriter w(respBuf, sizeof(respBuf));

    SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
    digitalWrite(csPin, LOW);
    for (size_t i = 0; i < dataLen; i++) {
        w.writeUInt8(SPI.transfer(r.readUInt8()));
    }
    digitalWrite(csPin, HIGH);
    SPI.endTransaction();

    sendPacket(CONDUYT_EVT_SPI_XFER_RESP, pkt.seq, respBuf, w.length());
#else
    sendPacket(CONDUYT_EVT_SPI_XFER_RESP, pkt.seq, nullptr, 0);
#endif
}

/* ── Stream Handlers ──────────────────────────────────── */

void ConduytDevice::handleStreamStart(const ConduytPacket &pkt) {
    if (pkt.payload_len < 5) { sendNak(pkt.seq, CONDUYT_ERR_INVALID_PIN); return; }
    ConduytPayloadReader r(pkt.payload, pkt.payload_len);
    _streamPinMask = r.readUInt16();
    _streamRateHz = r.readUInt16();
    _streamActive = true;
    _streamIntervalUs = (_streamRateHz > 0) ? (1000000UL / _streamRateHz) : 10000;
    _streamLastUs = 0;
    sendAck(pkt.seq);
}

void ConduytDevice::handleStreamStop(const ConduytPacket &pkt) {
    _streamActive = false;
    _streamPinMask = 0;
    sendAck(pkt.seq);
}

/* ── OTA Handlers ─────────────────────────────────────── */

void ConduytDevice::handleOTABegin(const ConduytPacket &pkt) {
#ifdef CONDUYT_OTA
    ConduytPayloadReader r(pkt.payload, pkt.payload_len);
    ConduytContext ctx(*this, pkt.seq);
    _ota.handleBegin(r, ctx);
#else
    sendNak(pkt.seq, CONDUYT_ERR_OTA_INVALID);
#endif
}

void ConduytDevice::handleOTAChunk(const ConduytPacket &pkt) {
#ifdef CONDUYT_OTA
    ConduytPayloadReader r(pkt.payload, pkt.payload_len);
    ConduytContext ctx(*this, pkt.seq);
    _ota.handleChunk(r, ctx);
#else
    sendNak(pkt.seq, CONDUYT_ERR_OTA_INVALID);
#endif
}

void ConduytDevice::handleOTAFinalize(const ConduytPacket &pkt) {
#ifdef CONDUYT_OTA
    ConduytContext ctx(*this, pkt.seq);
    _ota.handleFinalize(ctx);
#else
    sendNak(pkt.seq, CONDUYT_ERR_OTA_INVALID);
#endif
}

/* ── Streaming ────────────────────────────────────────── */

void ConduytDevice::processStreaming() {
#ifdef ARDUINO
    uint32_t now = micros();
    if (now - _streamLastUs < _streamIntervalUs) return;
    _streamLastUs = now;

    uint8_t buf[CONDUYT_PACKET_BUF_SIZE];
    ConduytPayloadWriter w(buf, sizeof(buf));

    for (uint8_t p = 0; p < 16; p++) {
        if (_streamPinMask & (1 << p)) {
            w.writeUInt16((uint16_t)analogRead(p));
        }
    }
    if (w.length() > 0) {
        sendPacket(CONDUYT_EVT_STREAM_DATA, 0, buf, w.length());
    }
#endif
}

/* ── Subscriptions ────────────────────────────────────── */

void ConduytDevice::processSubscriptions() {
#ifdef ARDUINO
    uint32_t now = millis();

    for (uint8_t i = 0; i < _subCount; i++) {
        ConduytSubscriptionEntry &sub = _subs[i];
        if (!sub.active) continue;

        if (sub.mode == CONDUYT_SUB_ANALOG_POLL) {
            if (now - sub.lastReportMs >= sub.intervalMs) {
                uint16_t value = (uint16_t)analogRead(sub.pin);
                uint16_t delta = (value > sub.lastValue)
                    ? (value - sub.lastValue)
                    : (sub.lastValue - value);

                if (delta >= sub.threshold) {
                    uint8_t buf[3];
                    ConduytPayloadWriter w(buf, sizeof(buf));
                    w.writeUInt8(sub.pin);
                    w.writeUInt16(value);
                    sendPacket(CONDUYT_EVT_PIN_EVENT, 0, buf, w.length());
                    sub.lastValue = value;
                }
                sub.lastReportMs = now;
            }
        }
        /* Digital interrupt modes are handled via ISR (future step) */
    }
#endif
}

/* ── Datastream Writes (device → host) ────────────────── */

void ConduytDevice::writeDatastream(const char *name, float value) {
    int8_t idx = findDatastream(name);
    if (idx < 0) return;
    uint8_t buf[5];
    ConduytPayloadWriter w(buf, sizeof(buf));
    w.writeUInt8((uint8_t)idx);
    w.writeFloat32(value);
    sendPacket(CONDUYT_EVT_DS_EVENT, 0, buf, w.length());
}

void ConduytDevice::writeDatastream(const char *name, int32_t value) {
    int8_t idx = findDatastream(name);
    if (idx < 0) return;
    uint8_t buf[5];
    ConduytPayloadWriter w(buf, sizeof(buf));
    w.writeUInt8((uint8_t)idx);
    w.writeInt32(value);
    sendPacket(CONDUYT_EVT_DS_EVENT, 0, buf, w.length());
}

void ConduytDevice::writeDatastream(const char *name, bool value) {
    int8_t idx = findDatastream(name);
    if (idx < 0) return;
    uint8_t buf[2];
    ConduytPayloadWriter w(buf, sizeof(buf));
    w.writeUInt8((uint8_t)idx);
    w.writeBool(value);
    sendPacket(CONDUYT_EVT_DS_EVENT, 0, buf, w.length());
}

void ConduytDevice::writeDatastream(const char *name, const uint8_t *data, size_t len) {
    int8_t idx = findDatastream(name);
    if (idx < 0) return;
    uint8_t buf[CONDUYT_PACKET_BUF_SIZE];
    if (1 + len > sizeof(buf)) return;
    ConduytPayloadWriter w(buf, sizeof(buf));
    w.writeUInt8((uint8_t)idx);
    w.writeBytes(data, len);
    sendPacket(CONDUYT_EVT_DS_EVENT, 0, buf, w.length());
}

/* ── HELLO_RESP Builder ───────────────────────────────── */

void ConduytDevice::buildHelloResp() {
    ConduytPayloadWriter w(_helloBuf, sizeof(_helloBuf));

    /* firmware_name: 16 bytes null-padded */
    w.writeString(_name, CONDUYT_FIRMWARE_NAME_LEN);

    /* firmware_version: 3 bytes */
    w.writeUInt8(_verMajor);
    w.writeUInt8(_verMinor);
    w.writeUInt8(_verPatch);

    /* mcu_id: 8 bytes (zeros for now — platform-specific) */
    uint8_t mcuId[CONDUYT_MCU_ID_LEN] = {0};
    w.writeBytes(mcuId, CONDUYT_MCU_ID_LEN);

    /* ota_capable: 1 byte */
    w.writeUInt8(0x00); /* TODO: detect OTA capability */

    /* pin_count + per-pin capability bitmask */
#ifdef ARDUINO
    #ifdef NUM_DIGITAL_PINS
        uint8_t pinCount = NUM_DIGITAL_PINS;
    #else
        uint8_t pinCount = 20;
    #endif
#else
    uint8_t pinCount = 20; /* desktop stub */
#endif
    w.writeUInt8(pinCount);

    for (uint8_t p = 0; p < pinCount; p++) {
        uint8_t caps = CONDUYT_PIN_CAP_DIGITAL_IN | CONDUYT_PIN_CAP_DIGITAL_OUT;
        /* Mark analog-capable pins */
#ifdef ARDUINO
    #ifdef NUM_ANALOG_INPUTS
        #ifdef A0
            if (p >= A0 && p < A0 + NUM_ANALOG_INPUTS) {
                caps |= CONDUYT_PIN_CAP_ANALOG_IN;
            }
        #endif
    #endif
    /* Mark PWM-capable pins */
    #if defined(digitalPinHasPWM)
            if (digitalPinHasPWM(p)) caps |= CONDUYT_PIN_CAP_PWM_OUT;
    #endif
    /* Mark interrupt-capable pins */
    #if defined(digitalPinToInterrupt)
            if (digitalPinToInterrupt(p) != NOT_AN_INTERRUPT) caps |= CONDUYT_PIN_CAP_INTERRUPT;
    #endif
#endif
        w.writeUInt8(caps);
    }

    /* i2c_buses */
#ifdef WIRE_INTERFACES_COUNT
    w.writeUInt8(WIRE_INTERFACES_COUNT);
#else
    w.writeUInt8(1); /* most boards have at least one I2C bus */
#endif

    /* spi_buses */
    w.writeUInt8(1);

    /* uart_count */
#ifdef SERIAL_PORT_HARDWARE_OPEN
    w.writeUInt8(2);
#else
    w.writeUInt8(1);
#endif

    /* max_payload: uint16 */
    w.writeUInt16(CONDUYT_PACKET_BUF_SIZE);

    /* module_count + per-module descriptors */
    w.writeUInt8(_moduleCount);
    for (uint8_t i = 0; i < _moduleCount; i++) {
        ConduytModuleBase *mod = _modules[i];
        if (!mod) continue;

        w.writeUInt8(i); /* module_id */
        w.writeString(mod->name(), CONDUYT_MODULE_NAME_LEN);
        w.writeUInt8(mod->versionMajor());
        w.writeUInt8(mod->versionMinor());
        w.writeUInt8(mod->pinCount());
        const uint8_t *modPins = mod->pins();
        for (uint8_t p = 0; p < mod->pinCount(); p++) {
            w.writeUInt8(modPins ? modPins[p] : 0);
        }
    }

    /* datastream_count + per-datastream descriptors */
    w.writeUInt8(_dsCount);
    for (uint8_t i = 0; i < _dsCount; i++) {
        ConduytDatastreamEntry &ds = _datastreams[i];
        w.writeString(ds.name, CONDUYT_DS_NAME_LEN);
        w.writeUInt8(ds.type);
        w.writeString(ds.unit, CONDUYT_DS_UNIT_LEN);
        w.writeUInt8(ds.writable);
        w.writeUInt8(ds.pinRef);
        w.writeUInt8(ds.retain);
    }

    _helloLen = w.length();
}

/* ── ConduytContext Implementation ──────────────────────── */

void ConduytContext::ack() {
    if (!_responded) {
        _device.sendAck(_seq);
        _responded = true;
    }
}

void ConduytContext::nak(uint8_t errorCode) {
    if (!_responded) {
        _device.sendNak(_seq, errorCode);
        _responded = true;
    }
}

void ConduytContext::emitModEvent(uint8_t moduleId, uint8_t eventCode,
                                const uint8_t *data, size_t len)
{
    uint8_t buf[CONDUYT_PACKET_BUF_SIZE];
    if (2 + len > sizeof(buf)) return;
    ConduytPayloadWriter w(buf, sizeof(buf));
    w.writeUInt8(moduleId);
    w.writeUInt8(eventCode);
    if (data && len > 0) w.writeBytes(data, len);
    _device.sendPacket(CONDUYT_EVT_MOD_EVENT, 0, buf, w.length());
}

void ConduytContext::emitDsEvent(uint8_t dsIndex, const uint8_t *data, size_t len) {
    uint8_t buf[CONDUYT_PACKET_BUF_SIZE];
    if (1 + len > sizeof(buf)) return;
    ConduytPayloadWriter w(buf, sizeof(buf));
    w.writeUInt8(dsIndex);
    if (data && len > 0) w.writeBytes(data, len);
    _device.sendPacket(CONDUYT_EVT_DS_EVENT, 0, buf, w.length());
}

void ConduytContext::sendModResp(uint8_t moduleId, const uint8_t *data, size_t len) {
    uint8_t buf[CONDUYT_PACKET_BUF_SIZE];
    if (1 + len > sizeof(buf)) return;
    ConduytPayloadWriter w(buf, sizeof(buf));
    w.writeUInt8(moduleId);
    if (data && len > 0) w.writeBytes(data, len);
    _device.sendPacket(CONDUYT_EVT_MOD_RESP, _seq, buf, w.length());
    _responded = true;
}

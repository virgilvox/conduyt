/**
 * CONDUYT Payload Reader/Writer
 *
 * Binary reader and writer for packet payloads.
 * Supports all CONDUYT data types (BOOL through BYTES).
 * Little-endian throughout, matching the wire format.
 */

#ifndef CONDUYT_PAYLOAD_H
#define CONDUYT_PAYLOAD_H

#include <stdint.h>
#include <stddef.h>
#include <string.h>

class ConduytPayloadReader {
public:
    ConduytPayloadReader(const uint8_t *data, size_t len)
        : _data(data), _len(len), _pos(0) {}

    size_t remaining() const { return _len - _pos; }
    size_t position() const { return _pos; }
    void reset() { _pos = 0; }

    bool readBool() {
        return readUInt8() != 0;
    }

    uint8_t readUInt8() {
        if (_pos >= _len) return 0;
        return _data[_pos++];
    }

    int8_t readInt8() {
        return (int8_t)readUInt8();
    }

    uint16_t readUInt16() {
        if (_pos + 2 > _len) return 0;
        uint16_t val = (uint16_t)_data[_pos] | ((uint16_t)_data[_pos + 1] << 8);
        _pos += 2;
        return val;
    }

    int16_t readInt16() {
        return (int16_t)readUInt16();
    }

    uint32_t readUInt32() {
        if (_pos + 4 > _len) return 0;
        uint32_t val = (uint32_t)_data[_pos]
                     | ((uint32_t)_data[_pos + 1] << 8)
                     | ((uint32_t)_data[_pos + 2] << 16)
                     | ((uint32_t)_data[_pos + 3] << 24);
        _pos += 4;
        return val;
    }

    int32_t readInt32() {
        return (int32_t)readUInt32();
    }

    float readFloat32() {
        uint32_t bits = readUInt32();
        float val;
        memcpy(&val, &bits, sizeof(float));
        return val;
    }

    /**
     * Read raw bytes into a buffer.
     * @return Number of bytes actually read
     */
    size_t readBytes(uint8_t *dst, size_t count) {
        size_t avail = remaining();
        size_t n = (count < avail) ? count : avail;
        if (n > 0) {
            memcpy(dst, &_data[_pos], n);
            _pos += n;
        }
        return n;
    }

    const uint8_t *data() const { return _data; }
    size_t length() const { return _len; }

private:
    const uint8_t *_data;
    size_t _len;
    size_t _pos;
};

class ConduytPayloadWriter {
public:
    ConduytPayloadWriter(uint8_t *buf, size_t capacity)
        : _buf(buf), _cap(capacity), _pos(0) {}

    size_t length() const { return _pos; }
    size_t remaining() const { return _cap - _pos; }
    const uint8_t *data() const { return _buf; }
    void reset() { _pos = 0; }

    bool writeBool(bool val) {
        return writeUInt8(val ? 1 : 0);
    }

    bool writeUInt8(uint8_t val) {
        if (_pos >= _cap) return false;
        _buf[_pos++] = val;
        return true;
    }

    bool writeInt8(int8_t val) {
        return writeUInt8((uint8_t)val);
    }

    bool writeUInt16(uint16_t val) {
        if (_pos + 2 > _cap) return false;
        _buf[_pos++] = (uint8_t)(val & 0xFF);
        _buf[_pos++] = (uint8_t)((val >> 8) & 0xFF);
        return true;
    }

    bool writeInt16(int16_t val) {
        return writeUInt16((uint16_t)val);
    }

    bool writeUInt32(uint32_t val) {
        if (_pos + 4 > _cap) return false;
        _buf[_pos++] = (uint8_t)(val & 0xFF);
        _buf[_pos++] = (uint8_t)((val >> 8) & 0xFF);
        _buf[_pos++] = (uint8_t)((val >> 16) & 0xFF);
        _buf[_pos++] = (uint8_t)((val >> 24) & 0xFF);
        return true;
    }

    bool writeInt32(int32_t val) {
        return writeUInt32((uint32_t)val);
    }

    bool writeFloat32(float val) {
        uint32_t bits;
        memcpy(&bits, &val, sizeof(float));
        return writeUInt32(bits);
    }

    bool writeBytes(const uint8_t *src, size_t count) {
        if (_pos + count > _cap) return false;
        memcpy(&_buf[_pos], src, count);
        _pos += count;
        return true;
    }

    /**
     * Write a null-padded string of exactly `fieldLen` bytes.
     */
    bool writeString(const char *str, size_t fieldLen) {
        if (_pos + fieldLen > _cap) return false;
        size_t slen = strlen(str);
        size_t copyLen = (slen < fieldLen) ? slen : fieldLen;
        memcpy(&_buf[_pos], str, copyLen);
        if (copyLen < fieldLen) {
            memset(&_buf[_pos + copyLen], 0, fieldLen - copyLen);
        }
        _pos += fieldLen;
        return true;
    }

private:
    uint8_t *_buf;
    size_t _cap;
    size_t _pos;
};

#endif /* CONDUYT_PAYLOAD_H */

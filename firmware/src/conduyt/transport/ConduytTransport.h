/**
 * CONDUYT Transport — Abstract Interface
 *
 * All transport adapters implement this interface.
 * The protocol layer is transport-agnostic — it calls write/read/connected
 * without knowing whether bytes travel over serial, BLE, MQTT, or CLASP.
 */

#ifndef CONDUYT_TRANSPORT_H
#define CONDUYT_TRANSPORT_H

#include <stdint.h>
#include <stddef.h>

class ConduytTransport {
public:
    virtual ~ConduytTransport() {}

    /**
     * Initialize the transport. Called once from ConduytDevice::begin().
     * @return true if initialization succeeded
     */
    virtual bool begin() = 0;

    /**
     * @return true if the transport is connected and ready
     */
    virtual bool connected() = 0;

    /**
     * Write raw bytes to the transport.
     * For serial/BLE: COBS-encoded packet + 0x00 delimiter.
     * For MQTT/TCP: raw packet bytes (COBS optional).
     *
     * @param buf  Bytes to send
     * @param len  Number of bytes
     * @return Number of bytes actually written
     */
    virtual size_t write(const uint8_t *buf, size_t len) = 0;

    /**
     * @return Number of bytes available to read
     */
    virtual int available() = 0;

    /**
     * Read bytes from the transport.
     * @param buf     Buffer to read into
     * @param maxLen  Maximum bytes to read
     * @return Number of bytes actually read
     */
    virtual int read(uint8_t *buf, size_t maxLen) = 0;

    /**
     * Flush any buffered output.
     */
    virtual void flush() {}

    /**
     * @return true if this transport requires COBS framing (serial, BLE)
     *         false if the transport provides its own framing (MQTT, TCP, WebSocket)
     */
    virtual bool needsCOBS() { return true; }

    /**
     * Called periodically from ConduytDevice::poll() to allow the transport
     * to do its own housekeeping (MQTT loop, BLE notifications, etc.)
     */
    virtual void poll() {}
};

#endif /* CONDUYT_TRANSPORT_H */

/**
 * CONDUYT Context
 *
 * Passed to module handlers and datastream callbacks.
 * Provides methods to respond (ack, nak, emit events).
 */

#ifndef CONDUYT_CONTEXT_H
#define CONDUYT_CONTEXT_H

#include <stdint.h>
#include <stddef.h>

/* Forward declaration */
class ConduytDevice;

class ConduytContext {
public:
    ConduytContext(ConduytDevice &device, uint8_t seq)
        : _device(device), _seq(seq), _responded(false) {}

    /** Acknowledge the current command. */
    void ack();

    /** Reject the current command with an error code. */
    void nak(uint8_t errorCode);

    /** Emit an unsolicited event from a module. */
    void emitModEvent(uint8_t moduleId, uint8_t eventCode,
                      const uint8_t *data, size_t len);

    /** Emit a datastream event. */
    void emitDsEvent(uint8_t dsIndex, const uint8_t *data, size_t len);

    /** Send a module response (data returned from MOD_CMD). */
    void sendModResp(uint8_t moduleId, const uint8_t *data, size_t len);

    uint8_t seq() const { return _seq; }
    bool responded() const { return _responded; }

private:
    ConduytDevice &_device;
    uint8_t _seq;
    bool _responded;
};

#endif /* CONDUYT_CONTEXT_H */

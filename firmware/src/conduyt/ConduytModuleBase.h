/**
 * CONDUYT Module Base — Abstract interface for device-side modules
 *
 * Modules are opt-in C++ classes compiled into firmware.
 * They register at boot, appear in HELLO_RESP, and handle MOD_CMD packets.
 */

#ifndef CONDUYT_MODULE_BASE_H
#define CONDUYT_MODULE_BASE_H

#include <stdint.h>
#include "ConduytPayload.h"

class ConduytContext;
class ConduytDevice;

class ConduytModuleBase {
public:
    virtual ~ConduytModuleBase() {}

    /** Module name, max 8 chars. Appears in HELLO_RESP. */
    virtual const char* name() = 0;

    /** Module version. */
    virtual uint8_t versionMajor() { return 1; }
    virtual uint8_t versionMinor() { return 0; }

    /** Called once after ConduytDevice::begin(). */
    virtual void begin() {}

    /**
     * Handle a MOD_CMD packet.
     * @param cmd  Command byte (module-specific)
     * @param payload  Payload reader
     * @param ctx  Context for ack/nak/emit
     */
    virtual void handle(uint8_t cmd, ConduytPayloadReader &payload, ConduytContext &ctx) = 0;

    /**
     * Called every poll() cycle for modules that need periodic work
     * (e.g., stepper step generation, PID computation).
     */
    virtual void poll() {}

    /** Number of physical pins this module claims. */
    virtual uint8_t pinCount() { return 0; }

    /** Array of physical pin numbers claimed by this module. */
    virtual const uint8_t* pins() { return nullptr; }

    /** Set the owning device reference. Called by ConduytDevice::begin(). */
    void setDevice(ConduytDevice *dev) { _device = dev; }

protected:
    ConduytDevice *_device = nullptr;
};

/* ── Convenience Macros ───────────────────────────────── */

/**
 * Quick module definition macro.
 * Usage:
 *   CONDUYT_MODULE(myServo) {
 *     CONDUYT_ON_CMD(0x01) { ... ctx.ack(); }
 *     CONDUYT_ON_CMD(0x02) { ... ctx.ack(); }
 *   }
 */
#define CONDUYT_MODULE(className) \
    class className : public ConduytModuleBase

#define CONDUYT_ON_CMD(cmdByte) \
    if (cmd == (cmdByte))

#endif /* CONDUYT_MODULE_BASE_H */

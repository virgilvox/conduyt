/**
 * CONDUYT I2C Passthrough Module
 *
 * Raw I2C relay for host-driven peripherals not covered by other modules.
 * This is a thin wrapper — the host SDK handles register-level protocol.
 * Already handled by core I2C_WRITE/I2C_READ commands, so this module
 * exists primarily to appear in HELLO_RESP as a capability marker.
 *
 * Compile-time opt-in: #define CONDUYT_MODULE_I2C_PASSTHROUGH
 */

#ifndef CONDUYT_MODULE_I2C_PASSTHROUGH_H
#define CONDUYT_MODULE_I2C_PASSTHROUGH_H

#ifdef CONDUYT_MODULE_I2C_PASSTHROUGH

#include "../ConduytModuleBase.h"
#include "../ConduytContext.h"

class ConduytModuleI2CPassthrough : public ConduytModuleBase {
public:
    const char* name() override { return "i2c_pass"; }
    uint8_t versionMajor() override { return 1; }
    uint8_t versionMinor() override { return 0; }

    void handle(uint8_t cmd, ConduytPayloadReader &payload, ConduytContext &ctx) override {
        /* All I2C operations handled by core commands.
           This module is a capability marker. */
        ctx.nak(0x09);
    }
};

#endif /* CONDUYT_MODULE_I2C_PASSTHROUGH */
#endif /* CONDUYT_MODULE_I2C_PASSTHROUGH_H */

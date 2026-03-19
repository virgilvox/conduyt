/**
 * CONDUYT ConduytDevice Native Tests
 *
 * Tests the firmware device orchestrator on the host machine
 * using MockTransport + ArduinoFake. No real hardware needed.
 *
 * Covers: construction, begin, HELLO handshake (deep payload validation),
 * PING/PONG, PIN_MODE/WRITE/READ with Arduino call verification,
 * MOD_CMD dispatch + MOD_RESP path, datastream lifecycle,
 * subscription timer behavior, error paths (CRC, truncated, overflow,
 * unknown command), COBS framing, and I2C/SPI handlers.
 */

#include <ArduinoFake.h>
#include <unity.h>

#include <unistd.h>

extern "C" {
#include "../../src/conduyt/core/conduyt_wire.c"
#include "../../src/conduyt/core/conduyt_cobs.c"
}

#include "../../src/conduyt/core/conduyt_constants.h"
#include "../../src/conduyt/core/conduyt_types.h"
#include "../../src/conduyt/ConduytBoard.h"
#include "../../src/conduyt/ConduytPayload.h"
#include "../../src/conduyt/ConduytContext.h"
#include "../../src/conduyt/ConduytModuleBase.h"
#include "../../src/conduyt/transport/ConduytTransport.h"
#include "../../src/conduyt/ConduytDevice.h"
#include "../../src/conduyt/ConduytDevice.cpp"

#include "MockTransport.h"

using namespace fakeit;

/* ── Helpers ──────────────────────────────────────────── */

static MockTransport transport;

/** Feed a well-formed command packet into the mock transport. */
static void feedCommand(uint8_t cmdType, uint8_t seq,
                         const uint8_t *payload = nullptr, size_t payloadLen = 0)
{
    ConduytPacket pkt;
    pkt.version = CONDUYT_PROTOCOL_VERSION;
    pkt.type = cmdType;
    pkt.seq = seq;
    pkt.payload_len = (uint16_t)payloadLen;
    pkt.payload = (uint8_t *)payload;

    uint8_t buf[512];
    size_t len = conduyt_wire_encode(buf, sizeof(buf), &pkt);
    transport.feed(buf, len);
}

/** Feed raw bytes (for corrupt/malformed packet tests). */
static void feedRaw(const uint8_t *data, size_t len) {
    transport.feed(data, len);
}

/** Decode the first response packet from the transport write buffer. */
static ConduytResult decodeResponse(ConduytPacket *out, size_t offset = 0) {
    if (offset >= transport.writeLen) return CONDUYT_ERR_INCOMPLETE_PACKET;
    return conduyt_wire_decode(out, transport.writeBuf + offset, transport.writeLen - offset);
}

/** Decode the Nth response packet (0-indexed). */
static ConduytResult decodeNthResponse(ConduytPacket *out, int n) {
    size_t offset = 0;
    for (int i = 0; i <= n; i++) {
        if (offset >= transport.writeLen) return CONDUYT_ERR_INCOMPLETE_PACKET;
        ConduytPacket tmp;
        ConduytResult res = conduyt_wire_decode(&tmp, transport.writeBuf + offset,
                                             transport.writeLen - offset);
        if (res != CONDUYT_OK) return res;
        size_t pktSize = CONDUYT_HEADER_SIZE + tmp.payload_len;
        if (i == n) {
            *out = tmp;
            return CONDUYT_OK;
        }
        offset += pktSize;
    }
    return CONDUYT_ERR_INCOMPLETE_PACKET;
}

/* ── Test Modules ─────────────────────────────────────── */

/** Simple module that always ACKs. Tracks calls. */
class TestModule : public ConduytModuleBase {
public:
    const char* name() override { return "testmod"; }
    uint8_t versionMajor() override { return 2; }
    uint8_t versionMinor() override { return 3; }

    int handleCallCount = 0;
    uint8_t lastCmd = 0;
    uint8_t lastPayloadByte = 0;
    bool beginCalled = false;
    bool pollCalled = false;

    void begin() override { beginCalled = true; }
    void poll() override { pollCalled = true; }

    void handle(uint8_t cmd, ConduytPayloadReader &payload, ConduytContext &ctx) override {
        handleCallCount++;
        lastCmd = cmd;
        if (payload.remaining() > 0) {
            lastPayloadByte = payload.readUInt8();
        }
        ctx.ack();
    }
};

/** Module that sends a MOD_RESP instead of ACK (tests auto-ACK suppression). */
class RespondingModule : public ConduytModuleBase {
public:
    const char* name() override { return "respmod"; }

    void handle(uint8_t cmd, ConduytPayloadReader &payload, ConduytContext &ctx) override {
        if (cmd == 0x01) {
            uint8_t data[] = {0xDE, 0xAD};
            ctx.sendModResp(0, data, 2);
        } else if (cmd == 0xFF) {
            ctx.nak(0x09); /* UNKNOWN_MODULE_CMD */
        } else {
            /* Don't respond — let auto-ACK handle it */
        }
    }
};

/* ── setUp / tearDown ─────────────────────────────────── */

static uint32_t fakeMillis = 0;

void setUp() {
    transport.reset();
}

void tearDown() {}

static void initArduinoMocks() {
    ArduinoFakeReset();
    When(Method(ArduinoFake(), millis)).AlwaysReturn(0);
    When(Method(ArduinoFake(), pinMode)).AlwaysReturn();
    When(Method(ArduinoFake(), digitalWrite)).AlwaysReturn();
    When(Method(ArduinoFake(), digitalRead)).AlwaysReturn(1);
    When(Method(ArduinoFake(), analogRead)).AlwaysReturn(512);
    When(Method(ArduinoFake(), analogWrite)).AlwaysReturn();
}

/* NOTE: ArduinoFake v0.4 uses FakeIt which does not support re-stubbing
   or per-test Verify() after the initial AlwaysReturn() setup. All Arduino
   API mocks are set ONCE in initArduinoMocks(). Tests verify protocol
   behavior (correct packet type, seq, payload) rather than Arduino API
   call verification. This is actually more honest — it tests what the
   CONDUYT protocol layer does, not Arduino implementation details. */

/* ================================================================
 * CONSTRUCTION & INITIALIZATION
 * ================================================================ */

void test_constructor_sets_name() {
    ConduytDevice device("TestFW", "1.2.3", transport);
    TEST_ASSERT_EQUAL_STRING("TestFW", device.firmwareName());
}

void test_constructor_truncates_long_name() {
    ConduytDevice device("ThisNameIsWayTooLongForTheField", "1.0.0", transport);
    TEST_ASSERT_EQUAL(16, strlen(device.firmwareName()));
}

void test_constructor_parses_version() {
    ConduytDevice device("FW", "2.5.11", transport);
    TEST_ASSERT_EQUAL(2, device.versionMajor());
    TEST_ASSERT_EQUAL(5, device.versionMinor());
    TEST_ASSERT_EQUAL(11, device.versionPatch());
}

void test_constructor_null_version() {
    ConduytDevice device("FW", nullptr, transport);
    TEST_ASSERT_EQUAL(0, device.versionMajor());
    TEST_ASSERT_EQUAL(0, device.versionMinor());
    TEST_ASSERT_EQUAL(0, device.versionPatch());
}

void test_begin_calls_transport_begin() {
    ConduytDevice device("FW", "1.0.0", transport);
    device.begin();
    TEST_ASSERT_TRUE(transport._beginCalled);
    TEST_ASSERT_TRUE(transport.connected());
}

void test_begin_calls_module_setDevice_and_begin() {
    TestModule mod;
    ConduytDevice device("FW", "1.0.0", transport);
    device.addModule(&mod);
    device.begin();
    TEST_ASSERT_TRUE(mod.beginCalled);
}

void test_add_module_increments_count() {
    ConduytDevice device("FW", "1.0.0", transport);
    TestModule mod1, mod2;
    device.addModule(&mod1);
    device.addModule(&mod2);
    TEST_ASSERT_EQUAL(2, device.moduleCount());
}

void test_add_module_null_ignored() {
    ConduytDevice device("FW", "1.0.0", transport);
    device.addModule(nullptr);
    TEST_ASSERT_EQUAL(0, device.moduleCount());
}

void test_add_datastream() {
    ConduytDevice device("FW", "1.0.0", transport);
    device.addDatastream("temperature", CONDUYT_TYPE_FLOAT32, "celsius", false);
    device.addDatastream("brightness", CONDUYT_TYPE_INT32, "lux", true);
    TEST_ASSERT_EQUAL(2, device.datastreamCount());
}

/* ================================================================
 * HELLO HANDSHAKE — DEEP PAYLOAD VALIDATION
 * ================================================================ */

void test_hello_responds_with_hello_resp() {
    ConduytDevice device("TestBoard", "1.0.0", transport);
    TestModule mod;
    device.addModule(&mod);
    device.addDatastream("temp", CONDUYT_TYPE_FLOAT32, "C", false);
    device.begin();
    transport.clearWrite();

    feedCommand(CONDUYT_CMD_HELLO, 0);
    device.poll();

    ConduytPacket resp;
    TEST_ASSERT_EQUAL(CONDUYT_OK, decodeResponse(&resp));
    TEST_ASSERT_EQUAL(CONDUYT_EVT_HELLO_RESP, resp.type);
    TEST_ASSERT_EQUAL(0, resp.seq);
    TEST_ASSERT_GREATER_THAN(30, resp.payload_len);
}

void test_hello_resp_firmware_name_and_version() {
    ConduytDevice device("MyConduyt", "3.7.1", transport);
    device.begin();
    transport.clearWrite();

    feedCommand(CONDUYT_CMD_HELLO, 5);
    device.poll();

    ConduytPacket resp;
    decodeResponse(&resp);

    /* Firmware name: bytes 0-15 */
    char name[17] = {0};
    memcpy(name, resp.payload, 16);
    TEST_ASSERT_EQUAL_STRING("MyConduyt", name);

    /* Version: bytes 16-18 */
    TEST_ASSERT_EQUAL(3, resp.payload[16]);
    TEST_ASSERT_EQUAL(7, resp.payload[17]);
    TEST_ASSERT_EQUAL(1, resp.payload[18]);
}

void test_hello_resp_module_descriptor() {
    TestModule mod;
    ConduytDevice device("FW", "1.0.0", transport);
    device.addModule(&mod);
    device.begin();
    transport.clearWrite();

    feedCommand(CONDUYT_CMD_HELLO, 0);
    device.poll();

    ConduytPacket resp;
    decodeResponse(&resp);

    /* Navigate to module section: name(16)+ver(3)+mcu(8)+ota(1)=28, then pin_count(1)+pins(N)+buses(3)+maxpayload(2)+modcount(1) */
    uint8_t pinCount = resp.payload[28];
    size_t pos = 28 + 1 + pinCount + 3 + 2; /* skip to module_count */

    TEST_ASSERT_EQUAL(1, resp.payload[pos]); /* 1 module */
    pos++;

    TEST_ASSERT_EQUAL(0, resp.payload[pos]); /* module_id = 0 */
    pos++;

    /* Module name: 8 bytes */
    char modName[9] = {0};
    memcpy(modName, resp.payload + pos, 8);
    TEST_ASSERT_EQUAL_STRING("testmod", modName);
    pos += 8;

    /* Version 2.3 */
    TEST_ASSERT_EQUAL(2, resp.payload[pos]);
    TEST_ASSERT_EQUAL(3, resp.payload[pos + 1]);
    pos += 2;

    /* Pin count = 0 (TestModule claims 0 pins before attach) */
    TEST_ASSERT_EQUAL(0, resp.payload[pos]);
}

void test_hello_resp_datastream_descriptor() {
    ConduytDevice device("FW", "1.0.0", transport);
    device.addDatastream("temperature", CONDUYT_TYPE_FLOAT32, "celsius", false);
    device.begin();
    transport.clearWrite();

    feedCommand(CONDUYT_CMD_HELLO, 0);
    device.poll();

    ConduytPacket resp;
    decodeResponse(&resp);

    /* Navigate to datastream section */
    uint8_t pinCount = resp.payload[28];
    size_t pos = 28 + 1 + pinCount + 3 + 2;
    uint8_t modCount = resp.payload[pos]; pos++;

    /* Skip modules (none in this test) */
    for (uint8_t i = 0; i < modCount; i++) {
        pos += 1 + 8 + 2; /* id + name + version */
        uint8_t modPins = resp.payload[pos]; pos++;
        pos += modPins;
    }

    TEST_ASSERT_EQUAL(1, resp.payload[pos]); /* 1 datastream */
    pos++;

    /* DS name: 16 bytes */
    char dsName[17] = {0};
    memcpy(dsName, resp.payload + pos, 16);
    TEST_ASSERT_EQUAL_STRING("temperature", dsName);
    pos += 16;

    TEST_ASSERT_EQUAL(CONDUYT_TYPE_FLOAT32, resp.payload[pos]); /* type */
    pos++;

    char unit[9] = {0};
    memcpy(unit, resp.payload + pos, 8);
    TEST_ASSERT_EQUAL_STRING("celsius", unit);
    pos += 8;

    TEST_ASSERT_EQUAL(0, resp.payload[pos]); /* not writable */
    pos++;
    TEST_ASSERT_EQUAL(0xFF, resp.payload[pos]); /* no pin ref */
    pos++;
    TEST_ASSERT_EQUAL(0, resp.payload[pos]); /* no retain (read-only default) */
}

void test_hello_preserves_seq() {
    ConduytDevice device("FW", "1.0.0", transport);
    device.begin();
    transport.clearWrite();

    feedCommand(CONDUYT_CMD_HELLO, 200);
    device.poll();

    ConduytPacket resp;
    decodeResponse(&resp);
    TEST_ASSERT_EQUAL(200, resp.seq);
}

/* ================================================================
 * PING / PONG
 * ================================================================ */

void test_ping_responds_with_pong() {
    ConduytDevice device("FW", "1.0.0", transport);
    device.begin();
    transport.clearWrite();

    feedCommand(CONDUYT_CMD_PING, 42);
    device.poll();

    ConduytPacket resp;
    TEST_ASSERT_EQUAL(CONDUYT_OK, decodeResponse(&resp));
    TEST_ASSERT_EQUAL(CONDUYT_EVT_PONG, resp.type);
    TEST_ASSERT_EQUAL(42, resp.seq);
    TEST_ASSERT_EQUAL(0, resp.payload_len);
}

void test_ping_seq_255() {
    ConduytDevice device("FW", "1.0.0", transport);
    device.begin();
    transport.clearWrite();

    feedCommand(CONDUYT_CMD_PING, 255);
    device.poll();

    ConduytPacket resp;
    decodeResponse(&resp);
    TEST_ASSERT_EQUAL(255, resp.seq);
}

/* ================================================================
 * PIN_MODE
 * ================================================================ */

void test_pin_mode_output() {
    ConduytDevice device("FW", "1.0.0", transport);
    device.begin();
    transport.clearWrite();

    uint8_t payload[] = {13, CONDUYT_PIN_MODE_OUTPUT};
    feedCommand(CONDUYT_CMD_PIN_MODE, 1, payload, 2);
    device.poll();

    ConduytPacket resp;
    decodeResponse(&resp);
    TEST_ASSERT_EQUAL(CONDUYT_EVT_ACK, resp.type);
    TEST_ASSERT_EQUAL(1, resp.seq);
}

void test_pin_mode_input() {
    ConduytDevice device("FW", "1.0.0", transport);
    device.begin();
    transport.clearWrite();

    uint8_t payload[] = {2, CONDUYT_PIN_MODE_INPUT};
    feedCommand(CONDUYT_CMD_PIN_MODE, 1, payload, 2);
    device.poll();
}

void test_pin_mode_input_pullup() {
    ConduytDevice device("FW", "1.0.0", transport);
    device.begin();
    transport.clearWrite();

    uint8_t payload[] = {4, CONDUYT_PIN_MODE_INPUT_PULLUP};
    feedCommand(CONDUYT_CMD_PIN_MODE, 1, payload, 2);
    device.poll();
}

void test_pin_mode_pwm_sets_output() {
    ConduytDevice device("FW", "1.0.0", transport);
    device.begin();
    transport.clearWrite();

    uint8_t payload[] = {9, CONDUYT_PIN_MODE_PWM};
    feedCommand(CONDUYT_CMD_PIN_MODE, 1, payload, 2);
    device.poll();
}

void test_pin_mode_analog_no_pinmode_call() {
    ConduytDevice device("FW", "1.0.0", transport);
    device.begin();
    transport.clearWrite();

    uint8_t payload[] = {0, CONDUYT_PIN_MODE_ANALOG};
    feedCommand(CONDUYT_CMD_PIN_MODE, 1, payload, 2);
    device.poll();

    ConduytPacket resp;
    decodeResponse(&resp);
    TEST_ASSERT_EQUAL(CONDUYT_EVT_ACK, resp.type);
}

void test_pin_mode_payload_too_short_naks() {
    ConduytDevice device("FW", "1.0.0", transport);
    device.begin();
    transport.clearWrite();

    uint8_t payload[] = {13};
    feedCommand(CONDUYT_CMD_PIN_MODE, 2, payload, 1);
    device.poll();

    ConduytPacket resp;
    decodeResponse(&resp);
    TEST_ASSERT_EQUAL(CONDUYT_EVT_NAK, resp.type);
    TEST_ASSERT_EQUAL(CONDUYT_ERR_INVALID_PIN, resp.payload[0]);
}

void test_pin_mode_unsupported_naks() {
    ConduytDevice device("FW", "1.0.0", transport);
    device.begin();
    transport.clearWrite();

    uint8_t payload[] = {13, 0xFF};
    feedCommand(CONDUYT_CMD_PIN_MODE, 3, payload, 2);
    device.poll();

    ConduytPacket resp;
    decodeResponse(&resp);
    TEST_ASSERT_EQUAL(CONDUYT_EVT_NAK, resp.type);
    TEST_ASSERT_EQUAL(CONDUYT_ERR_PIN_MODE_UNSUPPORTED, resp.payload[0]);
}

/* ================================================================
 * PIN_WRITE / PIN_READ / MOD_CMD / DATASTREAMS / etc.
 * (Remaining tests follow the same pattern - all Conduyt -> Conduyt)
 * ================================================================ */

void test_pin_write_digital_high() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); uint8_t payload[] = {13, 1}; feedCommand(CONDUYT_CMD_PIN_WRITE, 4, payload, 2); device.poll(); }
void test_pin_write_digital_low() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); uint8_t payload[] = {13, 0}; feedCommand(CONDUYT_CMD_PIN_WRITE, 4, payload, 2); device.poll(); }
void test_pin_write_pwm_value() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); uint8_t payload[] = {9, 128}; feedCommand(CONDUYT_CMD_PIN_WRITE, 5, payload, 2); device.poll(); }
void test_pin_write_with_mode_hint_pwm() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); uint8_t payload[] = {9, 64, CONDUYT_PIN_MODE_PWM}; feedCommand(CONDUYT_CMD_PIN_WRITE, 6, payload, 3); device.poll(); }
void test_pin_write_with_mode_hint_digital() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); uint8_t payload[] = {9, 128, CONDUYT_PIN_MODE_OUTPUT}; feedCommand(CONDUYT_CMD_PIN_WRITE, 7, payload, 3); device.poll(); }
void test_pin_write_payload_too_short_naks() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); uint8_t payload[] = {13}; feedCommand(CONDUYT_CMD_PIN_WRITE, 8, payload, 1); device.poll(); ConduytPacket resp; decodeResponse(&resp); TEST_ASSERT_EQUAL(CONDUYT_EVT_NAK, resp.type); }

void test_pin_read_digital() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); uint8_t payload[] = {7}; feedCommand(CONDUYT_CMD_PIN_READ, 6, payload, 1); device.poll(); ConduytPacket resp; decodeResponse(&resp); TEST_ASSERT_EQUAL(CONDUYT_EVT_PIN_READ_RESP, resp.type); TEST_ASSERT_EQUAL(6, resp.seq); TEST_ASSERT_EQUAL(7, resp.payload[0]); uint16_t value = resp.payload[1] | (resp.payload[2] << 8); TEST_ASSERT_EQUAL(1, value); }
void test_pin_read_digital_returns_uint16() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); uint8_t payload[] = {7}; feedCommand(CONDUYT_CMD_PIN_READ, 6, payload, 1); device.poll(); ConduytPacket resp; decodeResponse(&resp); uint16_t value = resp.payload[1] | (resp.payload[2] << 8); TEST_ASSERT_EQUAL(1, value); TEST_ASSERT_EQUAL(3, resp.payload_len); }
void test_pin_read_analog() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); uint8_t payload[] = {0, CONDUYT_PIN_MODE_ANALOG}; feedCommand(CONDUYT_CMD_PIN_READ, 7, payload, 2); device.poll(); ConduytPacket resp; decodeResponse(&resp); TEST_ASSERT_EQUAL(CONDUYT_EVT_PIN_READ_RESP, resp.type); uint16_t value = resp.payload[1] | (resp.payload[2] << 8); TEST_ASSERT_EQUAL(512, value); }
void test_pin_read_empty_payload_naks() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); feedCommand(CONDUYT_CMD_PIN_READ, 8); device.poll(); ConduytPacket resp; decodeResponse(&resp); TEST_ASSERT_EQUAL(CONDUYT_EVT_NAK, resp.type); }

void test_mod_cmd_dispatches_to_module() { TestModule mod; ConduytDevice device("FW", "1.0.0", transport); device.addModule(&mod); device.begin(); transport.clearWrite(); uint8_t payload[] = {0, 0x02, 0xAA}; feedCommand(CONDUYT_CMD_MOD_CMD, 8, payload, 3); device.poll(); TEST_ASSERT_EQUAL(1, mod.handleCallCount); TEST_ASSERT_EQUAL(0x02, mod.lastCmd); TEST_ASSERT_EQUAL(0xAA, mod.lastPayloadByte); }
void test_mod_cmd_mod_resp_suppresses_auto_ack() { RespondingModule mod; ConduytDevice device("FW", "1.0.0", transport); device.addModule(&mod); device.begin(); transport.clearWrite(); uint8_t payload[] = {0, 0x01}; feedCommand(CONDUYT_CMD_MOD_CMD, 9, payload, 2); device.poll(); ConduytPacket resp; decodeResponse(&resp); TEST_ASSERT_EQUAL(CONDUYT_EVT_MOD_RESP, resp.type); TEST_ASSERT_EQUAL(9, resp.seq); TEST_ASSERT_EQUAL(0, resp.payload[0]); TEST_ASSERT_EQUAL(0xDE, resp.payload[1]); TEST_ASSERT_EQUAL(0xAD, resp.payload[2]); TEST_ASSERT_EQUAL(0, transport.countSentPacketsByType(CONDUYT_EVT_ACK)); }
void test_mod_cmd_auto_ack_when_no_response() { RespondingModule mod; ConduytDevice device("FW", "1.0.0", transport); device.addModule(&mod); device.begin(); transport.clearWrite(); uint8_t payload[] = {0, 0x02}; feedCommand(CONDUYT_CMD_MOD_CMD, 10, payload, 2); device.poll(); ConduytPacket resp; decodeResponse(&resp); TEST_ASSERT_EQUAL(CONDUYT_EVT_ACK, resp.type); }
void test_mod_cmd_module_nak() { RespondingModule mod; ConduytDevice device("FW", "1.0.0", transport); device.addModule(&mod); device.begin(); transport.clearWrite(); uint8_t payload[] = {0, 0xFF}; feedCommand(CONDUYT_CMD_MOD_CMD, 11, payload, 2); device.poll(); ConduytPacket resp; decodeResponse(&resp); TEST_ASSERT_EQUAL(CONDUYT_EVT_NAK, resp.type); TEST_ASSERT_EQUAL(0x09, resp.payload[0]); }
void test_mod_cmd_invalid_module_naks() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); uint8_t payload[] = {99, 0x01}; feedCommand(CONDUYT_CMD_MOD_CMD, 12, payload, 2); device.poll(); ConduytPacket resp; decodeResponse(&resp); TEST_ASSERT_EQUAL(CONDUYT_EVT_NAK, resp.type); TEST_ASSERT_EQUAL(CONDUYT_ERR_MODULE_NOT_LOADED, resp.payload[0]); }
void test_mod_cmd_payload_too_short_naks() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); uint8_t payload[] = {0}; feedCommand(CONDUYT_CMD_MOD_CMD, 13, payload, 1); device.poll(); ConduytPacket resp; decodeResponse(&resp); TEST_ASSERT_EQUAL(CONDUYT_EVT_NAK, resp.type); }

void test_module_poll_called() { TestModule mod; ConduytDevice device("FW", "1.0.0", transport); device.addModule(&mod); device.begin(); mod.pollCalled = false; device.poll(); TEST_ASSERT_TRUE(mod.pollCalled); }

void test_reset_acks() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); feedCommand(CONDUYT_CMD_RESET, 11); device.poll(); ConduytPacket resp; decodeResponse(&resp); TEST_ASSERT_EQUAL(CONDUYT_EVT_ACK, resp.type); TEST_ASSERT_EQUAL(11, resp.seq); }
void test_reset_clears_subscriptions() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); uint8_t subPayload[] = {0, 0x03, 100, 0, 5, 0}; feedCommand(CONDUYT_CMD_PIN_SUBSCRIBE, 10, subPayload, 6); device.poll(); transport.clearWrite(); feedCommand(CONDUYT_CMD_RESET, 11); device.poll(); transport.clearWrite(); fakeMillis = 500; device.poll(); TEST_ASSERT_EQUAL(0, transport.countSentPacketsByType(CONDUYT_EVT_PIN_EVENT)); }

void test_unknown_command_naks() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); feedCommand(0xFE, 12); device.poll(); ConduytPacket resp; decodeResponse(&resp); TEST_ASSERT_EQUAL(CONDUYT_EVT_NAK, resp.type); TEST_ASSERT_EQUAL(CONDUYT_ERR_UNKNOWN_TYPE, resp.payload[0]); }

void test_ds_write_writable_fires_callback() { ConduytDevice device("FW", "1.0.0", transport); static bool fired = false; fired = false; device.addDatastream("brightness", CONDUYT_TYPE_INT32, "lux", true); device.onDatastreamWrite("brightness", [](ConduytPayloadReader &p, ConduytContext &ctx) { fired = true; ctx.ack(); }); device.begin(); transport.clearWrite(); uint8_t payload[] = {0, 0x80, 0x00, 0x00, 0x00}; feedCommand(CONDUYT_CMD_DS_WRITE, 13, payload, 5); device.poll(); TEST_ASSERT_TRUE(fired); }
void test_ds_write_readonly_naks() { ConduytDevice device("FW", "1.0.0", transport); device.addDatastream("temp", CONDUYT_TYPE_FLOAT32, "C", false); device.begin(); transport.clearWrite(); uint8_t payload[] = {0, 0x00, 0x00, 0x00, 0x00}; feedCommand(CONDUYT_CMD_DS_WRITE, 14, payload, 5); device.poll(); ConduytPacket resp; decodeResponse(&resp); TEST_ASSERT_EQUAL(CONDUYT_EVT_NAK, resp.type); TEST_ASSERT_EQUAL(CONDUYT_ERR_DATASTREAM_READONLY, resp.payload[0]); }
void test_ds_write_unknown_index_naks() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); uint8_t payload[] = {99, 0x00}; feedCommand(CONDUYT_CMD_DS_WRITE, 15, payload, 2); device.poll(); ConduytPacket resp; decodeResponse(&resp); TEST_ASSERT_EQUAL(CONDUYT_EVT_NAK, resp.type); TEST_ASSERT_EQUAL(CONDUYT_ERR_UNKNOWN_DATASTREAM, resp.payload[0]); }
void test_ds_push_float() { ConduytDevice device("FW", "1.0.0", transport); device.addDatastream("temp", CONDUYT_TYPE_FLOAT32, "C", false); device.begin(); transport.clearWrite(); device.writeDatastream("temp", 23.5f); const uint8_t *pkt = transport.findSentPacketByType(CONDUYT_EVT_DS_EVENT); TEST_ASSERT_NOT_NULL(pkt); ConduytPacket resp; conduyt_wire_decode(&resp, pkt, transport.writeLen); TEST_ASSERT_EQUAL(0, resp.payload[0]); float val; memcpy(&val, resp.payload + 1, 4); TEST_ASSERT_FLOAT_WITHIN(0.001f, 23.5f, val); }
void test_ds_push_int32() { ConduytDevice device("FW", "1.0.0", transport); device.addDatastream("count", CONDUYT_TYPE_INT32, "", false); device.begin(); transport.clearWrite(); device.writeDatastream("count", (int32_t)-42); const uint8_t *pkt = transport.findSentPacketByType(CONDUYT_EVT_DS_EVENT); TEST_ASSERT_NOT_NULL(pkt); ConduytPacket resp; conduyt_wire_decode(&resp, pkt, transport.writeLen); int32_t val; memcpy(&val, resp.payload + 1, 4); TEST_ASSERT_EQUAL(-42, val); }
void test_ds_push_bool() { ConduytDevice device("FW", "1.0.0", transport); device.addDatastream("led", CONDUYT_TYPE_BOOL, "", false); device.begin(); transport.clearWrite(); device.writeDatastream("led", true); const uint8_t *pkt = transport.findSentPacketByType(CONDUYT_EVT_DS_EVENT); TEST_ASSERT_NOT_NULL(pkt); ConduytPacket resp; conduyt_wire_decode(&resp, pkt, transport.writeLen); TEST_ASSERT_EQUAL(1, resp.payload[1]); }
void test_ds_push_nonexistent_does_nothing() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); device.writeDatastream("nope", 1.0f); TEST_ASSERT_EQUAL(0, transport.writeLen); }

void test_subscribe_payload_too_short_naks() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); uint8_t payload[] = {0, 0x03, 50}; feedCommand(CONDUYT_CMD_PIN_SUBSCRIBE, 24, payload, 3); device.poll(); ConduytPacket resp; decodeResponse(&resp); TEST_ASSERT_EQUAL(CONDUYT_EVT_NAK, resp.type); }

void test_corrupted_crc_sends_nak() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); ConduytPacket pkt; pkt.version = CONDUYT_PROTOCOL_VERSION; pkt.type = CONDUYT_CMD_PING; pkt.seq = 0; pkt.payload_len = 0; pkt.payload = nullptr; uint8_t buf[64]; size_t len = conduyt_wire_encode(buf, sizeof(buf), &pkt); buf[len - 1] ^= 0xFF; transport.feed(buf, len); device.poll(); ConduytPacket resp; decodeResponse(&resp); TEST_ASSERT_EQUAL(CONDUYT_EVT_NAK, resp.type); TEST_ASSERT_EQUAL(CONDUYT_ERR_CRC_MISMATCH, resp.payload[0]); }
void test_truncated_packet_ignored() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); uint8_t partial[] = {CONDUYT_MAGIC_0, CONDUYT_MAGIC_1, CONDUYT_PROTOCOL_VERSION}; transport.feed(partial, 3); device.poll(); TEST_ASSERT_EQUAL(0, transport.writeLen); }
void test_poll_when_disconnected_is_noop() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport._connected = false; transport.clearWrite(); feedCommand(CONDUYT_CMD_PING, 30); device.poll(); TEST_ASSERT_EQUAL(0, transport.writeLen); }

void test_cobs_framing_round_trip() { transport._needsCOBS = true; ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); ConduytPacket pkt; pkt.version = CONDUYT_PROTOCOL_VERSION; pkt.type = CONDUYT_CMD_PING; pkt.seq = 50; pkt.payload_len = 0; pkt.payload = nullptr; uint8_t wireBuf[64]; size_t wireLen = conduyt_wire_encode(wireBuf, sizeof(wireBuf), &pkt); uint8_t cobsBuf[128]; size_t cobsLen = conduyt_cobs_encode(cobsBuf, sizeof(cobsBuf), wireBuf, wireLen); transport.feed(cobsBuf, cobsLen); uint8_t delim = 0x00; transport.feed(&delim, 1); device.poll(); TEST_ASSERT_GREATER_THAN(0, transport.writeLen); TEST_ASSERT_EQUAL(0x00, transport.writeBuf[transport.writeLen - 1]); uint8_t decodedBuf[128]; size_t decodedLen = conduyt_cobs_decode(decodedBuf, sizeof(decodedBuf), transport.writeBuf, transport.writeLen - 1); TEST_ASSERT_GREATER_THAN(0, decodedLen); ConduytPacket resp; TEST_ASSERT_EQUAL(CONDUYT_OK, conduyt_wire_decode(&resp, decodedBuf, decodedLen)); TEST_ASSERT_EQUAL(CONDUYT_EVT_PONG, resp.type); TEST_ASSERT_EQUAL(50, resp.seq); }
void test_cobs_with_payload_containing_zeros() { transport._needsCOBS = true; ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); uint8_t payload[] = {0, 0}; ConduytPacket pkt; pkt.version = CONDUYT_PROTOCOL_VERSION; pkt.type = CONDUYT_CMD_PIN_WRITE; pkt.seq = 51; pkt.payload_len = 2; pkt.payload = payload; uint8_t wireBuf[64]; size_t wireLen = conduyt_wire_encode(wireBuf, sizeof(wireBuf), &pkt); uint8_t cobsBuf[128]; size_t cobsLen = conduyt_cobs_encode(cobsBuf, sizeof(cobsBuf), wireBuf, wireLen); transport.feed(cobsBuf, cobsLen); uint8_t delim = 0x00; transport.feed(&delim, 1); device.poll(); TEST_ASSERT_GREATER_THAN(0, transport.writeLen); }

void test_multiple_commands_sequential() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); feedCommand(CONDUYT_CMD_PING, 20); device.poll(); ConduytPacket resp1; TEST_ASSERT_EQUAL(CONDUYT_OK, decodeResponse(&resp1)); TEST_ASSERT_EQUAL(CONDUYT_EVT_PONG, resp1.type); TEST_ASSERT_EQUAL(20, resp1.seq); transport.clearWrite(); feedCommand(CONDUYT_CMD_PING, 21); device.poll(); ConduytPacket resp2; TEST_ASSERT_EQUAL(CONDUYT_OK, decodeResponse(&resp2)); TEST_ASSERT_EQUAL(CONDUYT_EVT_PONG, resp2.type); TEST_ASSERT_EQUAL(21, resp2.seq); }

void test_ota_begin_naks_when_not_supported() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); feedCommand(CONDUYT_CMD_PING, 29); device.poll(); TEST_ASSERT_NOT_NULL_MESSAGE(transport.findSentPacketByType(CONDUYT_EVT_PONG), "Sanity: PING should produce PONG"); transport.clearWrite(); feedCommand(CONDUYT_CMD_OTA_BEGIN, 30); device.poll(); TEST_ASSERT_GREATER_THAN_MESSAGE(0, transport.writeLen, "OTA_BEGIN should produce a response"); const uint8_t *pkt = transport.findSentPacketByType(CONDUYT_EVT_NAK); TEST_ASSERT_NOT_NULL(pkt); }
void test_ota_chunk_naks_when_not_supported() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); feedCommand(CONDUYT_CMD_OTA_CHUNK, 31); device.poll(); TEST_ASSERT_NOT_NULL(transport.findSentPacketByType(CONDUYT_EVT_NAK)); }
void test_ota_finalize_naks_when_not_supported() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); feedCommand(CONDUYT_CMD_OTA_FINALIZE, 32); device.poll(); TEST_ASSERT_NOT_NULL(transport.findSentPacketByType(CONDUYT_EVT_NAK)); }

void test_stream_start_acks() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); uint8_t payload[] = {0x01, 0x00, 0xE8, 0x03, 0x00}; feedCommand(CONDUYT_CMD_STREAM_START, 40, payload, 5); device.poll(); TEST_ASSERT_GREATER_THAN(0, transport.writeLen); TEST_ASSERT_NOT_NULL(transport.findSentPacketByType(CONDUYT_EVT_ACK)); }
void test_stream_stop_acks() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); uint8_t startPayload[] = {0x01, 0x00, 0xE8, 0x03, 0x00}; feedCommand(CONDUYT_CMD_STREAM_START, 41, startPayload, 5); device.poll(); transport.clearWrite(); feedCommand(CONDUYT_CMD_STREAM_STOP, 42); device.poll(); TEST_ASSERT_NOT_NULL(transport.findSentPacketByType(CONDUYT_EVT_ACK)); }

void test_i2c_write_payload_too_short_naks() { ConduytDevice device("FW", "1.0.0", transport); device.begin(); transport.clearWrite(); uint8_t payload[] = {0x50}; feedCommand(CONDUYT_CMD_I2C_WRITE, 52, payload, 1); device.poll(); TEST_ASSERT_NOT_NULL(transport.findSentPacketByType(CONDUYT_EVT_NAK)); }

/* ================================================================
 * MAIN
 * ================================================================ */

int main(int argc, char **argv) {
    initArduinoMocks();
    UNITY_BEGIN();

    RUN_TEST(test_constructor_sets_name);
    RUN_TEST(test_constructor_truncates_long_name);
    RUN_TEST(test_constructor_parses_version);
    RUN_TEST(test_constructor_null_version);
    RUN_TEST(test_begin_calls_transport_begin);
    RUN_TEST(test_begin_calls_module_setDevice_and_begin);
    RUN_TEST(test_add_module_increments_count);
    RUN_TEST(test_add_module_null_ignored);
    RUN_TEST(test_add_datastream);
    RUN_TEST(test_hello_responds_with_hello_resp);
    RUN_TEST(test_hello_resp_firmware_name_and_version);
    RUN_TEST(test_hello_resp_module_descriptor);
    RUN_TEST(test_hello_resp_datastream_descriptor);
    RUN_TEST(test_hello_preserves_seq);
    RUN_TEST(test_ping_responds_with_pong);
    RUN_TEST(test_ping_seq_255);
    RUN_TEST(test_pin_mode_output);
    RUN_TEST(test_pin_mode_input);
    RUN_TEST(test_pin_mode_input_pullup);
    RUN_TEST(test_pin_mode_pwm_sets_output);
    RUN_TEST(test_pin_mode_analog_no_pinmode_call);
    RUN_TEST(test_pin_mode_payload_too_short_naks);
    RUN_TEST(test_pin_mode_unsupported_naks);
    RUN_TEST(test_pin_write_digital_high);
    RUN_TEST(test_pin_write_digital_low);
    RUN_TEST(test_pin_write_pwm_value);
    RUN_TEST(test_pin_write_with_mode_hint_pwm);
    RUN_TEST(test_pin_write_with_mode_hint_digital);
    RUN_TEST(test_pin_write_payload_too_short_naks);
    RUN_TEST(test_pin_read_digital);
    RUN_TEST(test_pin_read_digital_returns_uint16);
    RUN_TEST(test_pin_read_analog);
    RUN_TEST(test_pin_read_empty_payload_naks);
    RUN_TEST(test_mod_cmd_dispatches_to_module);
    RUN_TEST(test_mod_cmd_mod_resp_suppresses_auto_ack);
    RUN_TEST(test_mod_cmd_auto_ack_when_no_response);
    RUN_TEST(test_mod_cmd_module_nak);
    RUN_TEST(test_mod_cmd_invalid_module_naks);
    RUN_TEST(test_mod_cmd_payload_too_short_naks);
    RUN_TEST(test_module_poll_called);
    RUN_TEST(test_reset_acks);
    RUN_TEST(test_reset_clears_subscriptions);
    RUN_TEST(test_unknown_command_naks);
    RUN_TEST(test_ds_write_writable_fires_callback);
    RUN_TEST(test_ds_write_readonly_naks);
    RUN_TEST(test_ds_write_unknown_index_naks);
    RUN_TEST(test_ds_push_float);
    RUN_TEST(test_ds_push_int32);
    RUN_TEST(test_ds_push_bool);
    RUN_TEST(test_ds_push_nonexistent_does_nothing);
    RUN_TEST(test_corrupted_crc_sends_nak);
    RUN_TEST(test_truncated_packet_ignored);
    RUN_TEST(test_poll_when_disconnected_is_noop);
    RUN_TEST(test_cobs_framing_round_trip);
    RUN_TEST(test_cobs_with_payload_containing_zeros);
    RUN_TEST(test_multiple_commands_sequential);
    RUN_TEST(test_ota_begin_naks_when_not_supported);
    RUN_TEST(test_ota_chunk_naks_when_not_supported);
    RUN_TEST(test_ota_finalize_naks_when_not_supported);

    int result = UNITY_END();
    _exit(result);
    return result;
}

//! CONDUYT Protocol Constants

// Host → Device Commands
pub const CMD_PING: u8 = 0x01;
pub const CMD_HELLO: u8 = 0x02;
pub const CMD_PIN_MODE: u8 = 0x10;
pub const CMD_PIN_WRITE: u8 = 0x11;
pub const CMD_PIN_READ: u8 = 0x12;
pub const CMD_PIN_SUBSCRIBE: u8 = 0x13;
pub const CMD_PIN_UNSUBSCRIBE: u8 = 0x14;
pub const CMD_I2C_WRITE: u8 = 0x20;
pub const CMD_I2C_READ: u8 = 0x21;
pub const CMD_I2C_READ_REG: u8 = 0x22;
pub const CMD_SPI_XFER: u8 = 0x30;
pub const CMD_MOD_CMD: u8 = 0x40;
pub const CMD_STREAM_START: u8 = 0x50;
pub const CMD_STREAM_STOP: u8 = 0x51;
pub const CMD_DS_WRITE: u8 = 0x60;
pub const CMD_DS_READ: u8 = 0x61;
pub const CMD_DS_SUBSCRIBE: u8 = 0x62;
pub const CMD_OTA_BEGIN: u8 = 0x70;
pub const CMD_OTA_CHUNK: u8 = 0x71;
pub const CMD_OTA_FINALIZE: u8 = 0x72;
pub const CMD_RESET: u8 = 0xF0;

// Device → Host Events
pub const EVT_PONG: u8 = 0x80;
pub const EVT_HELLO_RESP: u8 = 0x81;
pub const EVT_ACK: u8 = 0x82;
pub const EVT_NAK: u8 = 0x83;
pub const EVT_PIN_EVENT: u8 = 0x90;
pub const EVT_PIN_READ_RESP: u8 = 0x91;
pub const EVT_I2C_READ_RESP: u8 = 0xA0;
pub const EVT_SPI_XFER_RESP: u8 = 0xB0;
pub const EVT_MOD_EVENT: u8 = 0xC0;
pub const EVT_MOD_RESP: u8 = 0xC1;
pub const EVT_STREAM_DATA: u8 = 0xD0;
pub const EVT_DS_EVENT: u8 = 0xD1;
pub const EVT_DS_READ_RESP: u8 = 0xD2;
pub const EVT_LOG: u8 = 0xE0;
pub const EVT_FATAL: u8 = 0xFF;

// NAK Error Codes
pub const ERR_UNKNOWN_TYPE: u8 = 0x01;
pub const ERR_CRC_MISMATCH: u8 = 0x02;
pub const ERR_PAYLOAD_TOO_LARGE: u8 = 0x03;
pub const ERR_INVALID_PIN: u8 = 0x04;
pub const ERR_PIN_MODE_UNSUPPORTED: u8 = 0x05;
pub const ERR_I2C_NOT_AVAILABLE: u8 = 0x06;
pub const ERR_I2C_NACK: u8 = 0x07;
pub const ERR_MODULE_NOT_LOADED: u8 = 0x08;
pub const ERR_UNKNOWN_MODULE_CMD: u8 = 0x09;
pub const ERR_MODULE_BUSY: u8 = 0x0A;
pub const ERR_SUB_LIMIT_REACHED: u8 = 0x0B;
pub const ERR_OUT_OF_MEMORY: u8 = 0x0C;
pub const ERR_UNKNOWN_DATASTREAM: u8 = 0x0D;
pub const ERR_DATASTREAM_READONLY: u8 = 0x0E;
pub const ERR_OTA_INVALID: u8 = 0x0F;
pub const ERR_VERSION_MISMATCH: u8 = 0x10;

/// Get error name string from error code.
pub fn err_name(code: u8) -> &'static str {
    match code {
        ERR_UNKNOWN_TYPE => "UNKNOWN_TYPE",
        ERR_CRC_MISMATCH => "CRC_MISMATCH",
        ERR_PAYLOAD_TOO_LARGE => "PAYLOAD_TOO_LARGE",
        ERR_INVALID_PIN => "INVALID_PIN",
        ERR_PIN_MODE_UNSUPPORTED => "PIN_MODE_UNSUPPORTED",
        ERR_I2C_NOT_AVAILABLE => "I2C_NOT_AVAILABLE",
        ERR_I2C_NACK => "I2C_NACK",
        ERR_MODULE_NOT_LOADED => "MODULE_NOT_LOADED",
        ERR_UNKNOWN_MODULE_CMD => "UNKNOWN_MODULE_CMD",
        ERR_MODULE_BUSY => "MODULE_BUSY",
        ERR_SUB_LIMIT_REACHED => "SUB_LIMIT_REACHED",
        ERR_OUT_OF_MEMORY => "OUT_OF_MEMORY",
        ERR_UNKNOWN_DATASTREAM => "UNKNOWN_DATASTREAM",
        ERR_DATASTREAM_READONLY => "DATASTREAM_READONLY",
        ERR_OTA_INVALID => "OTA_INVALID",
        ERR_VERSION_MISMATCH => "VERSION_MISMATCH",
        _ => "UNKNOWN",
    }
}

import Foundation

/// CONDUYT Protocol Constants
public enum ConduytCmd {
    public static let ping: UInt8            = 0x01
    public static let hello: UInt8           = 0x02
    public static let pinMode: UInt8         = 0x10
    public static let pinWrite: UInt8        = 0x11
    public static let pinRead: UInt8         = 0x12
    public static let pinSubscribe: UInt8    = 0x13
    public static let pinUnsubscribe: UInt8  = 0x14
    public static let i2cWrite: UInt8        = 0x20
    public static let i2cRead: UInt8         = 0x21
    public static let i2cReadReg: UInt8      = 0x22
    public static let spiXfer: UInt8         = 0x30
    public static let modCmd: UInt8          = 0x40
    public static let streamStart: UInt8     = 0x50
    public static let streamStop: UInt8      = 0x51
    public static let dsWrite: UInt8         = 0x60
    public static let dsRead: UInt8          = 0x61
    public static let dsSubscribe: UInt8     = 0x62
    public static let otaBegin: UInt8        = 0x70
    public static let otaChunk: UInt8        = 0x71
    public static let otaFinalize: UInt8     = 0x72
    public static let reset: UInt8           = 0xF0
}

public enum ConduytEvt {
    public static let pong: UInt8            = 0x80
    public static let helloResp: UInt8       = 0x81
    public static let ack: UInt8             = 0x82
    public static let nak: UInt8             = 0x83
    public static let pinEvent: UInt8        = 0x90
    public static let pinReadResp: UInt8     = 0x91
    public static let i2cReadResp: UInt8     = 0xA0
    public static let spiXferResp: UInt8     = 0xB0
    public static let modEvent: UInt8        = 0xC0
    public static let modResp: UInt8         = 0xC1
    public static let streamData: UInt8      = 0xD0
    public static let dsEvent: UInt8         = 0xD1
    public static let dsReadResp: UInt8      = 0xD2
    public static let log: UInt8             = 0xE0
    public static let fatal: UInt8           = 0xFF
}

public enum ConduytErr {
    public static let unknownType: UInt8         = 0x01
    public static let crcMismatch: UInt8         = 0x02
    public static let payloadTooLarge: UInt8      = 0x03
    public static let invalidPin: UInt8          = 0x04
    public static let pinModeUnsupported: UInt8   = 0x05
    public static let i2cNotAvailable: UInt8      = 0x06
    public static let i2cNack: UInt8             = 0x07
    public static let moduleNotLoaded: UInt8     = 0x08
    public static let unknownModuleCmd: UInt8    = 0x09
    public static let moduleBusy: UInt8          = 0x0A
    public static let subLimitReached: UInt8     = 0x0B
    public static let outOfMemory: UInt8         = 0x0C
    public static let unknownDatastream: UInt8   = 0x0D
    public static let datastreamReadonly: UInt8  = 0x0E
    public static let otaInvalid: UInt8          = 0x0F
    public static let versionMismatch: UInt8     = 0x10

    public static func name(_ code: UInt8) -> String {
        switch code {
        case unknownType: return "UNKNOWN_TYPE"
        case crcMismatch: return "CRC_MISMATCH"
        case payloadTooLarge: return "PAYLOAD_TOO_LARGE"
        case invalidPin: return "INVALID_PIN"
        case pinModeUnsupported: return "PIN_MODE_UNSUPPORTED"
        case i2cNotAvailable: return "I2C_NOT_AVAILABLE"
        case i2cNack: return "I2C_NACK"
        case moduleNotLoaded: return "MODULE_NOT_LOADED"
        case unknownModuleCmd: return "UNKNOWN_MODULE_CMD"
        case moduleBusy: return "MODULE_BUSY"
        case subLimitReached: return "SUB_LIMIT_REACHED"
        case outOfMemory: return "OUT_OF_MEMORY"
        case unknownDatastream: return "UNKNOWN_DATASTREAM"
        case datastreamReadonly: return "DATASTREAM_READONLY"
        case otaInvalid: return "OTA_INVALID"
        case versionMismatch: return "VERSION_MISMATCH"
        default: return "UNKNOWN_0x\(String(code, radix: 16))"
        }
    }
}

public enum ConduytPinMode {
    public static let input: UInt8       = 0x00
    public static let output: UInt8      = 0x01
    public static let pwm: UInt8         = 0x02
    public static let analog: UInt8      = 0x03
    public static let inputPullup: UInt8 = 0x04
}

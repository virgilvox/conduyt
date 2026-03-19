// Package conduyt implements the CONDUYT protocol SDK for Go.
//
// Generated from protocol/constants.json — DO NOT EDIT
package conduyt

const (
	ProtocolVersion = 0x01
	Magic0          = 0x43 // 'C'
	Magic1          = 0x44 // 'D'
	HeaderSize      = 8    // MAGIC(2) + VER(1) + TYPE(1) + SEQ(1) + LEN(2) + CRC(1)
)

// Host → Device Commands
const (
	CmdPing           = 0x01
	CmdHello          = 0x02
	CmdPinMode        = 0x10
	CmdPinWrite       = 0x11
	CmdPinRead        = 0x12
	CmdPinSubscribe   = 0x13
	CmdPinUnsubscribe = 0x14
	CmdI2CWrite       = 0x20
	CmdI2CRead        = 0x21
	CmdI2CReadReg     = 0x22
	CmdSPIXfer        = 0x30
	CmdModCmd         = 0x40
	CmdStreamStart    = 0x50
	CmdStreamStop     = 0x51
	CmdDSWrite        = 0x60
	CmdDSRead         = 0x61
	CmdDSSubscribe    = 0x62
	CmdOTABegin       = 0x70
	CmdOTAChunk       = 0x71
	CmdOTAFinalize    = 0x72
	CmdReset          = 0xF0
)

// Device → Host Events
const (
	EvtPong        = 0x80
	EvtHelloResp   = 0x81
	EvtACK         = 0x82
	EvtNAK         = 0x83
	EvtPinEvent    = 0x90
	EvtPinReadResp = 0x91
	EvtI2CReadResp = 0xA0
	EvtSPIXferResp = 0xB0
	EvtModEvent    = 0xC0
	EvtModResp     = 0xC1
	EvtStreamData  = 0xD0
	EvtDSEvent     = 0xD1
	EvtDSReadResp  = 0xD2
	EvtLog         = 0xE0
	EvtFatal       = 0xFF
)

// NAK Error Codes
const (
	ErrUnknownType        = 0x01
	ErrCRCMismatch        = 0x02
	ErrPayloadTooLarge    = 0x03
	ErrInvalidPin         = 0x04
	ErrPinModeUnsupported = 0x05
	ErrI2CNotAvailable    = 0x06
	ErrI2CNACK            = 0x07
	ErrModuleNotLoaded    = 0x08
	ErrUnknownModuleCmd   = 0x09
	ErrModuleBusy         = 0x0A
	ErrSubLimitReached    = 0x0B
	ErrOutOfMemory        = 0x0C
	ErrUnknownDatastream  = 0x0D
	ErrDatastreamReadonly = 0x0E
	ErrOTAInvalid         = 0x0F
	ErrVersionMismatch    = 0x10
)

// ErrNames maps error codes to human-readable names.
var ErrNames = map[byte]string{
	ErrUnknownType:        "UNKNOWN_TYPE",
	ErrCRCMismatch:        "CRC_MISMATCH",
	ErrPayloadTooLarge:    "PAYLOAD_TOO_LARGE",
	ErrInvalidPin:         "INVALID_PIN",
	ErrPinModeUnsupported: "PIN_MODE_UNSUPPORTED",
	ErrI2CNotAvailable:    "I2C_NOT_AVAILABLE",
	ErrI2CNACK:            "I2C_NACK",
	ErrModuleNotLoaded:    "MODULE_NOT_LOADED",
	ErrUnknownModuleCmd:   "UNKNOWN_MODULE_CMD",
	ErrModuleBusy:         "MODULE_BUSY",
	ErrSubLimitReached:    "SUB_LIMIT_REACHED",
	ErrOutOfMemory:        "OUT_OF_MEMORY",
	ErrUnknownDatastream:  "UNKNOWN_DATASTREAM",
	ErrDatastreamReadonly: "DATASTREAM_READONLY",
	ErrOTAInvalid:         "OTA_INVALID",
	ErrVersionMismatch:    "VERSION_MISMATCH",
}

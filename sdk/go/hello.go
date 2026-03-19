package conduyt

import (
	"encoding/binary"
	"fmt"
)

// HelloResp represents the parsed HELLO_RESP payload.
type HelloResp struct {
	FirmwareName    string
	FirmwareVersion [3]byte // major, minor, patch
	McuID           []byte
	OTACapable      bool
	Pins            []PinCapability
	I2CBuses        byte
	SPIBuses        byte
	UARTCount       byte
	MaxPayload      uint16
	Modules         []ModuleDescriptor
	Datastreams     []DatastreamDescriptor
}

// PinCapability describes a single pin's capabilities.
type PinCapability struct {
	Pin          byte
	Capabilities byte
}

// ModuleDescriptor describes a loaded firmware module.
type ModuleDescriptor struct {
	ModuleID     byte
	Name         string
	VersionMajor byte
	VersionMinor byte
	Pins         []byte
}

// DatastreamDescriptor describes a datastream.
type DatastreamDescriptor struct {
	Index    byte
	Name     string
	Type     byte
	Unit     string
	Writable bool
	PinRef   byte
	Retain   bool
}

func readFixedString(data []byte, offset, length int) (string, int) {
	if offset+length > len(data) {
		return "", offset + length
	}
	raw := data[offset : offset+length]
	end := -1
	for i, b := range raw {
		if b == 0 {
			end = i
			break
		}
	}
	if end == -1 {
		end = length
	}
	return string(raw[:end]), offset + length
}

// ParseHelloResp parses a HELLO_RESP binary payload.
func ParseHelloResp(payload []byte) (*HelloResp, error) {
	if len(payload) < 30 {
		return nil, fmt.Errorf("hello payload too short: %d bytes", len(payload))
	}

	pos := 0
	var name string
	name, pos = readFixedString(payload, pos, 16)

	vMajor := payload[pos]
	pos++
	vMinor := payload[pos]
	pos++
	vPatch := payload[pos]
	pos++

	mcuID := make([]byte, 8)
	copy(mcuID, payload[pos:pos+8])
	pos += 8

	otaCapable := payload[pos] == 0x01
	pos++

	pinCount := int(payload[pos])
	pos++
	pins := make([]PinCapability, pinCount)
	for i := 0; i < pinCount; i++ {
		pins[i] = PinCapability{Pin: byte(i), Capabilities: payload[pos]}
		pos++
	}

	i2cBuses := payload[pos]
	pos++
	spiBuses := payload[pos]
	pos++
	uartCount := payload[pos]
	pos++

	maxPayload := binary.LittleEndian.Uint16(payload[pos:])
	pos += 2

	moduleCount := int(payload[pos])
	pos++
	modules := make([]ModuleDescriptor, moduleCount)
	for i := 0; i < moduleCount; i++ {
		modID := payload[pos]
		pos++
		var modName string
		modName, pos = readFixedString(payload, pos, 8)
		verMajor := payload[pos]
		pos++
		verMinor := payload[pos]
		pos++
		modPinCount := int(payload[pos])
		pos++
		modPins := make([]byte, modPinCount)
		for p := 0; p < modPinCount; p++ {
			modPins[p] = payload[pos]
			pos++
		}
		modules[i] = ModuleDescriptor{
			ModuleID: modID, Name: modName,
			VersionMajor: verMajor, VersionMinor: verMinor, Pins: modPins,
		}
	}

	dsCount := int(payload[pos])
	pos++
	datastreams := make([]DatastreamDescriptor, dsCount)
	for i := 0; i < dsCount; i++ {
		var dsName string
		dsName, pos = readFixedString(payload, pos, 16)
		dsType := payload[pos]
		pos++
		var dsUnit string
		dsUnit, pos = readFixedString(payload, pos, 8)
		writable := payload[pos] == 0x01
		pos++
		pinRef := payload[pos]
		pos++
		retain := payload[pos] == 0x01
		pos++
		datastreams[i] = DatastreamDescriptor{
			Index: byte(i), Name: dsName, Type: dsType, Unit: dsUnit,
			Writable: writable, PinRef: pinRef, Retain: retain,
		}
	}

	return &HelloResp{
		FirmwareName:    name,
		FirmwareVersion: [3]byte{vMajor, vMinor, vPatch},
		McuID:           mcuID,
		OTACapable:      otaCapable,
		Pins:            pins,
		I2CBuses:        i2cBuses,
		SPIBuses:        spiBuses,
		UARTCount:       uartCount,
		MaxPayload:      maxPayload,
		Modules:         modules,
		Datastreams:     datastreams,
	}, nil
}

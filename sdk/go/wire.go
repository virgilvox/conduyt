package conduyt

import (
	"encoding/binary"
	"fmt"
)

// Packet represents a decoded CONDUYT packet.
type Packet struct {
	Version byte
	Type    byte
	Seq     byte
	Payload []byte
}

// WireEncode encodes a Packet into raw wire bytes.
func WireEncode(pkt *Packet) []byte {
	payloadLen := len(pkt.Payload)
	total := HeaderSize + payloadLen
	buf := make([]byte, total)

	buf[0] = Magic0
	buf[1] = Magic1
	buf[2] = pkt.Version
	buf[3] = pkt.Type
	buf[4] = pkt.Seq
	binary.LittleEndian.PutUint16(buf[5:7], uint16(payloadLen))

	if payloadLen > 0 {
		copy(buf[7:], pkt.Payload)
	}

	// CRC8 over [VER..end of PAYLOAD]
	crcRegion := buf[2 : 7+payloadLen]
	buf[7+payloadLen] = CRC8(crcRegion)

	return buf
}

// WireDecode decodes raw wire bytes into a Packet.
func WireDecode(data []byte) (*Packet, error) {
	if len(data) < HeaderSize {
		return nil, fmt.Errorf("incomplete packet: need %d bytes, got %d", HeaderSize, len(data))
	}

	if data[0] != Magic0 || data[1] != Magic1 {
		return nil, fmt.Errorf("invalid magic: 0x%02x%02x", data[0], data[1])
	}

	version := data[2]
	if version != ProtocolVersion {
		return nil, fmt.Errorf("version mismatch: expected %d, got %d", ProtocolVersion, version)
	}

	pktType := data[3]
	seq := data[4]
	payloadLen := int(binary.LittleEndian.Uint16(data[5:7]))

	total := HeaderSize + payloadLen
	if len(data) < total {
		return nil, fmt.Errorf("incomplete packet: need %d bytes, got %d", total, len(data))
	}

	crcRegion := data[2 : 7+payloadLen]
	expected := CRC8(crcRegion)
	actual := data[7+payloadLen]

	if expected != actual {
		return nil, fmt.Errorf("CRC mismatch: expected 0x%02x, got 0x%02x", expected, actual)
	}

	payload := make([]byte, payloadLen)
	copy(payload, data[7:7+payloadLen])

	return &Packet{
		Version: version,
		Type:    pktType,
		Seq:     seq,
		Payload: payload,
	}, nil
}

// MakePacket creates a Packet ready for encoding.
func MakePacket(pktType byte, seq byte, payload []byte) *Packet {
	return &Packet{
		Version: ProtocolVersion,
		Type:    pktType,
		Seq:     seq,
		Payload: payload,
	}
}

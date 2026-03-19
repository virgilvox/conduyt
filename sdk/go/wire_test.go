package conduyt

import (
	"bytes"
	"testing"
)

func TestWirePingRoundTrip(t *testing.T) {
	pkt := MakePacket(CmdPing, 7, nil)
	encoded := WireEncode(pkt)

	if len(encoded) != HeaderSize {
		t.Errorf("PING wire size = %d, want %d", len(encoded), HeaderSize)
	}

	decoded, err := WireDecode(encoded)
	if err != nil {
		t.Fatalf("WireDecode failed: %v", err)
	}

	if decoded.Type != CmdPing {
		t.Errorf("type = 0x%02x, want 0x%02x", decoded.Type, CmdPing)
	}
	if decoded.Seq != 7 {
		t.Errorf("seq = %d, want 7", decoded.Seq)
	}
	if len(decoded.Payload) != 0 {
		t.Errorf("payload len = %d, want 0", len(decoded.Payload))
	}
}

func TestWirePinWriteRoundTrip(t *testing.T) {
	payload := []byte{5, 128}
	pkt := MakePacket(CmdPinWrite, 255, payload)
	encoded := WireEncode(pkt)
	decoded, err := WireDecode(encoded)
	if err != nil {
		t.Fatalf("WireDecode failed: %v", err)
	}

	if decoded.Type != CmdPinWrite {
		t.Errorf("type = 0x%02x, want 0x%02x", decoded.Type, CmdPinWrite)
	}
	if decoded.Seq != 255 {
		t.Errorf("seq = %d, want 255", decoded.Seq)
	}
	if !bytes.Equal(decoded.Payload, payload) {
		t.Errorf("payload = %v, want %v", decoded.Payload, payload)
	}
}

func TestWireRejectIncomplete(t *testing.T) {
	_, err := WireDecode([]byte{Magic0, Magic1})
	if err == nil {
		t.Error("should reject incomplete packet")
	}
}

func TestWireRejectBadMagic(t *testing.T) {
	_, err := WireDecode([]byte{0x00, 0x00, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00})
	if err == nil {
		t.Error("should reject bad magic")
	}
}

func TestWireRejectCRCMismatch(t *testing.T) {
	pkt := MakePacket(CmdPing, 0, nil)
	encoded := WireEncode(pkt)
	encoded[7] ^= 0xFF // corrupt CRC

	_, err := WireDecode(encoded)
	if err == nil {
		t.Error("should reject CRC mismatch")
	}
}

func TestWireAllTypes(t *testing.T) {
	types := []byte{
		CmdPing, CmdHello, CmdPinMode, CmdPinWrite, CmdPinRead,
		CmdModCmd, CmdDSWrite, CmdReset,
		EvtPong, EvtHelloResp, EvtACK, EvtNAK, EvtPinEvent,
		EvtModEvent, EvtDSEvent, EvtFatal,
	}

	for _, tp := range types {
		pkt := MakePacket(tp, 0, []byte{0xAA, 0xBB})
		encoded := WireEncode(pkt)
		decoded, err := WireDecode(encoded)
		if err != nil {
			t.Errorf("round-trip failed for type 0x%02x: %v", tp, err)
			continue
		}
		if decoded.Type != tp {
			t.Errorf("type = 0x%02x, want 0x%02x", decoded.Type, tp)
		}
	}
}

package conduyt

import (
	"context"
	"encoding/binary"
	"testing"
	"time"

	"github.com/conduyt-io/conduyt-go/transports"
)

// makeHelloRespPayload builds a binary HELLO_RESP payload for testing.
// Firmware: "MockBoard", version 1.0.0, 20 pins with 0x0F caps,
// 1 servo module, 1 temperature datastream.
func makeHelloRespPayload() []byte {
	var buf []byte

	// Firmware name (16 bytes, null-padded)
	name := make([]byte, 16)
	copy(name, "MockBoard")
	buf = append(buf, name...)

	// Version: 1.0.0
	buf = append(buf, 1, 0, 0)

	// MCU ID (8 bytes)
	buf = append(buf, 0xDE, 0xAD, 0xBE, 0xEF, 0x01, 0x02, 0x03, 0x04)

	// OTA capable
	buf = append(buf, 0x01)

	// 20 pins, each with caps = 0x0F
	buf = append(buf, 20)
	for i := 0; i < 20; i++ {
		buf = append(buf, 0x0F)
	}

	// I2C buses, SPI buses, UART count
	buf = append(buf, 1, 1, 1)

	// Max payload (uint16 LE)
	mp := make([]byte, 2)
	binary.LittleEndian.PutUint16(mp, 256)
	buf = append(buf, mp...)

	// 1 module: servo
	buf = append(buf, 1) // module count
	buf = append(buf, 0x01) // module ID
	modName := make([]byte, 8)
	copy(modName, "Servo")
	buf = append(buf, modName...)
	buf = append(buf, 1, 0) // version 1.0
	buf = append(buf, 1)    // 1 pin
	buf = append(buf, 9)    // pin 9

	// 1 datastream: temperature
	buf = append(buf, 1) // datastream count
	dsName := make([]byte, 16)
	copy(dsName, "temperature")
	buf = append(buf, dsName...)
	buf = append(buf, 0x02) // type: float
	dsUnit := make([]byte, 8)
	copy(dsUnit, "C")
	buf = append(buf, dsUnit...)
	buf = append(buf, 0x00) // not writable
	buf = append(buf, 0xFF) // pinRef = none
	buf = append(buf, 0x01) // retain = true

	return buf
}

// autoResponder starts a goroutine that watches for sent packets on the mock
// transport and injects appropriate responses. It must be started before
// calling device methods that send commands.
func autoResponder(mock *transports.MockTransport, responses map[byte]func(seq byte)) {
	go func() {
		seen := 0
		for {
			// Poll for new sent packets
			time.Sleep(1 * time.Millisecond)
			for seen < len(mock.SentPackets) {
				raw := mock.SentPackets[seen]
				seen++
				pkt, err := WireDecode(raw)
				if err != nil {
					continue
				}
				if fn, ok := responses[pkt.Type]; ok {
					fn(pkt.Seq)
				}
			}
		}
	}()
}

// injectResponse creates a wire-encoded response and injects it into the mock.
func injectResponse(mock *transports.MockTransport, evtType byte, seq byte, payload []byte) {
	pkt := MakePacket(evtType, seq, payload)
	mock.Inject(WireEncode(pkt))
}

func TestDeviceConnect(t *testing.T) {
	mock := transports.NewMock()
	helloPayload := makeHelloRespPayload()

	responses := map[byte]func(seq byte){
		CmdHello: func(seq byte) {
			injectResponse(mock, EvtHelloResp, seq, helloPayload)
		},
	}
	autoResponder(mock, responses)

	dev := NewDevice(mock, 2*time.Second)
	ctx := context.Background()

	hello, err := dev.Connect(ctx)
	if err != nil {
		t.Fatalf("Connect failed: %v", err)
	}

	if hello.FirmwareName != "MockBoard" {
		t.Errorf("expected firmware name MockBoard, got %s", hello.FirmwareName)
	}
	if hello.FirmwareVersion != [3]byte{1, 0, 0} {
		t.Errorf("expected version 1.0.0, got %v", hello.FirmwareVersion)
	}
	if len(hello.Pins) != 20 {
		t.Errorf("expected 20 pins, got %d", len(hello.Pins))
	}
	if len(hello.Modules) != 1 {
		t.Errorf("expected 1 module, got %d", len(hello.Modules))
	}
	if hello.Modules[0].Name != "Servo" {
		t.Errorf("expected module name Servo, got %s", hello.Modules[0].Name)
	}
	if len(hello.Datastreams) != 1 {
		t.Errorf("expected 1 datastream, got %d", len(hello.Datastreams))
	}
	if hello.Datastreams[0].Name != "temperature" {
		t.Errorf("expected datastream name temperature, got %s", hello.Datastreams[0].Name)
	}

	_ = dev.Close()
}

func TestDevicePing(t *testing.T) {
	mock := transports.NewMock()
	helloPayload := makeHelloRespPayload()

	responses := map[byte]func(seq byte){
		CmdHello: func(seq byte) {
			injectResponse(mock, EvtHelloResp, seq, helloPayload)
		},
		CmdPing: func(seq byte) {
			injectResponse(mock, EvtPong, seq, nil)
		},
	}
	autoResponder(mock, responses)

	dev := NewDevice(mock, 2*time.Second)
	ctx := context.Background()

	_, err := dev.Connect(ctx)
	if err != nil {
		t.Fatalf("Connect failed: %v", err)
	}

	err = dev.Ping(ctx)
	if err != nil {
		t.Fatalf("Ping failed: %v", err)
	}

	_ = dev.Close()
}

func TestPinMode(t *testing.T) {
	mock := transports.NewMock()
	helloPayload := makeHelloRespPayload()

	responses := map[byte]func(seq byte){
		CmdHello: func(seq byte) {
			injectResponse(mock, EvtHelloResp, seq, helloPayload)
		},
		CmdPinMode: func(seq byte) {
			injectResponse(mock, EvtACK, seq, nil)
		},
	}
	autoResponder(mock, responses)

	dev := NewDevice(mock, 2*time.Second)
	ctx := context.Background()

	_, err := dev.Connect(ctx)
	if err != nil {
		t.Fatalf("Connect failed: %v", err)
	}

	err = dev.Pin(13).Mode(ctx, PinModeOutput)
	if err != nil {
		t.Fatalf("PinMode failed: %v", err)
	}

	// Verify the sent PIN_MODE packet
	found := false
	for _, raw := range mock.SentPackets {
		pkt, err := WireDecode(raw)
		if err != nil {
			continue
		}
		if pkt.Type == CmdPinMode {
			if len(pkt.Payload) != 2 || pkt.Payload[0] != 13 || pkt.Payload[1] != PinModeOutput {
				t.Errorf("unexpected PIN_MODE payload: %v", pkt.Payload)
			}
			found = true
			break
		}
	}
	if !found {
		t.Error("PIN_MODE packet not found in sent packets")
	}

	_ = dev.Close()
}

func TestPinWrite(t *testing.T) {
	mock := transports.NewMock()
	helloPayload := makeHelloRespPayload()

	responses := map[byte]func(seq byte){
		CmdHello: func(seq byte) {
			injectResponse(mock, EvtHelloResp, seq, helloPayload)
		},
		CmdPinWrite: func(seq byte) {
			injectResponse(mock, EvtACK, seq, nil)
		},
	}
	autoResponder(mock, responses)

	dev := NewDevice(mock, 2*time.Second)
	ctx := context.Background()

	_, err := dev.Connect(ctx)
	if err != nil {
		t.Fatalf("Connect failed: %v", err)
	}

	err = dev.Pin(13).Write(ctx, 1)
	if err != nil {
		t.Fatalf("PinWrite failed: %v", err)
	}

	// Verify the sent PIN_WRITE packet
	found := false
	for _, raw := range mock.SentPackets {
		pkt, err := WireDecode(raw)
		if err != nil {
			continue
		}
		if pkt.Type == CmdPinWrite {
			if len(pkt.Payload) != 2 || pkt.Payload[0] != 13 || pkt.Payload[1] != 1 {
				t.Errorf("unexpected PIN_WRITE payload: %v", pkt.Payload)
			}
			found = true
			break
		}
	}
	if !found {
		t.Error("PIN_WRITE packet not found in sent packets")
	}

	_ = dev.Close()
}

func TestPinRead(t *testing.T) {
	mock := transports.NewMock()
	helloPayload := makeHelloRespPayload()

	responses := map[byte]func(seq byte){
		CmdHello: func(seq byte) {
			injectResponse(mock, EvtHelloResp, seq, helloPayload)
		},
		CmdPinRead: func(seq byte) {
			// PIN_READ_RESP: [pin, value_lo, value_hi]
			payload := make([]byte, 3)
			payload[0] = 13
			binary.LittleEndian.PutUint16(payload[1:3], 512)
			injectResponse(mock, EvtPinReadResp, seq, payload)
		},
	}
	autoResponder(mock, responses)

	dev := NewDevice(mock, 2*time.Second)
	ctx := context.Background()

	_, err := dev.Connect(ctx)
	if err != nil {
		t.Fatalf("Connect failed: %v", err)
	}

	val, err := dev.Pin(13).Read(ctx)
	if err != nil {
		t.Fatalf("PinRead failed: %v", err)
	}
	if val != 512 {
		t.Errorf("expected pin read value 512, got %d", val)
	}

	_ = dev.Close()
}

func TestDeviceClose(t *testing.T) {
	mock := transports.NewMock()
	helloPayload := makeHelloRespPayload()

	responses := map[byte]func(seq byte){
		CmdHello: func(seq byte) {
			injectResponse(mock, EvtHelloResp, seq, helloPayload)
		},
	}
	autoResponder(mock, responses)

	dev := NewDevice(mock, 2*time.Second)
	ctx := context.Background()

	_, err := dev.Connect(ctx)
	if err != nil {
		t.Fatalf("Connect failed: %v", err)
	}

	err = dev.Close()
	if err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	if mock.Connected() {
		t.Error("transport should be disconnected after Close")
	}
}

func TestNAKError(t *testing.T) {
	mock := transports.NewMock()
	helloPayload := makeHelloRespPayload()

	responses := map[byte]func(seq byte){
		CmdHello: func(seq byte) {
			injectResponse(mock, EvtHelloResp, seq, helloPayload)
		},
		CmdPing: func(seq byte) {
			injectResponse(mock, EvtNAK, seq, []byte{ErrUnknownType})
		},
	}
	autoResponder(mock, responses)

	dev := NewDevice(mock, 2*time.Second)
	ctx := context.Background()

	_, err := dev.Connect(ctx)
	if err != nil {
		t.Fatalf("Connect failed: %v", err)
	}

	err = dev.Ping(ctx)
	if err == nil {
		t.Fatal("expected NAK error, got nil")
	}

	nakErr, ok := err.(*NAKError)
	if !ok {
		t.Fatalf("expected *NAKError, got %T: %v", err, err)
	}
	if nakErr.Code != ErrUnknownType {
		t.Errorf("expected NAK code 0x%02x, got 0x%02x", ErrUnknownType, nakErr.Code)
	}

	_ = dev.Close()
}

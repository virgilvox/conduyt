package conduyt_test

// End-to-end tests for module wrappers: spin a Device against a MockTransport,
// drive each module's commands, and verify the bytes that hit the wire match
// the protocol spec. These are *not* hardware tests — they cover the SDK's
// payload encoding, which is the contract the firmware-side native tests
// (firmware/test/test_native_modules) consume from the other side.

import (
	"context"
	"encoding/binary"
	"math"
	"testing"
	"time"

	conduyt "github.com/virgilvox/conduyt/sdk/go"
	"github.com/virgilvox/conduyt/sdk/go/modules/dht"
	"github.com/virgilvox/conduyt/sdk/go/modules/encoder"
	"github.com/virgilvox/conduyt/sdk/go/modules/neopixel"
	"github.com/virgilvox/conduyt/sdk/go/modules/oled"
	"github.com/virgilvox/conduyt/sdk/go/modules/pid"
	"github.com/virgilvox/conduyt/sdk/go/modules/servo"
	"github.com/virgilvox/conduyt/sdk/go/modules/stepper"
	"github.com/virgilvox/conduyt/sdk/go/transports"
)

// helloRespBytes mirrors the device_test.go fixture but is duplicated here
// so the external test package doesn't need access to the unexported one.
func helloRespBytes() []byte {
	var buf []byte
	name := make([]byte, 16)
	copy(name, "MockBoard")
	buf = append(buf, name...)
	buf = append(buf, 1, 0, 0)
	buf = append(buf, 0xDE, 0xAD, 0xBE, 0xEF, 0x01, 0x02, 0x03, 0x04)
	buf = append(buf, 0x01)
	buf = append(buf, 4)
	for i := 0; i < 4; i++ {
		buf = append(buf, 0x0F)
	}
	buf = append(buf, 1, 1, 1)
	mp := make([]byte, 2)
	binary.LittleEndian.PutUint16(mp, 256)
	buf = append(buf, mp...)
	buf = append(buf, 0) // 0 modules — we don't need HELLO module data; we pass module IDs explicitly
	buf = append(buf, 0) // 0 datastreams
	return buf
}

// ---------------------------------------------------------------------------
// Servo
// ---------------------------------------------------------------------------

func TestServoAttach(t *testing.T) {
	dev, mock := newAckingDevice(t)
	s := servo.New(dev, 0x07)
	if err := s.Attach(context.Background(), 9, 1000, 2000); err != nil {
		t.Fatalf("Attach: %v", err)
	}
	got := lastModCmd(t, mock)
	want := []byte{0x07, 0x01, 9, 0xE8, 0x03, 0xD0, 0x07}
	assertBytes(t, "Attach", got, want)
}

func TestServoWrite(t *testing.T) {
	dev, mock := newAckingDevice(t)
	s := servo.New(dev, 0x07)
	if err := s.Write(context.Background(), 90); err != nil {
		t.Fatalf("Write: %v", err)
	}
	got := lastModCmd(t, mock)
	assertBytes(t, "Write", got, []byte{0x07, 0x02, 90})
}

func TestServoWriteMicroseconds(t *testing.T) {
	dev, mock := newAckingDevice(t)
	s := servo.New(dev, 0x07)
	if err := s.WriteMicroseconds(context.Background(), 1500); err != nil {
		t.Fatalf("WriteMicroseconds: %v", err)
	}
	got := lastModCmd(t, mock)
	assertBytes(t, "WriteMicroseconds", got, []byte{0x07, 0x03, 0xDC, 0x05})
}

func TestServoDetach(t *testing.T) {
	dev, mock := newAckingDevice(t)
	s := servo.New(dev, 0x07)
	if err := s.Detach(context.Background()); err != nil {
		t.Fatalf("Detach: %v", err)
	}
	got := lastModCmd(t, mock)
	assertBytes(t, "Detach", got, []byte{0x07, 0x04})
}

// ---------------------------------------------------------------------------
// Helper: mock that always ACKs MOD_CMD
// ---------------------------------------------------------------------------

func newAckingDevice(t *testing.T) (*conduyt.Device, *transports.MockTransport) {
	t.Helper()
	mock := transports.NewMock()
	go func() {
		seen := 0
		for {
			time.Sleep(1 * time.Millisecond)
			for seen < len(mock.SentPackets) {
				raw := mock.SentPackets[seen]
				seen++
				pkt, err := conduyt.WireDecode(raw)
				if err != nil {
					continue
				}
				switch pkt.Type {
				case conduyt.CmdHello:
					p := conduyt.MakePacket(conduyt.EvtHelloResp, pkt.Seq, helloRespBytes())
					mock.Inject(conduyt.WireEncode(p))
				case conduyt.CmdModCmd:
					p := conduyt.MakePacket(conduyt.EvtACK, pkt.Seq, nil)
					mock.Inject(conduyt.WireEncode(p))
				}
			}
		}
	}()
	dev := conduyt.NewDevice(mock, 2*time.Second)
	if _, err := dev.Connect(context.Background()); err != nil {
		t.Fatalf("Connect: %v", err)
	}
	return dev, mock
}

// ---------------------------------------------------------------------------
// NeoPixel
// ---------------------------------------------------------------------------

func TestNeoPixelBegin(t *testing.T) {
	dev, mock := newAckingDevice(t)
	n := neopixel.New(dev, 0x03)
	if err := n.Begin(context.Background(), 6, 64, 0); err != nil {
		t.Fatalf("Begin: %v", err)
	}
	got := lastModCmd(t, mock)
	want := []byte{0x03, 0x01, 6, 0x40, 0x00, 0}
	assertBytes(t, "Begin", got, want)
}

func TestNeoPixelSetPixelNoWhite(t *testing.T) {
	dev, mock := newAckingDevice(t)
	n := neopixel.New(dev, 0x03)
	if err := n.SetPixel(context.Background(), 5, 255, 128, 0, 0); err != nil {
		t.Fatalf("SetPixel: %v", err)
	}
	got := lastModCmd(t, mock)
	want := []byte{0x03, 0x02, 5, 0, 255, 128, 0}
	assertBytes(t, "SetPixel", got, want)
}

func TestNeoPixelSetPixelWithWhite(t *testing.T) {
	dev, mock := newAckingDevice(t)
	n := neopixel.New(dev, 0x03)
	if err := n.SetPixel(context.Background(), 5, 255, 128, 0, 200); err != nil {
		t.Fatalf("SetPixel: %v", err)
	}
	got := lastModCmd(t, mock)
	want := []byte{0x03, 0x02, 5, 0, 255, 128, 0, 200}
	assertBytes(t, "SetPixel+W", got, want)
}

func TestNeoPixelSetRange(t *testing.T) {
	dev, mock := newAckingDevice(t)
	n := neopixel.New(dev, 0x03)
	if err := n.SetRange(context.Background(), 4, 8, 1, 2, 3); err != nil {
		t.Fatalf("SetRange: %v", err)
	}
	got := lastModCmd(t, mock)
	want := []byte{0x03, 0x03, 4, 0, 8, 0, 1, 2, 3}
	assertBytes(t, "SetRange", got, want)
}

func TestNeoPixelFill(t *testing.T) {
	dev, mock := newAckingDevice(t)
	n := neopixel.New(dev, 0x03)
	if err := n.Fill(context.Background(), 10, 20, 30, 0); err != nil {
		t.Fatalf("Fill: %v", err)
	}
	got := lastModCmd(t, mock)
	want := []byte{0x03, 0x04, 10, 20, 30}
	assertBytes(t, "Fill", got, want)
}

func TestNeoPixelShow(t *testing.T) {
	dev, mock := newAckingDevice(t)
	n := neopixel.New(dev, 0x03)
	if err := n.Show(context.Background()); err != nil {
		t.Fatalf("Show: %v", err)
	}
	got := lastModCmd(t, mock)
	want := []byte{0x03, 0x05}
	assertBytes(t, "Show", got, want)
}

func TestNeoPixelSetBrightness(t *testing.T) {
	dev, mock := newAckingDevice(t)
	n := neopixel.New(dev, 0x03)
	if err := n.SetBrightness(context.Background(), 200); err != nil {
		t.Fatalf("SetBrightness: %v", err)
	}
	got := lastModCmd(t, mock)
	want := []byte{0x03, 0x06, 200}
	assertBytes(t, "SetBrightness", got, want)
}

// ---------------------------------------------------------------------------
// OLED
// ---------------------------------------------------------------------------

func TestOLEDBegin(t *testing.T) {
	dev, mock := newAckingDevice(t)
	o := oled.New(dev, 0x05)
	if err := o.Begin(context.Background(), 128, 64, 0x3C); err != nil {
		t.Fatalf("Begin: %v", err)
	}
	got := lastModCmd(t, mock)
	want := []byte{0x05, 0x01, 128, 64, 0x3C}
	assertBytes(t, "Begin", got, want)
}

func TestOLEDText(t *testing.T) {
	dev, mock := newAckingDevice(t)
	o := oled.New(dev, 0x05)
	if err := o.Text(context.Background(), 0, 8, 1, "Hi"); err != nil {
		t.Fatalf("Text: %v", err)
	}
	got := lastModCmd(t, mock)
	want := []byte{0x05, 0x03, 0, 8, 1, 'H', 'i'}
	assertBytes(t, "Text", got, want)
}

func TestOLEDDrawRectFilled(t *testing.T) {
	dev, mock := newAckingDevice(t)
	o := oled.New(dev, 0x05)
	if err := o.DrawRect(context.Background(), 1, 2, 3, 4, true); err != nil {
		t.Fatalf("DrawRect: %v", err)
	}
	got := lastModCmd(t, mock)
	want := []byte{0x05, 0x04, 1, 2, 3, 4, 1}
	assertBytes(t, "DrawRect", got, want)
}

func TestOLEDShow(t *testing.T) {
	dev, mock := newAckingDevice(t)
	o := oled.New(dev, 0x05)
	if err := o.Show(context.Background()); err != nil {
		t.Fatalf("Show: %v", err)
	}
	got := lastModCmd(t, mock)
	want := []byte{0x05, 0x06}
	assertBytes(t, "Show", got, want)
}

// ---------------------------------------------------------------------------
// DHT
// ---------------------------------------------------------------------------

func TestDHTBegin(t *testing.T) {
	dev, mock := newAckingDevice(t)
	d := dht.New(dev, 0x09)
	if err := d.Begin(context.Background(), 4, 22); err != nil {
		t.Fatalf("Begin: %v", err)
	}
	got := lastModCmd(t, mock)
	want := []byte{0x09, 0x01, 4, 22}
	assertBytes(t, "Begin", got, want)
}

func TestDHTReadDecodesFloat32s(t *testing.T) {
	mock := transports.NewMock()
	tempBits := math.Float32bits(23.5)
	humBits := math.Float32bits(45.0)
	respPayload := []byte{
		0x09, // module id echo
		byte(tempBits), byte(tempBits >> 8), byte(tempBits >> 16), byte(tempBits >> 24),
		byte(humBits), byte(humBits >> 8), byte(humBits >> 16), byte(humBits >> 24),
	}
	go func() {
		seen := 0
		for {
			time.Sleep(1 * time.Millisecond)
			for seen < len(mock.SentPackets) {
				raw := mock.SentPackets[seen]
				seen++
				pkt, err := conduyt.WireDecode(raw)
				if err != nil {
					continue
				}
				switch pkt.Type {
				case conduyt.CmdHello:
					p := conduyt.MakePacket(conduyt.EvtHelloResp, pkt.Seq, helloRespBytes())
					mock.Inject(conduyt.WireEncode(p))
				case conduyt.CmdModCmd:
					p := conduyt.MakePacket(conduyt.EvtModResp, pkt.Seq, respPayload)
					mock.Inject(conduyt.WireEncode(p))
				}
			}
		}
	}()
	dev := conduyt.NewDevice(mock, 2*time.Second)
	if _, err := dev.Connect(context.Background()); err != nil {
		t.Fatalf("Connect: %v", err)
	}

	d := dht.New(dev, 0x09)
	r, err := d.Read(context.Background())
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	if r.TemperatureC != 23.5 {
		t.Errorf("temp = %v, want 23.5", r.TemperatureC)
	}
	if r.HumidityPct != 45.0 {
		t.Errorf("humidity = %v, want 45.0", r.HumidityPct)
	}
}

// ---------------------------------------------------------------------------
// Encoder
// ---------------------------------------------------------------------------

func TestEncoderAttach(t *testing.T) {
	dev, mock := newAckingDevice(t)
	e := encoder.New(dev, 0x0A)
	if err := e.Attach(context.Background(), 2, 3); err != nil {
		t.Fatalf("Attach: %v", err)
	}
	got := lastModCmd(t, mock)
	want := []byte{0x0A, 0x01, 2, 3}
	assertBytes(t, "Attach", got, want)
}

func TestEncoderReadDecodesInt32(t *testing.T) {
	mock := transports.NewMock()
	count := int32(-12345)
	respPayload := []byte{
		0x0A,
		byte(count), byte(count >> 8), byte(count >> 16), byte(count >> 24),
	}
	go func() {
		seen := 0
		for {
			time.Sleep(1 * time.Millisecond)
			for seen < len(mock.SentPackets) {
				raw := mock.SentPackets[seen]
				seen++
				pkt, err := conduyt.WireDecode(raw)
				if err != nil {
					continue
				}
				switch pkt.Type {
				case conduyt.CmdHello:
					p := conduyt.MakePacket(conduyt.EvtHelloResp, pkt.Seq, helloRespBytes())
					mock.Inject(conduyt.WireEncode(p))
				case conduyt.CmdModCmd:
					p := conduyt.MakePacket(conduyt.EvtModResp, pkt.Seq, respPayload)
					mock.Inject(conduyt.WireEncode(p))
				}
			}
		}
	}()
	dev := conduyt.NewDevice(mock, 2*time.Second)
	if _, err := dev.Connect(context.Background()); err != nil {
		t.Fatalf("Connect: %v", err)
	}
	e := encoder.New(dev, 0x0A)
	got, err := e.Read(context.Background())
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	if got != -12345 {
		t.Errorf("count = %d, want -12345", got)
	}
}

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

func TestStepperConfig(t *testing.T) {
	dev, mock := newAckingDevice(t)
	s := stepper.New(dev, 0x0C)
	if err := s.Config(context.Background(), 2, 3, 4, 200); err != nil {
		t.Fatalf("Config: %v", err)
	}
	got := lastModCmd(t, mock)
	want := []byte{0x0C, 0x01, 2, 3, 4, 0xC8, 0x00}
	assertBytes(t, "Config", got, want)
}

func TestStepperMoveNegative(t *testing.T) {
	dev, mock := newAckingDevice(t)
	s := stepper.New(dev, 0x0C)
	if err := s.Move(context.Background(), -100, 1000); err != nil {
		t.Fatalf("Move: %v", err)
	}
	got := lastModCmd(t, mock)
	// -100 LE = 9C FF FF FF; speed 1000 = E8 03
	want := []byte{0x0C, 0x02, 0x9C, 0xFF, 0xFF, 0xFF, 0xE8, 0x03}
	assertBytes(t, "Move", got, want)
}

// ---------------------------------------------------------------------------
// PID
// ---------------------------------------------------------------------------

func TestPIDConfigEncodesFloats(t *testing.T) {
	dev, mock := newAckingDevice(t)
	p := pid.New(dev, 0x0E)
	if err := p.Config(context.Background(), 1.0, 0.5, 0.1); err != nil {
		t.Fatalf("Config: %v", err)
	}
	got := lastModCmd(t, mock)
	expected := make([]byte, 14)
	expected[0] = 0x0E
	expected[1] = 0x01
	binary.LittleEndian.PutUint32(expected[2:6], math.Float32bits(1.0))
	binary.LittleEndian.PutUint32(expected[6:10], math.Float32bits(0.5))
	binary.LittleEndian.PutUint32(expected[10:14], math.Float32bits(0.1))
	assertBytes(t, "Config", got, expected)
}

func TestPIDEnableDisable(t *testing.T) {
	dev, mock := newAckingDevice(t)
	p := pid.New(dev, 0x0E)
	if err := p.Enable(context.Background()); err != nil {
		t.Fatalf("Enable: %v", err)
	}
	assertBytes(t, "Enable", lastModCmd(t, mock), []byte{0x0E, 0x05, 1})

	if err := p.Disable(context.Background()); err != nil {
		t.Fatalf("Disable: %v", err)
	}
	assertBytes(t, "Disable", lastModCmd(t, mock), []byte{0x0E, 0x05, 0})
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func lastModCmd(t *testing.T, mock *transports.MockTransport) []byte {
	t.Helper()
	for i := len(mock.SentPackets) - 1; i >= 0; i-- {
		pkt, err := conduyt.WireDecode(mock.SentPackets[i])
		if err != nil {
			continue
		}
		if pkt.Type == conduyt.CmdModCmd {
			return pkt.Payload
		}
	}
	t.Fatalf("no MOD_CMD found")
	return nil
}

func assertBytes(t *testing.T, label string, got, want []byte) {
	t.Helper()
	if !equalBytes(got, want) {
		t.Errorf("%s: got % X, want % X", label, got, want)
	}
}

func equalBytes(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

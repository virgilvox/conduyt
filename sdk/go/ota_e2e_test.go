package conduyt_test

import (
	"context"
	"crypto/sha256"
	"testing"
	"time"

	conduyt "github.com/virgilvox/conduyt/sdk/go"
	"github.com/virgilvox/conduyt/sdk/go/ota"
	"github.com/virgilvox/conduyt/sdk/go/transports"
)

// helloOTACapableBytes builds a HELLO_RESP advertising OTA + 128-byte max payload.
func helloOTACapableBytes() []byte {
	var buf []byte
	name := make([]byte, 16)
	copy(name, "OTAMock")
	buf = append(buf, name...)
	buf = append(buf, 1, 0, 0)
	buf = append(buf, 0xDE, 0xAD, 0xBE, 0xEF, 0x01, 0x02, 0x03, 0x04)
	buf = append(buf, 0x01)               // ota_capable
	buf = append(buf, 4)                  // pin_count
	for i := 0; i < 4; i++ {
		buf = append(buf, 0x0F)
	}
	buf = append(buf, 1, 0, 1)
	buf = append(buf, 0x80, 0x00) // max_payload = 128
	buf = append(buf, 0)          // 0 modules
	buf = append(buf, 0)          // 0 datastreams
	return buf
}

// otaConnectedDevice spins up a connected Device whose mock auto-ACKs every
// OTA_BEGIN / OTA_CHUNK / OTA_FINALIZE.
func otaConnectedDevice(t *testing.T) (*conduyt.Device, *transports.MockTransport) {
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
					p := conduyt.MakePacket(conduyt.EvtHelloResp, pkt.Seq, helloOTACapableBytes())
					mock.Inject(conduyt.WireEncode(p))
				case conduyt.CmdOTABegin, conduyt.CmdOTAChunk, conduyt.CmdOTAFinalize:
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

// findOTACommands returns the payloads of every OTA_BEGIN/CHUNK/FINALIZE sent.
func findOTACommands(t *testing.T, mock *transports.MockTransport, cmdType byte) [][]byte {
	t.Helper()
	out := [][]byte{}
	for _, raw := range mock.SentPackets {
		pkt, err := conduyt.WireDecode(raw)
		if err != nil {
			continue
		}
		if pkt.Type == cmdType {
			out = append(out, pkt.Payload)
		}
	}
	return out
}

func TestOTAFlashRejectsEmpty(t *testing.T) {
	dev, _ := otaConnectedDevice(t)
	if err := ota.Flash(context.Background(), dev, []byte{}, ota.Options{}); err == nil {
		t.Fatalf("expected empty firmware error")
	}
}

func TestOTABeginCarriesTotalAndSha256(t *testing.T) {
	dev, mock := otaConnectedDevice(t)
	fw := make([]byte, 50)
	for i := range fw {
		fw[i] = byte(i)
	}
	if err := ota.Flash(context.Background(), dev, fw, ota.Options{ChunkSize: 64}); err != nil {
		t.Fatalf("Flash: %v", err)
	}

	begins := findOTACommands(t, mock, conduyt.CmdOTABegin)
	if len(begins) != 1 {
		t.Fatalf("want 1 OTA_BEGIN, got %d", len(begins))
	}
	if len(begins[0]) != 36 {
		t.Fatalf("BEGIN payload = %d bytes, want 36", len(begins[0]))
	}
	// total_bytes LE u32 = 50
	got := uint32(begins[0][0]) | uint32(begins[0][1])<<8 | uint32(begins[0][2])<<16 | uint32(begins[0][3])<<24
	if got != 50 {
		t.Errorf("total = %d, want 50", got)
	}
	// SHA-256 must match crypto/sha256 of the firmware
	want := sha256.Sum256(fw)
	for i := 0; i < 32; i++ {
		if begins[0][4+i] != want[i] {
			t.Errorf("sha256[%d] = %#x, want %#x", i, begins[0][4+i], want[i])
		}
	}
}

func TestOTAChunksHaveLeU32Offset(t *testing.T) {
	dev, mock := otaConnectedDevice(t)
	fw := make([]byte, 300)
	for i := range fw {
		fw[i] = byte(i & 0xFF)
	}
	if err := ota.Flash(context.Background(), dev, fw, ota.Options{ChunkSize: 100}); err != nil {
		t.Fatalf("Flash: %v", err)
	}

	chunks := findOTACommands(t, mock, conduyt.CmdOTAChunk)
	if len(chunks) != 3 {
		t.Fatalf("want 3 chunks, got %d", len(chunks))
	}
	wantOffsets := []uint32{0, 100, 200}
	for i, c := range chunks {
		off := uint32(c[0]) | uint32(c[1])<<8 | uint32(c[2])<<16 | uint32(c[3])<<24
		if off != wantOffsets[i] {
			t.Errorf("chunk[%d] offset = %d, want %d", i, off, wantOffsets[i])
		}
		if len(c) != 4+100 {
			t.Errorf("chunk[%d] len = %d, want 104", i, len(c))
		}
	}
}

func TestOTAHandlesPartialFinalChunk(t *testing.T) {
	dev, mock := otaConnectedDevice(t)
	if err := ota.Flash(context.Background(), dev, make([]byte, 150), ota.Options{ChunkSize: 100}); err != nil {
		t.Fatalf("Flash: %v", err)
	}

	chunks := findOTACommands(t, mock, conduyt.CmdOTAChunk)
	if len(chunks) != 2 || len(chunks[0]) != 4+100 || len(chunks[1]) != 4+50 {
		t.Fatalf("got chunks of len %d / %d, want 104 / 54",
			len(chunks[0]), len(chunks[1]))
	}
}

func TestOTAFinalizesAfterLastChunk(t *testing.T) {
	dev, mock := otaConnectedDevice(t)
	if err := ota.Flash(context.Background(), dev, make([]byte, 16), ota.Options{ChunkSize: 16}); err != nil {
		t.Fatalf("Flash: %v", err)
	}

	finals := findOTACommands(t, mock, conduyt.CmdOTAFinalize)
	if len(finals) != 1 {
		t.Fatalf("want 1 OTA_FINALIZE, got %d", len(finals))
	}
	if len(finals[0]) != 0 {
		t.Errorf("FINALIZE payload should be empty, got %d bytes", len(finals[0]))
	}
}

func TestOTAProgressCallback(t *testing.T) {
	dev, _ := otaConnectedDevice(t)
	calls := [][2]int{}
	if err := ota.Flash(context.Background(), dev, make([]byte, 250), ota.Options{
		ChunkSize: 100,
		OnProgress: func(sent, total int) {
			calls = append(calls, [2]int{sent, total})
		},
	}); err != nil {
		t.Fatalf("Flash: %v", err)
	}
	want := [][2]int{{100, 250}, {200, 250}, {250, 250}}
	if len(calls) != len(want) {
		t.Fatalf("got %d progress calls, want %d", len(calls), len(want))
	}
	for i := range want {
		if calls[i] != want[i] {
			t.Errorf("call[%d] = %v, want %v", i, calls[i], want[i])
		}
	}
}

func TestOTARejectsWrongShaLength(t *testing.T) {
	dev, _ := otaConnectedDevice(t)
	if err := ota.Flash(context.Background(), dev, []byte{1, 2, 3},
		ota.Options{ChunkSize: 16, SHA256: make([]byte, 16)}); err == nil {
		t.Fatalf("expected wrong-sha-length error")
	}
}

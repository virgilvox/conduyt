package conduyt

import (
	"context"
	"encoding/binary"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/virgilvox/conduyt/sdk/go/transports"
)

// Device is a high-level CONDUYT device client.
type Device struct {
	transport transports.Transport
	timeout   time.Duration
	seq       byte
	mu        sync.Mutex
	pending   map[byte]chan *Packet
	hello     *HelloResp
	done      chan struct{}
}

// NewDevice creates a new Device with the given transport.
func NewDevice(t transports.Transport, timeout time.Duration) *Device {
	if timeout == 0 {
		timeout = 5 * time.Second
	}
	return &Device{
		transport: t,
		timeout:   timeout,
		pending:   make(map[byte]chan *Packet),
		done:      make(chan struct{}),
	}
}

// Connect performs the HELLO handshake.
func (d *Device) Connect(ctx context.Context) (*HelloResp, error) {
	if err := d.transport.Connect(); err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}

	go d.recvLoop()

	resp, err := d.sendCommand(ctx, CmdHello, nil)
	if err != nil {
		return nil, fmt.Errorf("hello: %w", err)
	}

	hello, err := ParseHelloResp(resp.Payload)
	if err != nil {
		return nil, fmt.Errorf("parse hello: %w", err)
	}
	d.hello = hello
	return hello, nil
}

// Close closes the device connection.
func (d *Device) Close() error {
	close(d.done)
	d.mu.Lock()
	for _, ch := range d.pending {
		close(ch)
	}
	d.pending = make(map[byte]chan *Packet)
	d.mu.Unlock()
	return d.transport.Close()
}

// Ping sends a PING and waits for PONG.
func (d *Device) Ping(ctx context.Context) error {
	_, err := d.sendCommand(ctx, CmdPing, nil)
	return err
}

// Reset sends a RESET command.
func (d *Device) Reset(ctx context.Context) error {
	_, err := d.sendCommand(ctx, CmdReset, nil)
	return err
}

// Pin returns a PinProxy for the given pin number.
func (d *Device) Pin(n byte) *PinProxy {
	return &PinProxy{device: d, pin: n}
}

// PinByName returns a PinProxy from a name like "A0", "A5", or "13".
// Analog names (A0-A15) auto-set the proxy to analog mode.
func (d *Device) PinByName(name string) (*PinProxy, error) {
	m := analogPinRe.FindStringSubmatch(name)
	if m != nil {
		n, _ := strconv.Atoi(m[1])
		return &PinProxy{device: d, pin: byte(n), isAnalog: true}, nil
	}
	n, err := strconv.Atoi(strings.TrimSpace(name))
	if err != nil {
		return nil, fmt.Errorf("invalid pin name: %q", name)
	}
	return &PinProxy{device: d, pin: byte(n)}, nil
}

// Capabilities returns the parsed HELLO_RESP, or nil if not connected.
func (d *Device) Capabilities() *HelloResp {
	return d.hello
}

// ModCmd sends a MOD_CMD and waits for ACK/MOD_RESP. Returns the response
// payload (empty for ACK, populated for MOD_RESP). Module commands that
// only ACK can ignore the byte slice; commands like Encoder.Read or
// DHT.Read need the bytes.
func (d *Device) ModCmd(ctx context.Context, payload []byte) ([]byte, error) {
	resp, err := d.sendCommand(ctx, CmdModCmd, payload)
	if err != nil {
		return nil, err
	}
	if resp == nil {
		return nil, nil
	}
	return resp.Payload, nil
}

// OTABegin starts an OTA update. sha256 must be exactly 32 bytes. The
// firmware allocates space + verifies the digest at finalize time.
func (d *Device) OTABegin(ctx context.Context, totalBytes uint32, sha256 []byte) error {
	if len(sha256) != 32 {
		return fmt.Errorf("OTABegin: sha256 must be 32 bytes, got %d", len(sha256))
	}
	payload := make([]byte, 36)
	binary.LittleEndian.PutUint32(payload[0:4], totalBytes)
	copy(payload[4:36], sha256)
	_, err := d.sendCommand(ctx, CmdOTABegin, payload)
	return err
}

// OTAChunk sends one OTA chunk. Offsets must be sequential — the firmware
// NAKs out-of-order chunks with OTA_INVALID.
func (d *Device) OTAChunk(ctx context.Context, offset uint32, data []byte) error {
	payload := make([]byte, 4+len(data))
	binary.LittleEndian.PutUint32(payload[0:4], offset)
	copy(payload[4:], data)
	_, err := d.sendCommand(ctx, CmdOTAChunk, payload)
	return err
}

// OTAFinalize finalizes the update. Firmware verifies the SHA256 and reboots
// into the new image. The next round-trip will fail until you reconnect.
func (d *Device) OTAFinalize(ctx context.Context) error {
	_, err := d.sendCommand(ctx, CmdOTAFinalize, nil)
	return err
}

// sendCommand sends a command and waits for the response.
func (d *Device) sendCommand(ctx context.Context, cmdType byte, payload []byte) (*Packet, error) {
	d.mu.Lock()
	seq := d.seq
	d.seq++
	ch := make(chan *Packet, 1)
	d.pending[seq] = ch
	d.mu.Unlock()

	pkt := MakePacket(cmdType, seq, payload)
	encoded := WireEncode(pkt)

	if err := d.transport.Send(encoded); err != nil {
		d.mu.Lock()
		delete(d.pending, seq)
		d.mu.Unlock()
		return nil, err
	}

	ctx2, cancel := context.WithTimeout(ctx, d.timeout)
	defer cancel()

	select {
	case resp, ok := <-ch:
		if !ok {
			return nil, fmt.Errorf("connection closed")
		}
		if resp.Type == EvtNAK {
			code := byte(0)
			if len(resp.Payload) > 0 {
				code = resp.Payload[0]
			}
			return nil, NewNAKError(code, seq)
		}
		return resp, nil
	case <-ctx2.Done():
		d.mu.Lock()
		delete(d.pending, seq)
		d.mu.Unlock()
		return nil, &TimeoutError{Seq: seq, TimeoutMs: int(d.timeout.Milliseconds())}
	}
}

func (d *Device) recvLoop() {
	for {
		select {
		case <-d.done:
			return
		default:
		}

		raw, err := d.transport.Recv()
		if err != nil {
			return
		}

		pkt, err := WireDecode(raw)
		if err != nil {
			continue
		}

		d.mu.Lock()
		ch, ok := d.pending[pkt.Seq]
		if ok {
			delete(d.pending, pkt.Seq)
		}
		d.mu.Unlock()

		if ok {
			ch <- pkt
		}
	}
}

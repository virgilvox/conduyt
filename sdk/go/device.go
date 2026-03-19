package conduyt

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/conduyt-io/conduyt-go/transports"
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

// Capabilities returns the parsed HELLO_RESP, or nil if not connected.
func (d *Device) Capabilities() *HelloResp {
	return d.hello
}

// ModCmd sends a MOD_CMD and waits for ACK/response.
func (d *Device) ModCmd(ctx context.Context, payload []byte) error {
	_, err := d.sendCommand(ctx, CmdModCmd, payload)
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

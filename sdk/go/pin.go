package conduyt

import (
	"context"
	"encoding/binary"
	"fmt"
)

// PinMode constants.
const (
	PinModeInput       = 0x00
	PinModeOutput      = 0x01
	PinModePWM         = 0x02
	PinModeAnalog      = 0x03
	PinModeInputPullup = 0x04
)

// PinProxy provides pin-level control.
type PinProxy struct {
	device *Device
	pin    byte
}

// Mode sets the pin mode.
func (p *PinProxy) Mode(ctx context.Context, mode byte) error {
	_, err := p.device.sendCommand(ctx, CmdPinMode, []byte{p.pin, mode})
	return err
}

// Write writes a digital value or PWM duty.
func (p *PinProxy) Write(ctx context.Context, value byte) error {
	_, err := p.device.sendCommand(ctx, CmdPinWrite, []byte{p.pin, value})
	return err
}

// Read reads the pin value (16-bit).
func (p *PinProxy) Read(ctx context.Context) (uint16, error) {
	resp, err := p.device.sendCommand(ctx, CmdPinRead, []byte{p.pin})
	if err != nil {
		return 0, err
	}
	if len(resp.Payload) >= 3 {
		return binary.LittleEndian.Uint16(resp.Payload[1:3]), nil
	}
	return 0, fmt.Errorf("unexpected payload length: %d", len(resp.Payload))
}

// Subscribe creates a pin subscription and returns a channel of values.
func (p *PinProxy) Subscribe(ctx context.Context, mode byte, intervalMs uint16, threshold uint16) (<-chan uint16, context.CancelFunc, error) {
	payload := make([]byte, 6)
	payload[0] = p.pin
	payload[1] = mode
	binary.LittleEndian.PutUint16(payload[2:4], intervalMs)
	binary.LittleEndian.PutUint16(payload[4:6], threshold)

	_, err := p.device.sendCommand(ctx, CmdPinSubscribe, payload)
	if err != nil {
		return nil, nil, err
	}

	ch := make(chan uint16, 16)
	subCtx, cancel := context.WithCancel(ctx)

	go func() {
		<-subCtx.Done()
		close(ch)
		// Best effort unsubscribe
		unsub := []byte{p.pin}
		_ = p.device.transport.Send(WireEncode(MakePacket(CmdPinUnsubscribe, 0, unsub)))
	}()

	return ch, cancel, nil
}

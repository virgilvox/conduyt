// Package pid provides a typed wrapper for the CONDUYT PID controller module.
package pid

import (
	"context"
	"encoding/binary"
	"math"

	conduyt "github.com/virgilvox/conduyt/sdk/go"
)

// PID provides typed control of an on-device PID loop.
type PID struct {
	device   *conduyt.Device
	moduleID byte
}

// New creates a PID wrapper for the given device and module ID.
func New(device *conduyt.Device, moduleID byte) *PID {
	return &PID{device: device, moduleID: moduleID}
}

// Config sets the proportional/integral/derivative gains.
func (p *PID) Config(ctx context.Context, kp, ki, kd float32) error {
	payload := make([]byte, 14)
	payload[0] = p.moduleID
	payload[1] = 0x01
	binary.LittleEndian.PutUint32(payload[2:6], math.Float32bits(kp))
	binary.LittleEndian.PutUint32(payload[6:10], math.Float32bits(ki))
	binary.LittleEndian.PutUint32(payload[10:14], math.Float32bits(kd))
	_, err := p.device.ModCmd(ctx, payload)
	return err
}

// SetTarget sets the controller setpoint.
func (p *PID) SetTarget(ctx context.Context, value float32) error {
	payload := make([]byte, 6)
	payload[0] = p.moduleID
	payload[1] = 0x02
	binary.LittleEndian.PutUint32(payload[2:6], math.Float32bits(value))
	_, err := p.device.ModCmd(ctx, payload)
	return err
}

// SetInput sets the analog input pin.
func (p *PID) SetInput(ctx context.Context, pin byte) error {
	_, err := p.device.ModCmd(ctx, []byte{p.moduleID, 0x03, pin})
	return err
}

// SetOutput sets the PWM output pin.
func (p *PID) SetOutput(ctx context.Context, pin byte) error {
	_, err := p.device.ModCmd(ctx, []byte{p.moduleID, 0x04, pin})
	return err
}

// Enable activates the controller.
func (p *PID) Enable(ctx context.Context) error {
	_, err := p.device.ModCmd(ctx, []byte{p.moduleID, 0x05, 1})
	return err
}

// Disable suspends the controller (gains and target are retained).
func (p *PID) Disable(ctx context.Context) error {
	_, err := p.device.ModCmd(ctx, []byte{p.moduleID, 0x05, 0})
	return err
}

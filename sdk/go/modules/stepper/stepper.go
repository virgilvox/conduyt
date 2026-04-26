// Package stepper provides a typed wrapper for the CONDUYT stepper-driver module.
package stepper

import (
	"context"
	"encoding/binary"

	conduyt "github.com/virgilvox/conduyt/sdk/go"
)

// Stepper provides typed control of a step/dir/enable stepper driver.
type Stepper struct {
	device   *conduyt.Device
	moduleID byte
}

// New creates a Stepper wrapper for the given device and module ID.
func New(device *conduyt.Device, moduleID byte) *Stepper {
	return &Stepper{device: device, moduleID: moduleID}
}

// Config sets the driver pins. Pass enPin=0xFF if the driver has no enable line.
func (s *Stepper) Config(ctx context.Context, stepPin, dirPin, enPin byte, stepsPerRev uint16) error {
	payload := make([]byte, 7)
	payload[0] = s.moduleID
	payload[1] = 0x01
	payload[2] = stepPin
	payload[3] = dirPin
	payload[4] = enPin
	binary.LittleEndian.PutUint16(payload[5:7], stepsPerRev)
	_, err := s.device.ModCmd(ctx, payload)
	return err
}

// Move runs the stepper a relative number of steps (negative reverses) at speedHz.
func (s *Stepper) Move(ctx context.Context, steps int32, speedHz uint16) error {
	payload := make([]byte, 8)
	payload[0] = s.moduleID
	payload[1] = 0x02
	binary.LittleEndian.PutUint32(payload[2:6], uint32(steps))
	binary.LittleEndian.PutUint16(payload[6:8], speedHz)
	_, err := s.device.ModCmd(ctx, payload)
	return err
}

// MoveTo runs the stepper to absolute position at speedHz.
func (s *Stepper) MoveTo(ctx context.Context, position int32, speedHz uint16) error {
	payload := make([]byte, 8)
	payload[0] = s.moduleID
	payload[1] = 0x03
	binary.LittleEndian.PutUint32(payload[2:6], uint32(position))
	binary.LittleEndian.PutUint16(payload[6:8], speedHz)
	_, err := s.device.ModCmd(ctx, payload)
	return err
}

// Stop halts the stepper immediately.
func (s *Stepper) Stop(ctx context.Context) error {
	_, err := s.device.ModCmd(ctx, []byte{s.moduleID, 0x04})
	return err
}

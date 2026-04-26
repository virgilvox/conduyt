// Package servo provides a typed wrapper for the CONDUYT servo module.
package servo

import (
	"context"
	"encoding/binary"

	conduyt "github.com/virgilvox/conduyt/sdk/go"
)

// Servo provides typed control of a servo module.
type Servo struct {
	device   *conduyt.Device
	moduleID byte
}

// New creates a Servo wrapper for the given device and module ID.
func New(device *conduyt.Device, moduleID byte) *Servo {
	return &Servo{device: device, moduleID: moduleID}
}

// Attach attaches the servo to a pin.
func (s *Servo) Attach(ctx context.Context, pin byte, minUs, maxUs uint16) error {
	payload := make([]byte, 7)
	payload[0] = s.moduleID
	payload[1] = 0x01
	payload[2] = pin
	binary.LittleEndian.PutUint16(payload[3:5], minUs)
	binary.LittleEndian.PutUint16(payload[5:7], maxUs)
	_, err := s.device.ModCmd(ctx, payload)
	return err
}

// Write writes an angle (0-180).
func (s *Servo) Write(ctx context.Context, angle byte) error {
	_, err := s.device.ModCmd(ctx, []byte{s.moduleID, 0x02, angle})
	return err
}

// WriteMicroseconds writes a pulse width.
func (s *Servo) WriteMicroseconds(ctx context.Context, us uint16) error {
	payload := make([]byte, 4)
	payload[0] = s.moduleID
	payload[1] = 0x03
	binary.LittleEndian.PutUint16(payload[2:4], us)
	_, err := s.device.ModCmd(ctx, payload)
	return err
}

// Detach releases the servo pin.
func (s *Servo) Detach(ctx context.Context) error {
	_, err := s.device.ModCmd(ctx, []byte{s.moduleID, 0x04})
	return err
}

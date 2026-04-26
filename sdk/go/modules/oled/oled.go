// Package oled provides a typed wrapper for the CONDUYT SSD1306 OLED module.
package oled

import (
	"context"

	conduyt "github.com/virgilvox/conduyt/sdk/go"
)

// OLED provides typed control of an SSD1306 monochrome display.
type OLED struct {
	device   *conduyt.Device
	moduleID byte
}

// New creates an OLED wrapper for the given device and module ID.
func New(device *conduyt.Device, moduleID byte) *OLED {
	return &OLED{device: device, moduleID: moduleID}
}

// Begin initializes the display. addr=0 falls back to 0x3C on the firmware side.
func (o *OLED) Begin(ctx context.Context, width, height, addr byte) error {
	_, err := o.device.ModCmd(ctx, []byte{o.moduleID, 0x01, width, height, addr})
	return err
}

// Clear empties the off-screen buffer. Call Show to apply.
func (o *OLED) Clear(ctx context.Context) error {
	_, err := o.device.ModCmd(ctx, []byte{o.moduleID, 0x02})
	return err
}

// Text renders a string into the off-screen buffer.
func (o *OLED) Text(ctx context.Context, x, y, size byte, s string) error {
	str := []byte(s)
	payload := make([]byte, 5+len(str))
	payload[0] = o.moduleID
	payload[1] = 0x03
	payload[2] = x
	payload[3] = y
	payload[4] = size
	copy(payload[5:], str)
	_, err := o.device.ModCmd(ctx, payload)
	return err
}

// DrawRect draws a rectangle outline (or filled rect when fill=true).
func (o *OLED) DrawRect(ctx context.Context, x, y, w, h byte, fill bool) error {
	var f byte
	if fill {
		f = 1
	}
	_, err := o.device.ModCmd(ctx, []byte{o.moduleID, 0x04, x, y, w, h, f})
	return err
}

// DrawBitmap draws a 1-bit bitmap. data must hold ceil(w*h/8) bytes.
func (o *OLED) DrawBitmap(ctx context.Context, x, y, w, h byte, data []byte) error {
	payload := make([]byte, 6+len(data))
	payload[0] = o.moduleID
	payload[1] = 0x05
	payload[2] = x
	payload[3] = y
	payload[4] = w
	payload[5] = h
	copy(payload[6:], data)
	_, err := o.device.ModCmd(ctx, payload)
	return err
}

// Show flushes the off-screen buffer to the panel.
func (o *OLED) Show(ctx context.Context) error {
	_, err := o.device.ModCmd(ctx, []byte{o.moduleID, 0x06})
	return err
}

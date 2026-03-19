package conduyt

import "fmt"

// NAKError is returned when the device replies with a NAK packet.
type NAKError struct {
	Code     byte
	Name     string
	Seq      byte
}

func (e *NAKError) Error() string {
	return fmt.Sprintf("NAK: %s (code=0x%02x, seq=%d)", e.Name, e.Code, e.Seq)
}

// NewNAKError creates a NAKError from a code and seq.
func NewNAKError(code, seq byte) *NAKError {
	name, ok := ErrNames[code]
	if !ok {
		name = fmt.Sprintf("UNKNOWN_0x%02x", code)
	}
	return &NAKError{Code: code, Name: name, Seq: seq}
}

// TimeoutError is returned when a command times out.
type TimeoutError struct {
	Seq       byte
	TimeoutMs int
}

func (e *TimeoutError) Error() string {
	return fmt.Sprintf("timeout: no response for seq=%d after %dms", e.Seq, e.TimeoutMs)
}

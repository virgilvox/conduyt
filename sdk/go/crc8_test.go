package conduyt

import "testing"

func TestCRC8Empty(t *testing.T) {
	if got := CRC8([]byte{}); got != 0x00 {
		t.Errorf("CRC8(empty) = 0x%02x, want 0x00", got)
	}
}

func TestCRC8SingleZero(t *testing.T) {
	if got := CRC8([]byte{0x00}); got != 0x00 {
		t.Errorf("CRC8([0x00]) = 0x%02x, want 0x00", got)
	}
}

func TestCRC8Single0x01(t *testing.T) {
	if got := CRC8([]byte{0x01}); got != 0x31 {
		t.Errorf("CRC8([0x01]) = 0x%02x, want 0x31", got)
	}
}

func TestCRC8Deterministic(t *testing.T) {
	data := []byte{0x47, 0x46, 0x01, 0x02}
	a := CRC8(data)
	b := CRC8(data)
	if a != b {
		t.Errorf("CRC8 not deterministic: %02x != %02x", a, b)
	}
}

func TestCRC8DifferentData(t *testing.T) {
	a := CRC8([]byte{0x01, 0x02, 0x03})
	b := CRC8([]byte{0x01, 0x02, 0x04})
	if a == b {
		t.Error("CRC8 should produce different values for different data")
	}
}

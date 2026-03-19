package conduyt

import (
	"bytes"
	"testing"
)

func TestCOBSRoundTrips(t *testing.T) {
	vectors := [][]byte{
		{},
		{0x00},
		{0x42},
		{0x00, 0x00},
		{0x11, 0x22, 0x00, 0x33},
		{0x11, 0x22, 0x33, 0x44},
		{0, 1, 2, 0, 3, 0, 0, 4, 5, 6, 7, 0, 8},
	}

	for _, data := range vectors {
		encoded := COBSEncode(data)

		// Verify no zeros in encoded
		for i, b := range encoded {
			if b == 0x00 {
				t.Errorf("COBSEncode(%v) has zero at index %d", data, i)
			}
		}

		decoded, err := COBSDecode(encoded)
		if err != nil {
			t.Errorf("COBSDecode failed for %v: %v", data, err)
			continue
		}
		if !bytes.Equal(decoded, data) {
			t.Errorf("COBS round-trip mismatch: got %v, want %v", decoded, data)
		}
	}
}

func TestCOBSKnownVector(t *testing.T) {
	data := []byte{0x11, 0x22, 0x00, 0x33}
	expected := []byte{0x03, 0x11, 0x22, 0x02, 0x33}
	encoded := COBSEncode(data)
	if !bytes.Equal(encoded, expected) {
		t.Errorf("COBSEncode(%v) = %v, want %v", data, encoded, expected)
	}
}

func TestCOBSDecodeEmpty(t *testing.T) {
	_, err := COBSDecode([]byte{})
	if err == nil {
		t.Error("COBSDecode(empty) should fail")
	}
}

func TestCOBSDecodeZero(t *testing.T) {
	_, err := COBSDecode([]byte{0x00, 0x01})
	if err == nil {
		t.Error("COBSDecode with zero should fail")
	}
}

package conduyt

import "errors"

var ErrCOBSDecode = errors.New("COBS decode error")

// COBSEncode encodes data using COBS. Output never contains 0x00.
func COBSEncode(src []byte) []byte {
	if len(src) == 0 {
		return []byte{0x01}
	}

	dst := make([]byte, 0, len(src)+len(src)/254+2)
	dst = append(dst, 0) // placeholder for first code
	codeIdx := 0
	code := byte(1)

	for _, b := range src {
		if b == 0x00 {
			dst[codeIdx] = code
			codeIdx = len(dst)
			dst = append(dst, 0)
			code = 1
		} else {
			dst = append(dst, b)
			code++
			if code == 0xFF {
				dst[codeIdx] = code
				codeIdx = len(dst)
				dst = append(dst, 0)
				code = 1
			}
		}
	}
	dst[codeIdx] = code
	return dst
}

// COBSDecode decodes COBS-encoded data.
func COBSDecode(src []byte) ([]byte, error) {
	if len(src) == 0 {
		return nil, ErrCOBSDecode
	}

	dst := make([]byte, 0, len(src))
	idx := 0

	for idx < len(src) {
		code := src[idx]
		idx++
		if code == 0x00 {
			return nil, ErrCOBSDecode
		}

		count := int(code) - 1
		if idx+count > len(src) {
			return nil, ErrCOBSDecode
		}

		dst = append(dst, src[idx:idx+count]...)
		idx += count

		if code < 0xFF && idx < len(src) {
			dst = append(dst, 0x00)
		}
	}
	return dst, nil
}

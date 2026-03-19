// Package transports defines the Transport interface for CONDUYT connections.
package transports

// Transport is the interface all CONDUYT transports must implement.
type Transport interface {
	// Connect establishes the connection.
	Connect() error

	// Close cleanly closes the connection.
	Close() error

	// Send sends a raw wire-encoded packet.
	Send(packet []byte) error

	// Recv blocks until a packet is received or context is cancelled.
	Recv() ([]byte, error)

	// Connected returns whether the transport is currently connected.
	Connected() bool

	// NeedsCOBS returns whether this transport requires COBS framing.
	NeedsCOBS() bool
}

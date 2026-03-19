"""Mock Transport for testing."""

from __future__ import annotations

from typing import Callable


class MockTransport:
    """In-memory transport for testing. No real I/O."""

    def __init__(self) -> None:
        self._connected = False
        self._handler: Callable[[bytes], None] | None = None
        self.sent_packets: list[bytes] = []
        self.needs_cobs = False

    @property
    def connected(self) -> bool:
        return self._connected

    async def connect(self) -> None:
        self._connected = True

    async def disconnect(self) -> None:
        self._connected = False
        self._handler = None

    async def send(self, packet: bytes) -> None:
        if not self._connected:
            raise RuntimeError("MockTransport: not connected")
        self.sent_packets.append(bytes(packet))

    def on_receive(self, handler: Callable[[bytes], None]) -> None:
        self._handler = handler

    def inject(self, packet: bytes) -> None:
        """Inject a packet as if the device sent it."""
        if self._handler:
            self._handler(bytes(packet))

    def clear_sent(self) -> None:
        self.sent_packets.clear()

    @property
    def last_sent(self) -> bytes | None:
        return self.sent_packets[-1] if self.sent_packets else None

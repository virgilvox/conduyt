"""CONDUYT Serial Transport — pyserial-asyncio"""

from __future__ import annotations

from typing import Callable

try:
    import serial_asyncio
except ImportError:
    serial_asyncio = None  # type: ignore[assignment]


class SerialTransport:
    """Async serial transport using pyserial-asyncio."""

    def __init__(self, port: str, baudrate: int = 115200) -> None:
        if serial_asyncio is None:
            raise ImportError("pyserial-asyncio is required: pip install conduyt-py[serial]")
        self._port = port
        self._baudrate = baudrate
        self._reader: object | None = None
        self._writer: object | None = None
        self._connected = False
        self._handler: Callable[[bytes], None] | None = None
        self._task: object | None = None
        self.needs_cobs = True

    @property
    def connected(self) -> bool:
        return self._connected

    async def connect(self) -> None:
        import asyncio
        self._reader, self._writer = await serial_asyncio.open_serial_connection(
            url=self._port, baudrate=self._baudrate,
        )
        self._connected = True
        self._task = asyncio.create_task(self._read_loop())

    async def disconnect(self) -> None:
        self._connected = False
        if self._writer:
            self._writer.close()
        self._reader = None
        self._writer = None

    async def send(self, packet: bytes) -> None:
        if not self._connected or not self._writer:
            raise RuntimeError("SerialTransport: not connected")
        self._writer.write(packet)
        await self._writer.drain()

    def on_receive(self, handler: Callable[[bytes], None]) -> None:
        self._handler = handler

    async def _read_loop(self) -> None:
        buf = bytearray()
        while self._connected and self._reader:
            try:
                data = await self._reader.read(1024)
                if not data:
                    break
                buf.extend(data)
                while b"\x00" in buf:
                    idx = buf.index(b"\x00")
                    frame = bytes(buf[:idx])
                    buf = buf[idx + 1:]
                    if frame and self._handler:
                        from conduyt.core.cobs import cobs_decode
                        decoded = cobs_decode(frame)
                        if decoded is not None:
                            self._handler(decoded)
            except Exception:
                break
        self._connected = False

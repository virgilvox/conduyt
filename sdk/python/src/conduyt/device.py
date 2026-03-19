"""CONDUYT Device — async host-side SDK"""

from __future__ import annotations

import asyncio
from typing import Any

from conduyt.core.constants import CMD, EVT, PROTOCOL_VERSION
from conduyt.core.wire import wire_encode, wire_decode, make_packet, ConduytPacket
from conduyt.core.errors import ConduytNAKError, ConduytTimeoutError, ConduytDisconnectedError


class ConduytDevice:
    """Async CONDUYT device controller."""

    def __init__(self, transport: Any, timeout_ms: int = 5000) -> None:
        self._transport = transport
        self._timeout_ms = timeout_ms
        self._seq = 0
        self._pending: dict[int, asyncio.Future[bytes]] = {}
        self._hello: Any = None

    @property
    def connected(self) -> bool:
        return self._transport.connected

    @property
    def capabilities(self) -> Any:
        return self._hello

    async def connect(self) -> Any:
        """Connect and perform HELLO handshake."""
        await self._transport.connect()
        self._transport.on_receive(self._on_receive)

        hello_payload = await self._send_command(CMD.HELLO)
        from conduyt.hello import parse_hello_resp
        self._hello = parse_hello_resp(hello_payload)
        return self._hello

    async def disconnect(self) -> None:
        self._reject_all(ConduytDisconnectedError())
        await self._transport.disconnect()
        self._hello = None

    async def ping(self) -> None:
        await self._send_command(CMD.PING)

    async def reset(self) -> None:
        await self._send_command(CMD.RESET)

    def pin(self, num: int) -> _PinProxy:
        return _PinProxy(self, num)

    async def _send_command(self, cmd_type: int, payload: bytes = b"") -> bytes:
        if not self._transport.connected:
            raise ConduytDisconnectedError()

        seq = self._next_seq()
        pkt = make_packet(cmd_type, seq, payload)
        encoded = wire_encode(pkt)

        loop = asyncio.get_running_loop()
        future: asyncio.Future[bytes] = loop.create_future()
        self._pending[seq] = future

        await self._transport.send(encoded)

        try:
            return await asyncio.wait_for(future, timeout=self._timeout_ms / 1000)
        except asyncio.TimeoutError:
            self._pending.pop(seq, None)
            raise ConduytTimeoutError(seq, self._timeout_ms)

    def _next_seq(self) -> int:
        seq = self._seq
        self._seq = (self._seq + 1) & 0xFF
        return seq

    def _on_receive(self, raw: bytes) -> None:
        try:
            pkt = wire_decode(raw)
        except ValueError:
            return

        if pkt.type == EVT.ACK:
            self._resolve(pkt.seq, b"")
        elif pkt.type == EVT.NAK:
            code = pkt.payload[0] if pkt.payload else 0
            self._reject(pkt.seq, ConduytNAKError(code, pkt.seq))
        elif pkt.type == EVT.PONG:
            self._resolve(pkt.seq, b"")
        elif pkt.type == EVT.HELLO_RESP:
            self._resolve(pkt.seq, pkt.payload)
        elif pkt.type == EVT.PIN_READ_RESP:
            self._resolve(pkt.seq, pkt.payload)
        elif pkt.type == EVT.MOD_RESP:
            self._resolve(pkt.seq, pkt.payload)
        elif pkt.type == EVT.I2C_READ_RESP:
            self._resolve(pkt.seq, pkt.payload)
        elif pkt.type == EVT.SPI_XFER_RESP:
            self._resolve(pkt.seq, pkt.payload)

    def _resolve(self, seq: int, data: bytes) -> None:
        future = self._pending.pop(seq, None)
        if future and not future.done():
            future.set_result(data)

    def _reject(self, seq: int, error: Exception) -> None:
        future = self._pending.pop(seq, None)
        if future and not future.done():
            future.set_exception(error)

    def _reject_all(self, error: Exception) -> None:
        for future in self._pending.values():
            if not future.done():
                future.set_exception(error)
        self._pending.clear()


class _PinProxy:
    def __init__(self, device: ConduytDevice, pin: int) -> None:
        self._device = device
        self._pin = pin

    async def mode(self, mode: str) -> "_PinProxy":
        modes = {"input": 0, "output": 1, "pwm": 2, "analog": 3, "input_pullup": 4}
        code = modes.get(mode)
        if code is None:
            raise ValueError(f"Unknown pin mode: {mode}")
        await self._device._send_command(CMD.PIN_MODE, bytes([self._pin, code]))
        return self

    async def write(self, value: int) -> None:
        await self._device._send_command(CMD.PIN_WRITE, bytes([self._pin, value & 0xFF]))

    async def read(self) -> int:
        resp = await self._device._send_command(CMD.PIN_READ, bytes([self._pin]))
        if len(resp) >= 3:
            return resp[1] | (resp[2] << 8)
        return 0

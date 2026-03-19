"""CONDUYT MQTT Transport — aiomqtt"""

from __future__ import annotations

import asyncio
from typing import Callable

try:
    import aiomqtt
except ImportError:
    aiomqtt = None  # type: ignore[assignment]


class MQTTTransport:
    """Async MQTT transport using aiomqtt."""

    def __init__(
        self,
        broker: str,
        port: int = 1883,
        device_id: str = "conduyt-device",
        username: str | None = None,
        password: str | None = None,
    ) -> None:
        if aiomqtt is None:
            raise ImportError("aiomqtt is required: pip install conduyt-py[mqtt]")
        self._broker = broker
        self._port = port
        self._device_id = device_id
        self._username = username
        self._password = password
        self._client: object | None = None
        self._connected = False
        self._handler: Callable[[bytes], None] | None = None
        self._task: asyncio.Task[None] | None = None
        self.needs_cobs = False

    @property
    def connected(self) -> bool:
        return self._connected

    async def connect(self) -> None:
        self._client = aiomqtt.Client(
            self._broker,
            port=self._port,
            username=self._username,
            password=self._password,
        )
        await self._client.__aenter__()  # type: ignore[union-attr]
        await self._client.subscribe(f"conduyt/{self._device_id}/evt/#")  # type: ignore[union-attr]
        self._connected = True
        self._task = asyncio.create_task(self._listen())

    async def disconnect(self) -> None:
        self._connected = False
        if self._client:
            await self._client.__aexit__(None, None, None)  # type: ignore[union-attr]
        self._client = None

    async def send(self, packet: bytes) -> None:
        if not self._connected or not self._client:
            raise RuntimeError("MQTTTransport: not connected")
        await self._client.publish(  # type: ignore[union-attr]
            f"conduyt/{self._device_id}/cmd",
            payload=packet,
            qos=1,
        )

    def on_receive(self, handler: Callable[[bytes], None]) -> None:
        self._handler = handler

    async def _listen(self) -> None:
        try:
            async for message in self._client.messages:  # type: ignore[union-attr]
                if self._handler and message.payload:
                    self._handler(bytes(message.payload))
        except Exception:
            self._connected = False

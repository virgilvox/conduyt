"""Synchronous convenience wrapper for scripting."""

from __future__ import annotations

import asyncio
from typing import Any

from conduyt.device import ConduytDevice


class ConduytDeviceSync:
    """Blocking wrapper around the async ConduytDevice."""

    def __init__(self, transport: Any, timeout_ms: int = 5000) -> None:
        self._device = ConduytDevice(transport, timeout_ms)
        self._loop = asyncio.new_event_loop()

    def connect(self) -> dict[str, Any]:
        return self._loop.run_until_complete(self._device.connect())

    def disconnect(self) -> None:
        self._loop.run_until_complete(self._device.disconnect())

    def ping(self) -> None:
        self._loop.run_until_complete(self._device.ping())

    def reset(self) -> None:
        self._loop.run_until_complete(self._device.reset())

    def pin(self, num: int) -> _SyncPinProxy:
        return _SyncPinProxy(self._loop, self._device.pin(num))

    @property
    def capabilities(self) -> dict[str, Any] | None:
        return self._device.capabilities

    def close(self) -> None:
        self._loop.close()


class _SyncPinProxy:
    def __init__(self, loop: asyncio.AbstractEventLoop, pin: Any) -> None:
        self._loop = loop
        self._pin = pin

    def mode(self, mode: str) -> "_SyncPinProxy":
        self._loop.run_until_complete(self._pin.mode(mode))
        return self

    def write(self, value: int) -> None:
        self._loop.run_until_complete(self._pin.write(value))

    def read(self) -> int:
        return self._loop.run_until_complete(self._pin.read())

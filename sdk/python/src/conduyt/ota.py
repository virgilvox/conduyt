"""CONDUYT OTA — Over-the-Air firmware update orchestrator.

Wraps the device.ota_begin / ota_chunk / ota_finalize primitives with:
  - SHA-256 of the firmware image computed via hashlib.
  - Sequential chunk send with progress callbacks.
  - Auto-sized chunks based on the device's advertised maxPayload.

Only useful when the firmware was compiled with `-DCONDUYT_OTA`. Check
``device.capabilities.ota_capable`` before starting; the device will NAK
``OTA_BEGIN`` with ``OTA_INVALID`` (0x0F) if OTA isn't built in.
"""

from __future__ import annotations

import hashlib
from typing import Awaitable, Callable, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .device import ConduytDevice

ProgressCallback = Callable[[int, int], None]


class ConduytOTA:
    """Async helper that flashes a firmware image to a connected device."""

    def __init__(self, device: "ConduytDevice") -> None:
        self._device = device

    async def flash(
        self,
        firmware: bytes,
        *,
        chunk_size: Optional[int] = None,
        on_progress: Optional[ProgressCallback] = None,
        sha256: Optional[bytes] = None,
    ) -> None:
        """Flash a firmware image. Resolves once OTA_FINALIZE acks.

        The device typically reboots immediately after — the next round-trip
        will fail until you reconnect.

        Args:
            firmware: The firmware bytes to flash.
            chunk_size: Bytes per OTA_CHUNK. Defaults to (max_payload - 4).
            on_progress: Optional callback ``fn(sent, total)`` after each chunk.
            sha256: Optional pre-computed SHA-256 of `firmware`.
        """
        total = len(firmware)
        if total == 0:
            raise ValueError("OTA: firmware is empty")

        digest = sha256 if sha256 is not None else hashlib.sha256(firmware).digest()

        # Pick a chunk size. Reserve 4 bytes for the LE u32 offset header.
        caps = self._device.capabilities
        advertised = getattr(caps, "max_payload", None) if caps else None
        safe_max = max(64, advertised - 4) if advertised else 240
        size = chunk_size if chunk_size is not None else safe_max

        await self._device.ota_begin(total, digest)
        sent = 0
        while sent < total:
            end = min(sent + size, total)
            await self._device.ota_chunk(sent, firmware[sent:end])
            sent = end
            if on_progress:
                on_progress(sent, total)
        await self._device.ota_finalize()

"""ConduytOTA — async OTA orchestration tests."""

import hashlib
from unittest.mock import AsyncMock

import pytest

from conduyt.device import ConduytDevice
from conduyt.transports.mock import MockTransport
from conduyt.core.constants import CMD
from conduyt.ota import ConduytOTA


@pytest.fixture
def mock_device():
    """Device with mocked _send_command that captures every call."""
    transport = MockTransport()
    device = ConduytDevice(transport)
    device._send_command = AsyncMock(return_value=b"")
    return device


def _calls_by_type(device, cmd_type):
    """Return a list of payload bytes for every _send_command(cmd_type, payload) call."""
    out = []
    for call in device._send_command.call_args_list:
        args, _kwargs = call
        if args[0] == cmd_type:
            out.append(args[1] if len(args) > 1 else b"")
    return out


@pytest.mark.asyncio
async def test_rejects_empty_firmware(mock_device):
    ota = ConduytOTA(mock_device)
    with pytest.raises(ValueError, match="empty"):
        await ota.flash(b"")


@pytest.mark.asyncio
async def test_begin_carries_total_and_sha256(mock_device):
    ota = ConduytOTA(mock_device)
    fw = bytes(range(50))
    await ota.flash(fw, chunk_size=64)

    begins = _calls_by_type(mock_device, CMD.OTA_BEGIN)
    assert len(begins) == 1
    payload = begins[0]
    assert len(payload) == 36
    # total_bytes LE u32 = 50
    assert int.from_bytes(payload[0:4], "little") == 50
    # sha256 matches what hashlib produces
    assert payload[4:36] == hashlib.sha256(fw).digest()


@pytest.mark.asyncio
async def test_chunks_with_le_u32_offset_header(mock_device):
    ota = ConduytOTA(mock_device)
    fw = bytes(b & 0xFF for b in range(300))
    await ota.flash(fw, chunk_size=100)

    chunks = _calls_by_type(mock_device, CMD.OTA_CHUNK)
    assert len(chunks) == 3   # 100 + 100 + 100

    assert int.from_bytes(chunks[0][0:4], "little") == 0
    assert chunks[0][4] == 0
    assert chunks[0][103] == 99

    assert int.from_bytes(chunks[1][0:4], "little") == 100
    assert chunks[1][4] == 100

    assert int.from_bytes(chunks[2][0:4], "little") == 200
    assert chunks[2][4] == 200


@pytest.mark.asyncio
async def test_handles_final_partial_chunk(mock_device):
    ota = ConduytOTA(mock_device)
    fw = b"\xAB" * 150
    await ota.flash(fw, chunk_size=100)

    chunks = _calls_by_type(mock_device, CMD.OTA_CHUNK)
    assert len(chunks) == 2
    assert len(chunks[0]) == 4 + 100
    assert len(chunks[1]) == 4 + 50
    assert int.from_bytes(chunks[1][0:4], "little") == 100


@pytest.mark.asyncio
async def test_finalizes_after_last_chunk(mock_device):
    ota = ConduytOTA(mock_device)
    await ota.flash(b"hello world", chunk_size=16)

    finals = _calls_by_type(mock_device, CMD.OTA_FINALIZE)
    assert len(finals) == 1
    assert finals[0] == b""


@pytest.mark.asyncio
async def test_progress_callback_fires_per_chunk(mock_device):
    ota = ConduytOTA(mock_device)
    calls = []
    await ota.flash(
        b"\x00" * 250,
        chunk_size=100,
        on_progress=lambda sent, total: calls.append((sent, total)),
    )
    assert calls == [(100, 250), (200, 250), (250, 250)]


@pytest.mark.asyncio
async def test_accepts_precomputed_sha256(mock_device):
    ota = ConduytOTA(mock_device)
    custom_sha = b"\xAB" + b"\x00" * 30 + b"\xCD"
    await ota.flash(b"\x00" * 10, chunk_size=16, sha256=custom_sha)

    begins = _calls_by_type(mock_device, CMD.OTA_BEGIN)
    assert begins[0][4:36] == custom_sha


@pytest.mark.asyncio
async def test_rejects_wrong_sha_length(mock_device):
    ota = ConduytOTA(mock_device)
    with pytest.raises(ValueError, match="32 bytes"):
        await ota.flash(b"\x00" * 10, chunk_size=16, sha256=b"\x00" * 16)

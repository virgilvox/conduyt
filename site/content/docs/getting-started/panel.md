---
title: "The Panel"
description: "A Blynk-style dashboard built into the Playground. Switches, sliders, gauges — capability-aware, per-pin."
---

# The Panel

The Panel is a built-in dashboard for poking at your board without writing code. Open the [Playground](/playground), connect a CONDUYT device, click **Panel** in the toolbar, and start adding widgets.

It's not a separate app — it shares the same serial port and the same connection state as the rest of the playground. Run a script to drive your board, then jump into the Panel to live-tweak a PWM channel without leaving the page.

## Widgets

| Widget | Direction | Required pin capability |
|---|---|---|
| Digital switch | output | `DIGITAL_OUT` |
| Push button (momentary) | output | `DIGITAL_OUT` |
| PWM slider (0–255) | output | `PWM_OUT` |
| LED indicator | input (polled @100ms) | `DIGITAL_IN` |
| Analog gauge | input (polled @200ms) | `ANALOG_IN` |
| Pin scope (oscilloscope) | input (polled @50ms) | `ANALOG_IN` |

Each widget binds to a pin via a dropdown. The dropdown is filtered to **only the pins that actually advertise the required capability** in the firmware's HELLO_RESP. You can't bind a PWM slider to a non-PWM pin or an analog gauge to a digital-only pin — the option simply doesn't appear.

This is the v0.3 capability-model paying off. Earlier firmware ships under-declared a lot of capabilities (the playground's old "Permissive mode" toggle worked around that). With v0.3 firmware flashed, the Panel's filtering matches the silicon's actual hardware.

## Permissive mode

If you flash a board the library doesn't have a profile for, or if the firmware's HELLO_RESP is incomplete, toggle **Permissive** in the Panel header. This bypasses the capability filter and shows every pin in every dropdown. Use it as an escape hatch — most of the time you should leave it off.

## How it interacts with the rest of the playground

- **The connection is shared.** Click **Connect** in the toolbar (or in the Panel — same button). Both the script runner and the Panel use the same serial port. You can't double-connect.
- **The widget config persists** to `localStorage` between sessions. Close the tab, come back, your dashboard is still there.
- **Polling is live.** Input widgets (LED, gauge, scope) issue PIN_READ commands on a per-widget interval and update in place. Disconnecting stops polling cleanly.
- **The runner and the Panel can coexist.** Running a script while the Panel is open works — both share the same serial transport. Be aware that they each track their own packet sequence numbers, so a long-running script that sends commands at the same time as the Panel's polling can in rare cases produce a stray timeout. Stop one or the other if you see this.

## Capability backstop

The firmware library validates incoming `PIN_MODE`/`PIN_READ` against the same per-board profile that drives the Panel's widget filtering. If a host (somehow) sends a request the pin doesn't support, the firmware NAKs `PIN_MODE_UNSUPPORTED` rather than touching unsafe hardware. The most consequential example: on the Renesas RA4M1 (Uno R4), `analogRead()` on a non-ADC pin would block the firmware indefinitely waiting on a conversion that never completes. The Panel's filtering plus the firmware-side guard makes that bug unreachable.

## Custom shields and unsupported boards

If you've wired a custom shield that changes a pin's role (e.g. an external interrupt on a normally-uninteresting GPIO), or if the board's profile is missing, you can override capabilities from your sketch:

```cpp
device.declarePinCaps(8, CONDUYT_PIN_CAP_DIGITAL_OUT | CONDUYT_PIN_CAP_PWM_OUT);
device.declareI2cBus(1, /*sda*/ 27, /*scl*/ 26);
device.declareSpiBus(0, /*cs*/ 10, /*copi*/ 11, /*cipo*/ 12, /*sck*/ 13);
```

These overrides are merged into HELLO_RESP at handshake time, so the Panel's dropdowns and the firmware's guards both reflect them — no playground-side configuration needed.

See [the capability model docs](/docs/concepts/capability-model) for the design rationale.

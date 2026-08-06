#!/usr/bin/env python3
"""Generate assets/sounds/remy-critical.wav — the bundled critical-alert tone.

iOS plays this file when an APNs payload carries `sound: {critical: 1, name: "remy-critical.wav"}`.
Constraints: <= 30s, and it must be in the app bundle (the expo-notifications plugin's
`sounds` array copies it there at prebuild time).

Run: python3 scripts/make-alert-sound.py
"""

import math
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 44100
OUT = Path(__file__).resolve().parent.parent / "assets" / "sounds" / "remy-critical.wav"

# Two-tone alarm: high/low pairs, three times. Deliberately unlike any default iOS tone.
PATTERN = [(880.0, 0.22), (0.0, 0.06), (660.0, 0.22), (0.0, 0.28)] * 3


def tone(freq: float, seconds: float) -> list[int]:
    n = int(SAMPLE_RATE * seconds)
    if freq == 0.0:
        return [0] * n
    fade = int(SAMPLE_RATE * 0.008)  # short fade prevents clicks at segment edges
    out = []
    for i in range(n):
        env = min(1.0, i / fade, (n - i) / fade)
        # Fundamental plus a fifth, for a tone that cuts through ambient noise.
        s = 0.62 * math.sin(2 * math.pi * freq * i / SAMPLE_RATE)
        s += 0.22 * math.sin(2 * math.pi * freq * 1.5 * i / SAMPLE_RATE)
        out.append(int(max(-1.0, min(1.0, s * env)) * 32767))
    return out


def main() -> None:
    samples: list[int] = []
    for freq, seconds in PATTERN:
        samples.extend(tone(freq, seconds))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(struct.pack(f"<{len(samples)}h", *samples))

    print(f"wrote {OUT} ({len(samples) / SAMPLE_RATE:.2f}s, {OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

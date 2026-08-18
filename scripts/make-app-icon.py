#!/usr/bin/env python3
"""Generate the app icon set from assets/Remy.png.

The source is a wide wordmark with an alpha channel — neither of which works as
an iOS icon. App Store Connect **rejects** icons containing transparency, and a
922x295 wordmark is illegible once iOS scales it to 60x60. So we crop the "R"
(which carries the camera-lens mark, the one part that reads at small sizes),
centre it on an opaque canvas, and flatten the alpha away.

Run: python3 scripts/make-app-icon.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "Remy.png"
IMAGES = ROOT / "assets" / "images"

WHITE = (255, 255, 255)
BRAND = (67, 89, 153)  # #435999, sampled from the wordmark

# Column span of the "R" glyph in the source, found by scanning for empty
# columns between glyphs. Re-derive with scripts/ if the logo is ever redrawn.
R_COLUMNS = (77, 277)

CANVAS = 1024
# Fraction of the canvas the glyph fills. iOS already crops to a rounded
# rectangle, so leaving ~20% margin keeps the mark clear of the corner radius.
FILL = 0.62


def flatten(image: Image.Image, background: tuple[int, int, int]) -> Image.Image:
    """Composite RGBA onto a solid colour and drop the alpha channel."""
    canvas = Image.new("RGBA", image.size, (*background, 255))
    return Image.alpha_composite(canvas, image.convert("RGBA")).convert("RGB")


def crop_r(source: Image.Image) -> Image.Image:
    """The R glyph, tightly cropped, still on transparency."""
    left, right = R_COLUMNS
    column = source.crop((left, 0, right, source.height))
    # Trim vertically using the ink itself rather than assuming a baseline.
    ink = flatten(column, WHITE).convert("L").point(lambda p: 255 if p < 220 else 0)
    box = ink.getbbox()
    return column.crop((0, box[1], column.width, box[3]))


def compose(glyph: Image.Image, background: tuple[int, int, int]) -> Image.Image:
    """Centre the glyph on an opaque square canvas."""
    scale = (CANVAS * FILL) / max(glyph.width, glyph.height)
    resized = glyph.resize(
        (max(1, round(glyph.width * scale)), max(1, round(glyph.height * scale))),
        Image.LANCZOS,
    )
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (*background, 255))
    canvas.alpha_composite(
        resized.convert("RGBA"),
        ((CANVAS - resized.width) // 2, (CANVAS - resized.height) // 2),
    )
    return canvas.convert("RGB")


def notification_glyph(glyph: Image.Image) -> Image.Image:
    """
    Android status-bar icon: a pure white silhouette on transparency. Android
    ignores colour here and masks by alpha, so anything else renders as a blob.
    """
    scale = (CANVAS * 0.70) / max(glyph.width, glyph.height)
    resized = glyph.resize(
        (max(1, round(glyph.width * scale)), max(1, round(glyph.height * scale))),
        Image.LANCZOS,
    )
    silhouette = Image.new("RGBA", resized.size, (255, 255, 255, 0))
    silhouette.putalpha(resized.convert("RGBA").getchannel("A"))

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (255, 255, 255, 0))
    canvas.paste(
        silhouette,
        ((CANVAS - resized.width) // 2, (CANVAS - resized.height) // 2),
    )
    return canvas


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    glyph = crop_r(source)

    outputs = {
        # The App Store icon. RGB, no alpha — this is the one Apple validates.
        IMAGES / "icon.png": compose(glyph, WHITE),
        # Android adaptive foreground sits on its own coloured layer.
        IMAGES / "android-icon-foreground.png": compose(glyph, WHITE),
        IMAGES / "splash-icon.png": compose(glyph, WHITE),
        IMAGES / "favicon.png": compose(glyph, WHITE).resize((48, 48), Image.LANCZOS),
        IMAGES / "notification-icon.png": notification_glyph(glyph),
    }

    for path, image in outputs.items():
        image.save(path)
        mode = image.mode
        alpha = "alpha" if mode == "RGBA" else "opaque"
        print(f"wrote {path.relative_to(ROOT)}  {image.size[0]}x{image.size[1]}  {mode} ({alpha})")


if __name__ == "__main__":
    main()

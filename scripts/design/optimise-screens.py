"""Shrinks the captures in docs/design/screens so that they are reasonable to keep in git.

    python3 scripts/design/optimise-screens.py [directory]

Each PNG is reduced to an adaptive palette of 256 colours without dithering. The interface
uses a small palette, so text and hairlines stay crisp and files shrink by roughly two thirds.
Run it after `node scripts/design/screenshots.mjs`. Needs Pillow (`pip install pillow`).
"""

import pathlib
import sys

from PIL import Image

directory = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "docs/design/screens")
before = after = 0
for path in sorted(directory.glob("*.png")):
    before += path.stat().st_size
    with Image.open(path) as image:
        if image.mode != "P":
            reduced = image.convert("RGB").quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
            reduced.save(path, optimize=True)
    after += path.stat().st_size
print(f"{directory}: {before / 1_048_576:.1f} MB -> {after / 1_048_576:.1f} MB")

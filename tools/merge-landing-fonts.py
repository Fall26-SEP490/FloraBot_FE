"""Merge installed Latin/Vietnamese font subsets without changing glyph shapes or metrics."""

from pathlib import Path
import shutil

from fontTools.merge import Merger
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont


root = Path(__file__).resolve().parents[1]
package = root / "apps/web/node_modules/@fontsource/be-vietnam-pro"
output = root / "apps/web/src/marketing/assets/fonts"
output.mkdir(parents=True, exist_ok=True)

for weight in (400, 600, 800):
    paths = [package / f"files/be-vietnam-pro-{subset}-{weight}-normal.woff2"
             for subset in ("latin", "vietnamese")]
    sources = [TTFont(path) for path in paths]
    merged = Merger().merge([str(path) for path in paths])
    merged.recalcTimestamp = False
    glyphs = merged.getGlyphSet()
    cmap = merged.getBestCmap()
    assert set(cmap) == set().union(*(font.getBestCmap() for font in sources))
    for source in sources:
        for table, attributes in {
            "head": ("unitsPerEm",),
            "hhea": ("ascent", "descent", "lineGap"),
            "OS/2": ("sTypoAscender", "sTypoDescender", "sTypoLineGap", "usWinAscent", "usWinDescent"),
        }.items():
            for attribute in attributes:
                assert getattr(source[table], attribute) == getattr(merged[table], attribute)
        source_glyphs = source.getGlyphSet()
        for codepoint, glyph in source.getBestCmap().items():
            target = cmap[codepoint]
            before = DecomposingRecordingPen(source_glyphs)
            after = DecomposingRecordingPen(glyphs)
            source_glyphs[glyph].draw(before)
            glyphs[target].draw(after)
            assert before.value == after.value, f"Outline changed: {weight} U+{codepoint:04X}"
            assert source["hmtx"][glyph] == merged["hmtx"][target], f"Width changed: {weight} U+{codepoint:04X}"
    for flavor in ("woff2", "woff"):
        merged.flavor = flavor
        merged.save(output / f"be-vietnam-pro-latin-vietnamese-{weight}.{flavor}")
    print(f"{weight}: {len(cmap)} codepoints preserved; "
          f"{sum(path.stat().st_size for path in paths)} -> "
          f"{(output / f'be-vietnam-pro-latin-vietnamese-{weight}.woff2').stat().st_size} bytes")
    for font in sources:
        font.close()
    merged.close()

shutil.copyfile(package / "LICENSE", output / "LICENSE-Be-Vietnam-Pro.txt")

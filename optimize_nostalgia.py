"""One-off: downscale Nostalgia photos to web-friendly sizes."""
import re
from pathlib import Path

from PIL import Image

MAX_W = 1600
QUALITY = 82
SRC = Path("images/People/Nostalgia")
DST = Path("images/People/NostalgiaWeb")


def slug(name: str) -> str:
    # normalize for web-safe URLs: lowercase, no spaces, no parens
    stem = Path(name).stem.lower()
    stem = re.sub(r"[^a-z0-9]+", "_", stem).strip("_")
    return stem


def main() -> None:
    DST.mkdir(parents=True, exist_ok=True)
    total_in = total_out = 0
    for p in sorted(SRC.iterdir()):
        if p.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            continue
        img = Image.open(p).convert("RGB")
        if img.width > MAX_W:
            ratio = MAX_W / img.width
            img = img.resize((MAX_W, round(img.height * ratio)), Image.LANCZOS)
        out = DST / f"{slug(p.name)}.jpg"
        img.save(out, "JPEG", quality=QUALITY, optimize=True)
        in_kb = p.stat().st_size // 1024
        out_kb = out.stat().st_size // 1024
        total_in += in_kb
        total_out += out_kb
        print(f"  {p.name:32s}  {in_kb:>6}KB  ->  {out.name:32s}  {out_kb:>5}KB")
    print(f"\nTotal: {total_in/1024:.1f}MB -> {total_out/1024:.1f}MB")


if __name__ == "__main__":
    main()

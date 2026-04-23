"""
Extract top-level PSD layers/groups into per-layer PNGs + a layers.json manifest.

Convention (see project memory / docs):
  - Each top-level node in the PSD (layer OR group) = one exported plane.
  - Groups are flattened to a single trimmed transparent PNG.
  - Layer panel order is preserved; bottom-of-panel = back of z-order (index 0).
  - Name prefix "_" or "hidden_" skips the node (reference/scratch material).
  - Hidden nodes are skipped unless --include-hidden is passed.
  - Optional hints encoded in the layer name: "fg_dino@parallax=0.6@blend=screen"
    become {"parallax": 0.6, "blend": "screen"} on that layer's manifest entry.

Install:
  pip install psd-tools pillow

Usage:
  python extract_psd.py                                       # defaults: PSD/Hero_Seperated_Characters.psd -> images/hero/, max-width 2400
  python extract_psd.py PSD/Hero_Seperated_Characters.psd --out images/hero
  python extract_psd.py PSD/Hero_Seperated_Characters.psd --max-width 3200
  python extract_psd.py PSD/Hero_Seperated_Characters.psd --max-width 0       # no downsample (full PSD resolution)
  python extract_psd.py PSD/Hero_Seperated_Characters.psd --include-hidden
  python extract_psd.py --clean                               # wipe existing PNGs/JPGs/JSON first (for renamed layers)
"""

import argparse
import json
import re
import sys
from pathlib import Path

from PIL import Image
from psd_tools import PSDImage


SKIP_PREFIXES = ("_", "hidden_", "hidden-")


def parse_node_name(raw_name: str):
    """'fg_dino@parallax=0.6@opaque' -> ('fg_dino', {'parallax': 0.6, 'opaque': True})"""
    parts = [p.strip() for p in raw_name.split("@")]
    name = parts[0]
    hints = {}
    for part in parts[1:]:
        if "=" not in part:
            # Flag-style hint: @opaque -> {"opaque": True}
            key = part.strip()
            if key:
                hints[key] = True
            continue
        key, value = part.split("=", 1)
        key = key.strip()
        value = value.strip()
        try:
            hints[key] = int(value)
            continue
        except ValueError:
            pass
        try:
            hints[key] = float(value)
            continue
        except ValueError:
            pass
        hints[key] = value
    return name, hints


def sanitize_filename(name: str) -> str:
    safe = re.sub(r"[^a-z0-9_\-]+", "_", name.lower())
    safe = re.sub(r"_+", "_", safe).strip("_")
    return safe or "layer"


def blend_mode_name(mode) -> str:
    if mode is None:
        return "normal"
    name = getattr(mode, "name", None)
    return (name or str(mode)).lower()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("psd_path", nargs="?", default="PSD/Hero_Seperated_Characters.psd", help="Input .psd (default: PSD/Hero_Seperated_Characters.psd)")
    parser.add_argument("--out", default="images/hero", help="Output directory (default: images/hero)")
    parser.add_argument("--include-hidden", action="store_true", help="Export nodes that are hidden in the PSD")
    parser.add_argument("--max-width", type=int, default=2400, help="Downsample so canvas width <= this (default: 2400). Use 0 to keep full PSD resolution.")
    parser.add_argument("--clean", action="store_true", help="Delete existing PNGs/JPGs/JSON in the output dir before writing (rerun generate_layer_depths.py after).")
    args = parser.parse_args()

    psd_path = Path(args.psd_path)
    out_dir = Path(args.out)

    if not psd_path.exists():
        print(f"error: PSD not found at {psd_path}", file=sys.stderr)
        sys.exit(1)

    out_dir.mkdir(parents=True, exist_ok=True)

    if args.clean:
        removed = 0
        for pattern in ("*.png", "*.jpg", "*.json"):
            for f in out_dir.glob(pattern):
                f.unlink()
                removed += 1
        print(f"Cleaned {removed} existing file(s) from {out_dir}")

    print(f"Reading {psd_path}...")
    psd = PSDImage.open(psd_path)
    src_canvas_w, src_canvas_h = psd.size
    print(f"Canvas (PSD): {src_canvas_w} x {src_canvas_h}")

    # Uniform downsample factor derived from canvas width.
    if args.max_width > 0 and src_canvas_w > args.max_width:
        scale = args.max_width / src_canvas_w
    else:
        scale = 1.0
    out_canvas_w = round(src_canvas_w * scale)
    out_canvas_h = round(src_canvas_h * scale)
    if scale != 1.0:
        print(f"Canvas (out): {out_canvas_w} x {out_canvas_h}  (scale: {scale:.4f})")

    layers_out = []
    used_filenames = set()

    # psd-tools iterates top-level nodes in paint order (bottom of panel first).
    # That matches our "back-to-front" requirement, so index 0 is the deepest plane.
    for pos, node in enumerate(psd):
        raw_name = node.name or f"layer_{pos}"

        if raw_name.lower().startswith(SKIP_PREFIXES):
            print(f"  [skip prefix]  {raw_name!r}")
            continue

        if not node.visible and not args.include_hidden:
            print(f"  [skip hidden] {raw_name!r}")
            continue

        name, hints = parse_node_name(raw_name)

        bbox = node.bbox
        if bbox is None:
            print(f"  [skip empty]  {name!r}")
            continue
        left, top, right, bottom = bbox
        width = right - left
        height = bottom - top
        if width <= 0 or height <= 0:
            print(f"  [skip 0-size] {name!r}")
            continue

        image = node.composite()
        if image is None:
            print(f"  [skip null]   {name!r}")
            continue

        # composite() can return canvas-sized or bbox-sized depending on node type/version;
        # crop to bbox defensively so the PNG on disk matches the recorded bounds.
        if image.size != (width, height):
            image = image.crop((left, top, right, bottom))

        if image.mode != "RGBA":
            image = image.convert("RGBA")

        # Scale bounds and image together so the recorded bbox matches the PNG on disk.
        if scale != 1.0:
            sx = round(left * scale)
            sy = round(top * scale)
            sw = max(1, round(width * scale))
            sh = max(1, round(height * scale))
            image = image.resize((sw, sh), Image.LANCZOS)
        else:
            sx, sy, sw, sh = left, top, width, height

        base = sanitize_filename(name)
        filename = f"{len(layers_out):02d}_{base}.png"
        if filename in used_filenames:
            i = 2
            while f"{len(layers_out):02d}_{base}_{i}.png" in used_filenames:
                i += 1
            filename = f"{len(layers_out):02d}_{base}_{i}.png"
        used_filenames.add(filename)

        # Opaque planes compress an order of magnitude better as JPEG. Auto-detect
        # only when there are zero transparent pixels (lossless call). Use the
        # @opaque hint to force JPEG for planes with painterly edge bleed — their
        # transparent pixels get flattened over white (matches .hero CSS bg).
        if image.mode == "RGBA":
            truly_opaque = image.split()[-1].getextrema()[0] >= 250
        else:
            truly_opaque = True
        hint_opaque = bool(hints.get("opaque")) or hints.get("encoding") in ("jpg", "jpeg")

        if truly_opaque or hint_opaque:
            if image.mode == "RGBA":
                flat = Image.new("RGB", image.size, (255, 255, 255))
                flat.paste(image, mask=image.split()[-1])
                image = flat
            elif image.mode != "RGB":
                image = image.convert("RGB")
            filename = filename.rsplit(".", 1)[0] + ".jpg"
            image.save(out_dir / filename, "JPEG", quality=88, optimize=True)
        else:
            image.save(out_dir / filename, "PNG", optimize=True)

        opacity_byte = getattr(node, "opacity", 255)
        layers_out.append({
            "id": name,
            "index": len(layers_out),
            "file": filename,
            "bounds": {"x": sx, "y": sy, "width": sw, "height": sh},
            "opacity": round(opacity_byte / 255.0, 3),
            "blend_mode": blend_mode_name(node.blend_mode),
            "is_group": bool(node.is_group()),
            "hints": hints,
            "depth_file": None,
        })
        kind = "group" if node.is_group() else "layer"
        size_kb = (out_dir / filename).stat().st_size / 1024
        print(f"  [{kind:5}] {filename}  [{sw}x{sh} @ {sx},{sy}]  {size_kb:.0f}KB")

    # Flat composite for fallback + fast initial paint.
    print("Compositing flat PSD...")
    composite = psd.composite()
    if composite is not None:
        if composite.mode != "RGB":
            composite = composite.convert("RGB")
        if scale != 1.0:
            composite = composite.resize((out_canvas_w, out_canvas_h), Image.LANCZOS)
        composite_path = out_dir / "composite.jpg"
        composite.save(composite_path, "JPEG", quality=88, optimize=True)
        size_kb = composite_path.stat().st_size / 1024
        print(f"  composite.jpg  [{composite.size[0]}x{composite.size[1]}]  {size_kb:.0f}KB")
        composite_filename = "composite.jpg"
    else:
        composite_filename = None

    manifest = {
        "canvas": {"width": out_canvas_w, "height": out_canvas_h},
        "source": psd_path.name,
        "source_canvas": {"width": src_canvas_w, "height": src_canvas_h},
        "scale": round(scale, 6),
        "composite": composite_filename,
        "layers": layers_out,
    }
    (out_dir / "layers.json").write_text(json.dumps(manifest, indent=2))
    print(f"\nWrote {out_dir / 'layers.json'} ({len(layers_out)} plane(s)).")


if __name__ == "__main__":
    main()

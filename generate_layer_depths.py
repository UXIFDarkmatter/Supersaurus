"""
Generate per-layer depth maps for the hero composition.

Reads images/hero/layers.json, runs Depth-Anything-V2-Small on each layer's PNG,
writes NN_name_depth.png next to it, and records the filename in the manifest
under `depth_file`.

Character PNGs have alpha: we composite over mid-gray before inference so the
model sees a coherent image instead of transparent checkerboard, then mask the
depth output by the original alpha so transparent pixels end up at depth=0.

Skip a layer by giving its PSD layer name the hint suffix `@depth=skip`.

Install (already handled if you've run generate_depth.py before):
  pip install transformers pillow numpy torch

Usage:
  python generate_layer_depths.py
  python generate_layer_depths.py --force                    # regenerate all
  python generate_layer_depths.py images/hero/layers.json    # explicit manifest
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from transformers import pipeline


MODEL = "depth-anything/Depth-Anything-V2-Small-hf"
NEUTRAL_FILL = np.array([128, 128, 128], dtype=np.float32) / 255.0


def run_depth(pipe, rgb_image: Image.Image) -> np.ndarray:
    """Run depth estimation; return normalized uint8 array (H, W)."""
    result = pipe(rgb_image)
    depth = np.array(result["depth"], dtype=np.float32)
    lo, hi = float(depth.min()), float(depth.max())
    if hi > lo:
        depth = (depth - lo) / (hi - lo)
    else:
        depth = np.zeros_like(depth)
    return (depth * 255.0).astype(np.uint8)


def composite_on_gray(rgba: Image.Image) -> tuple[Image.Image, np.ndarray]:
    """Alpha-composite RGBA over mid-gray; return (RGB image, alpha array)."""
    arr = np.array(rgba, dtype=np.float32) / 255.0
    a = arr[..., 3:4]
    rgb = arr[..., :3] * a + NEUTRAL_FILL * (1.0 - a)
    rgb_img = Image.fromarray((rgb * 255.0).astype(np.uint8), "RGB")
    alpha = (arr[..., 3] * 255.0).astype(np.uint8)
    return rgb_img, alpha


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("manifest", nargs="?", default="images/hero/layers.json", help="Path to layers.json (default: images/hero/layers.json)")
    parser.add_argument("--force", action="store_true", help="Regenerate depth maps even if already present")
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    if not manifest_path.exists():
        print(f"error: manifest not found at {manifest_path}", file=sys.stderr)
        sys.exit(1)

    out_dir = manifest_path.parent
    manifest = json.loads(manifest_path.read_text())

    print(f"Loading {MODEL}...")
    pipe = pipeline(task="depth-estimation", model=MODEL)

    changed = False
    for entry in manifest["layers"]:
        name = entry["id"]
        hints = entry.get("hints", {}) or {}
        if str(hints.get("depth", "")).lower() == "skip":
            print(f"  [skip hint]  {name}")
            continue

        color_path = out_dir / entry["file"]
        if not color_path.exists():
            print(f"  [missing]    {name}: {color_path} not found", file=sys.stderr)
            continue

        depth_name = color_path.stem + "_depth.png"
        depth_path = out_dir / depth_name

        if not args.force and depth_path.exists():
            if entry.get("depth_file") != depth_name:
                entry["depth_file"] = depth_name
                changed = True
            print(f"  [cached]     {name} -> {depth_name}")
            continue

        img = Image.open(color_path)
        if img.mode == "RGBA":
            rgb_img, alpha = composite_on_gray(img)
        else:
            rgb_img = img.convert("RGB")
            alpha = None

        print(f"  [run]        {name}  [{rgb_img.size[0]}x{rgb_img.size[1]}]...")
        depth = run_depth(pipe, rgb_img)

        # Mask depth by alpha so transparent pixels read as 0 (no depth data).
        if alpha is not None:
            if alpha.shape != depth.shape:
                a_img = Image.fromarray(alpha, "L").resize(
                    (depth.shape[1], depth.shape[0]), Image.LANCZOS
                )
                alpha = np.array(a_img, dtype=np.uint8)
            depth = (depth.astype(np.float32) * (alpha.astype(np.float32) / 255.0)).astype(np.uint8)

        Image.fromarray(depth, mode="L").save(depth_path, optimize=True)
        entry["depth_file"] = depth_name
        changed = True
        size_kb = depth_path.stat().st_size / 1024
        print(f"               -> {depth_name}  {size_kb:.0f}KB")

    if changed:
        manifest_path.write_text(json.dumps(manifest, indent=2))
        print(f"\nUpdated {manifest_path}")
    else:
        print(f"\nNo changes to {manifest_path}")


if __name__ == "__main__":
    main()

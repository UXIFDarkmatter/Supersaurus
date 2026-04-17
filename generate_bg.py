import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from simple_lama_inpainting import SimpleLama


def main():
    color_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("images/original_composition_small.jpg")
    depth_path = color_path.with_name(color_path.stem + "_depth.jpg")
    out_path = color_path.with_name(color_path.stem + "_bg.jpg")
    mask_path = color_path.with_name(color_path.stem + "_mask.png")

    threshold = int(sys.argv[2]) if len(sys.argv) > 2 else 115
    dilate_px = int(sys.argv[3]) if len(sys.argv) > 3 else 18

    print(f"Loading {color_path.name} + {depth_path.name}")
    color = Image.open(color_path).convert("RGB")
    depth = Image.open(depth_path).convert("L")
    if depth.size != color.size:
        depth = depth.resize(color.size, Image.LANCZOS)

    depth_arr = np.array(depth, dtype=np.uint8)
    mask_arr = (depth_arr > threshold).astype(np.uint8) * 255

    if dilate_px > 0:
        k = 2 * dilate_px + 1
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
        mask_arr = cv2.dilate(mask_arr, kernel)

    mask_arr = cv2.GaussianBlur(mask_arr, (9, 9), 0)
    mask_arr = (mask_arr > 127).astype(np.uint8) * 255

    Image.fromarray(mask_arr, "L").save(mask_path)
    print(f"Saved mask preview: {mask_path.name}  (coverage: {mask_arr.mean()/255*100:.1f}%)")

    print("Loading LaMa (first run downloads weights ~200MB)...")
    lama = SimpleLama()

    print(f"Inpainting {color.size[0]}x{color.size[1]}...")
    mask_img = Image.fromarray(mask_arr, "L")
    result = lama(color, mask_img)

    if result.size != color.size:
        result = result.resize(color.size, Image.LANCZOS)

    result.save(out_path, quality=88, optimize=True)
    print(f"Saved inpainted background: {out_path.name}  ({out_path.stat().st_size/1024:.0f}KB)")


if __name__ == "__main__":
    main()

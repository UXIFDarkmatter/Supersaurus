import sys
from pathlib import Path

import numpy as np
from PIL import Image
from transformers import pipeline


def main():
    input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("images/original_composition_small.jpg")
    output_path = input_path.with_name(input_path.stem + "_depth.jpg")

    print(f"Loading Depth-Anything-V2-Small...")
    pipe = pipeline(
        task="depth-estimation",
        model="depth-anything/Depth-Anything-V2-Small-hf",
    )

    print(f"Processing {input_path}...")
    image = Image.open(input_path).convert("RGB")
    result = pipe(image)

    depth = np.array(result["depth"], dtype=np.float32)
    depth_min = depth.min()
    depth_max = depth.max()
    if depth_max > depth_min:
        depth = (depth - depth_min) / (depth_max - depth_min)
    depth_img = Image.fromarray((depth * 255.0).astype(np.uint8), mode="L")
    depth_img.save(output_path, quality=92)
    print(f"Saved depth map: {output_path} ({depth_img.size[0]}x{depth_img.size[1]})")


if __name__ == "__main__":
    main()

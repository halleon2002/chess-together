from PIL import Image, ImageDraw
from pathlib import Path

# =============================
# SETTINGS
# =============================
INPUT_FOLDER = Path("input")
OUTPUT_FOLDER = Path("output")

OUTPUT_SIZE = 90
CROP_PERCENT = 0.05

OUTPUT_FOLDER.mkdir(exist_ok=True)

# =============================
# PROCESS IMAGES
# =============================
for image_path in INPUT_FOLDER.glob("*.png"):

    print(f"Processing {image_path.name}")

    # Open image
    img = Image.open(image_path).convert("RGBA")

    # --------------------------------
    # Remove white background
    # --------------------------------
    pixels = img.load()
    w, h = img.size

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]

            if r > 245 and g > 245 and b > 245:
                pixels[x, y] = (255, 255, 255, 0)

    # --------------------------------
    # Crop fixed percentage
    # --------------------------------
    w, h = img.size

    margin_x = int(w * CROP_PERCENT)
    margin_y = int(h * CROP_PERCENT)

    img = img.crop((
        margin_x,
        margin_y,
        w - margin_x,
        h - margin_y
    ))

    # --------------------------------
    # Make square canvas
    # --------------------------------
    w, h = img.size
    side = max(w, h)

    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))

    canvas.paste(
        img,
        (
            (side - w) // 2,
            (side - h) // 2
        ),
        img
    )

    # --------------------------------
    # Circular mask
    # --------------------------------
    mask = Image.new("L", (side, side), 0)

    draw = ImageDraw.Draw(mask)

    draw.ellipse(
        (0, 0, side, side),
        fill=255
    )

    canvas.putalpha(mask)

    # --------------------------------
    # Resize
    # --------------------------------
    result = canvas.resize(
        (OUTPUT_SIZE, OUTPUT_SIZE),
        Image.LANCZOS
    )

    # --------------------------------
    # Save
    # --------------------------------
    output_file = OUTPUT_FOLDER / image_path.name

    result.save(output_file, optimize=True)

print("\nAll images finished!")
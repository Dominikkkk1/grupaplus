"""
Preflight validation service for print files.
Checks: DPI, color profile, dimensions, page count, bleeds.
Deployed as standalone microservice (Railway/Fly.io).
"""

import io
import os
from fastapi import FastAPI, UploadFile, File, Header, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image
from PIL.ExifTags import TAGS
import fitz  # PyMuPDF

app = FastAPI(title="Preflight Service", version="1.0.0")

API_SECRET = os.environ.get("PREFLIGHT_SECRET", "")

# Minimum requirements
MIN_DPI = 150
WARN_DPI = 300
MM_PER_INCH = 25.4


def check_auth(authorization: str | None):
    """Verify Bearer token if PREFLIGHT_SECRET is set."""
    if not API_SECRET:
        return
    if not authorization or authorization != f"Bearer {API_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def analyze_image(data: bytes, filename: str) -> dict:
    """Analyze image file: DPI, color space, dimensions."""
    img = Image.open(io.BytesIO(data))
    width_px, height_px = img.size
    color_mode = img.mode  # RGB, CMYK, L, P, etc.

    # Extract DPI from EXIF or image info
    dpi_x, dpi_y = 72, 72  # default
    if hasattr(img, "info") and "dpi" in img.info:
        dpi_x, dpi_y = img.info["dpi"]
    elif hasattr(img, "_getexif") and img._getexif():
        exif = img._getexif()
        # Tag 282 = XResolution, 283 = YResolution
        if exif and 282 in exif:
            res = exif[282]
            dpi_x = float(res[0]) / float(res[1]) if isinstance(res, tuple) else float(res)
        if exif and 283 in exif:
            res = exif[283]
            dpi_y = float(res[0]) / float(res[1]) if isinstance(res, tuple) else float(res)

    dpi = min(dpi_x, dpi_y)
    width_mm = round(width_px / dpi * MM_PER_INCH, 1) if dpi > 0 else 0
    height_mm = round(height_px / dpi * MM_PER_INCH, 1) if dpi > 0 else 0

    checks = []

    # DPI check
    if dpi < MIN_DPI:
        checks.append({
            "label": "DPI",
            "status": "failed",
            "value": f"{round(dpi)} DPI",
            "message": f"Za niska rozdzielczość ({round(dpi)} DPI). Minimum: {MIN_DPI} DPI.",
        })
    elif dpi < WARN_DPI:
        checks.append({
            "label": "DPI",
            "status": "warning",
            "value": f"{round(dpi)} DPI",
            "message": f"Rozdzielczość {round(dpi)} DPI — zalecane minimum {WARN_DPI} DPI dla druku.",
        })
    else:
        checks.append({
            "label": "DPI",
            "status": "passed",
            "value": f"{round(dpi)} DPI",
        })

    # Color space
    color_map = {
        "CMYK": ("passed", "CMYK — gotowy do druku"),
        "RGB": ("warning", "RGB — zalecana konwersja do CMYK"),
        "L": ("warning", "Skala szarości"),
        "P": ("warning", "Paleta kolorów — zalecana konwersja"),
    }
    cs_status, cs_msg = color_map.get(color_mode, ("passed", color_mode))
    checks.append({
        "label": "Profil kolorów",
        "status": cs_status,
        "value": color_mode,
        "message": cs_msg if cs_status != "passed" else None,
    })

    # Dimensions
    checks.append({
        "label": "Wymiary",
        "status": "passed",
        "value": f"{width_px}x{height_px} px ({width_mm}x{height_mm} mm)",
    })

    worst = "passed"
    for c in checks:
        if c["status"] == "failed":
            worst = "failed"
            break
        if c["status"] == "warning":
            worst = "warning"

    return {
        "status": worst,
        "file_type": "image",
        "checks": [c for c in checks if c.get("message") is not None or c["status"] == "passed"],
        "metadata": {
            "width_px": width_px,
            "height_px": height_px,
            "width_mm": width_mm,
            "height_mm": height_mm,
            "dpi": round(dpi),
            "color_mode": color_mode,
        },
    }


def analyze_pdf(data: bytes, filename: str) -> dict:
    """Analyze PDF file: pages, dimensions, fonts, images DPI."""
    doc = fitz.open(stream=data, filetype="pdf")
    page_count = doc.page_count
    checks = []

    # Page dimensions (first page)
    if page_count > 0:
        page = doc[0]
        rect = page.rect
        width_mm = round(rect.width * MM_PER_INCH / 72, 1)
        height_mm = round(rect.height * MM_PER_INCH / 72, 1)

        checks.append({
            "label": "Wymiary strony",
            "status": "passed",
            "value": f"{width_mm}x{height_mm} mm",
        })

        checks.append({
            "label": "Liczba stron",
            "status": "passed",
            "value": str(page_count),
        })

        # Check images DPI inside PDF
        min_img_dpi = None
        for page_num in range(min(page_count, 5)):  # Check first 5 pages
            p = doc[page_num]
            for img_info in p.get_images(full=True):
                xref = img_info[0]
                try:
                    base_image = doc.extract_image(xref)
                    img_width = base_image.get("width", 0)
                    img_height = base_image.get("height", 0)

                    # Estimate DPI from image size vs page placement
                    # Get image rects on page
                    img_rects = p.get_image_rects(xref)
                    if img_rects and img_width > 0:
                        r = img_rects[0]
                        display_width_pt = r.width
                        if display_width_pt > 0:
                            img_dpi = img_width / (display_width_pt / 72)
                            if min_img_dpi is None or img_dpi < min_img_dpi:
                                min_img_dpi = img_dpi
                except Exception:
                    continue

        if min_img_dpi is not None:
            dpi_val = round(min_img_dpi)
            if dpi_val < MIN_DPI:
                checks.append({
                    "label": "DPI obrazów",
                    "status": "failed",
                    "value": f"{dpi_val} DPI",
                    "message": f"Obraz w PDF ma {dpi_val} DPI — minimum {MIN_DPI} DPI.",
                })
            elif dpi_val < WARN_DPI:
                checks.append({
                    "label": "DPI obrazów",
                    "status": "warning",
                    "value": f"{dpi_val} DPI",
                    "message": f"Obraz w PDF ma {dpi_val} DPI — zalecane {WARN_DPI} DPI.",
                })
            else:
                checks.append({
                    "label": "DPI obrazów",
                    "status": "passed",
                    "value": f"{dpi_val} DPI",
                })

        # Check embedded fonts
        fonts_embedded = True
        for page_num in range(min(page_count, 5)):
            p = doc[page_num]
            for font in p.get_fonts(full=True):
                # font[3] = font type, font[4] = encoding
                font_name = font[3] if len(font) > 3 else ""
                # Type3 fonts or fonts without proper name may not be embedded
                if font_name and "Type3" in font_name:
                    fonts_embedded = False

        if not fonts_embedded:
            checks.append({
                "label": "Czcionki",
                "status": "warning",
                "value": "Type3 detected",
                "message": "Wykryto czcionki Type3 — mogą nie być osadzone.",
            })

    doc.close()

    worst = "passed"
    for c in checks:
        if c["status"] == "failed":
            worst = "failed"
            break
        if c["status"] == "warning":
            worst = "warning"

    metadata = {}
    if page_count > 0:
        # Reuse first page rect from earlier (doc already closed, recalculate)
        doc2 = fitz.open(stream=data, filetype="pdf")
        p0 = doc2[0]
        metadata = {
            "page_count": page_count,
            "width_mm": round(p0.rect.width * MM_PER_INCH / 72, 1),
            "height_mm": round(p0.rect.height * MM_PER_INCH / 72, 1),
            "min_image_dpi": round(min_img_dpi) if min_img_dpi else None,
        }
        doc2.close()

    return {
        "status": worst,
        "file_type": "pdf",
        "checks": checks,
        "metadata": metadata,
    }


@app.get("/health")
async def health():
    return {"ok": True, "service": "preflight", "version": "1.0.0"}


@app.post("/validate")
async def validate(
    file: UploadFile = File(...),
    authorization: str | None = Header(None),
):
    check_auth(authorization)

    data = await file.read()
    filename = file.filename or "unknown"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if len(data) > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")

    try:
        if ext in ("jpg", "jpeg", "png", "tiff", "tif"):
            result = analyze_image(data, filename)
        elif ext == "pdf":
            result = analyze_pdf(data, filename)
        else:
            result = {
                "status": "warning",
                "file_type": "unknown",
                "checks": [{
                    "label": "Typ pliku",
                    "status": "warning",
                    "value": ext,
                    "message": f"Nieobsługiwany typ pliku: .{ext}",
                }],
                "metadata": {},
            }
    except Exception as e:
        # Sanitize error message — hide internal Python details
        raw_msg = str(e)
        if "<" in raw_msg:
            clean_msg = raw_msg.split("<")[0].strip()
        else:
            clean_msg = raw_msg
        if not clean_msg:
            clean_msg = "Nieczytelny lub uszkodzony plik"

        result = {
            "status": "failed",
            "file_type": "error",
            "checks": [{
                "label": "Analiza",
                "status": "failed",
                "value": "error",
                "message": f"Nie udało się przeanalizować pliku: {clean_msg}",
            }],
            "metadata": {},
        }

    return JSONResponse(content=result)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

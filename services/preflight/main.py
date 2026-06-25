"""
Preflight validation service for print files.
Checks: DPI, color profile, dimensions, proportions, transparency, ICC, fonts.
Deployed as standalone microservice (Railway).
"""

import io
import os
from fastapi import FastAPI, UploadFile, File, Header, Query, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image
from PIL.ExifTags import TAGS
import fitz  # PyMuPDF

app = FastAPI(title="Preflight Service", version="2.0.0")

API_SECRET = os.environ.get("PREFLIGHT_SECRET", "")

MIN_DPI = 150
WARN_DPI = 300
MM_PER_INCH = 25.4
PROPORTION_TOLERANCE = 0.05  # 5% tolerancja proporcji


def check_auth(authorization: str | None):
    if not API_SECRET:
        return
    if not authorization or authorization != f"Bearer {API_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def check_proportions(
    file_w_mm: float, file_h_mm: float,
    target_w: float, target_h: float,
    checks: list,
):
    """Porownaj proporcje pliku z docelowym produktem."""
    if target_w <= 0 or target_h <= 0 or file_w_mm <= 0 or file_h_mm <= 0:
        return

    file_ratio = file_w_mm / file_h_mm
    target_ratio = target_w / target_h
    # Sprawdz tez obrocony (landscape vs portrait)
    target_ratio_rotated = target_h / target_w

    ratio_ok = (
        abs(file_ratio - target_ratio) / target_ratio <= PROPORTION_TOLERANCE
        or abs(file_ratio - target_ratio_rotated) / target_ratio_rotated <= PROPORTION_TOLERANCE
    )

    if not ratio_ok:
        checks.append({
            "label": "Proporcje",
            "status": "warning",
            "value": f"{file_w_mm:.0f}x{file_h_mm:.0f} mm vs {target_w:.0f}x{target_h:.0f} mm",
            "message": f"Proporcje pliku nie pasują do produktu ({file_w_mm:.0f}x{file_h_mm:.0f} vs {target_w:.0f}x{target_h:.0f} mm).",
        })
    else:
        # Sprawdz czy plik nie za maly (< 90% docelowego)
        min_dim = min(file_w_mm, file_h_mm)
        target_min = min(target_w, target_h)
        if min_dim < target_min * 0.9:
            checks.append({
                "label": "Proporcje",
                "status": "warning",
                "value": f"{file_w_mm:.0f}x{file_h_mm:.0f} mm vs {target_w:.0f}x{target_h:.0f} mm",
                "message": f"Plik mniejszy niż docelowy rozmiar ({file_w_mm:.0f}x{file_h_mm:.0f} vs {target_w:.0f}x{target_h:.0f} mm).",
            })
        else:
            checks.append({
                "label": "Proporcje",
                "status": "passed",
                "value": f"{file_w_mm:.0f}x{file_h_mm:.0f} mm → {target_w:.0f}x{target_h:.0f} mm",
            })


def analyze_image(data: bytes, filename: str, target_w: float | None, target_h: float | None) -> dict:
    img = Image.open(io.BytesIO(data))
    width_px, height_px = img.size
    color_mode = img.mode

    # DPI from EXIF
    dpi_x, dpi_y = 72, 72
    if hasattr(img, "info") and "dpi" in img.info:
        dpi_x, dpi_y = img.info["dpi"]
    elif hasattr(img, "_getexif") and img._getexif():
        exif = img._getexif()
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

    # DPI
    if dpi < MIN_DPI:
        checks.append({"label": "DPI", "status": "failed", "value": f"{round(dpi)} DPI",
                        "message": f"Za niska rozdzielczość ({round(dpi)} DPI). Minimum: {MIN_DPI} DPI."})
    elif dpi < WARN_DPI:
        checks.append({"label": "DPI", "status": "warning", "value": f"{round(dpi)} DPI",
                        "message": f"Rozdzielczość {round(dpi)} DPI — zalecane minimum {WARN_DPI} DPI dla druku."})
    else:
        checks.append({"label": "DPI", "status": "passed", "value": f"{round(dpi)} DPI"})

    # Color space
    color_map = {
        "CMYK": ("passed", "CMYK — gotowy do druku"),
        "RGB": ("warning", "RGB — zalecana konwersja do CMYK"),
        "L": ("warning", "Skala szarości"),
        "P": ("warning", "Paleta kolorów — zalecana konwersja"),
    }
    cs_status, cs_msg = color_map.get(color_mode, ("passed", color_mode))
    checks.append({"label": "Profil kolorów", "status": cs_status, "value": color_mode,
                    "message": cs_msg if cs_status != "passed" else None})

    # ICC profile
    icc_data = img.info.get("icc_profile")
    if icc_data and len(icc_data) > 128:
        # Extract profile description from ICC header (bytes 128+)
        try:
            desc_tag = icc_data[128:].split(b"desc")[1] if b"desc" in icc_data[128:] else None
            if desc_tag and len(desc_tag) > 12:
                length = int.from_bytes(desc_tag[8:12], "big")
                icc_name = desc_tag[12:12 + length].decode("ascii", errors="ignore").strip("\x00 ")
            else:
                icc_name = "Wykryty (nazwa nieczytelna)"
        except Exception:
            icc_name = "Wykryty"
        checks.append({"label": "Profil ICC", "status": "passed", "value": icc_name})
    else:
        checks.append({"label": "Profil ICC", "status": "passed", "value": "Brak profilu ICC",
                        "message": "Brak osadzonego profilu ICC — kolory mogą się różnić."})

    # Dimensions
    checks.append({"label": "Wymiary", "status": "passed",
                    "value": f"{width_px}x{height_px} px ({width_mm}x{height_mm} mm)"})

    # Proportions vs target
    if target_w and target_h:
        check_proportions(width_mm, height_mm, target_w, target_h, checks)

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
            "width_px": width_px, "height_px": height_px,
            "width_mm": width_mm, "height_mm": height_mm,
            "dpi": round(dpi), "color_mode": color_mode,
        },
    }


def analyze_pdf(data: bytes, filename: str, target_w: float | None, target_h: float | None) -> dict:
    doc = fitz.open(stream=data, filetype="pdf")
    page_count = doc.page_count
    checks = []
    width_mm, height_mm = 0.0, 0.0

    if page_count > 0:
        page = doc[0]
        rect = page.rect
        width_mm = round(rect.width * MM_PER_INCH / 72, 1)
        height_mm = round(rect.height * MM_PER_INCH / 72, 1)

        checks.append({"label": "Wymiary strony", "status": "passed", "value": f"{width_mm}x{height_mm} mm"})
        checks.append({"label": "Liczba stron", "status": "passed", "value": str(page_count)})

        # Images DPI
        min_img_dpi = None
        for page_num in range(min(page_count, 5)):
            p = doc[page_num]
            for img_info in p.get_images(full=True):
                xref = img_info[0]
                try:
                    base_image = doc.extract_image(xref)
                    img_width = base_image.get("width", 0)
                    img_rects = p.get_image_rects(xref)
                    if img_rects and img_width > 0:
                        r = img_rects[0]
                        if r.width > 0:
                            img_dpi = img_width / (r.width / 72)
                            if min_img_dpi is None or img_dpi < min_img_dpi:
                                min_img_dpi = img_dpi
                except Exception:
                    continue

        if min_img_dpi is not None:
            dpi_val = round(min_img_dpi)
            if dpi_val < MIN_DPI:
                checks.append({"label": "DPI obrazów", "status": "failed", "value": f"{dpi_val} DPI",
                                "message": f"Obraz w PDF ma {dpi_val} DPI — minimum {MIN_DPI} DPI."})
            elif dpi_val < WARN_DPI:
                checks.append({"label": "DPI obrazów", "status": "warning", "value": f"{dpi_val} DPI",
                                "message": f"Obraz w PDF ma {dpi_val} DPI — zalecane {WARN_DPI} DPI."})
            else:
                checks.append({"label": "DPI obrazów", "status": "passed", "value": f"{dpi_val} DPI"})

        # Fonts
        has_type3 = False
        for page_num in range(min(page_count, 5)):
            p = doc[page_num]
            for font in p.get_fonts(full=True):
                font_type = font[3] if len(font) > 3 else ""
                if font_type and "Type3" in font_type:
                    has_type3 = True

        if has_type3:
            checks.append({"label": "Czcionki", "status": "warning", "value": "Type3 detected",
                            "message": "Wykryto czcionki Type3 — mogą nie być osadzone."})

        # Transparency check
        has_transparency = False
        for page_num in range(min(page_count, 3)):
            p = doc[page_num]
            for img_info in p.get_images(full=True):
                xref = img_info[0]
                try:
                    base_image = doc.extract_image(xref)
                    cs = base_image.get("cs-name", "")
                    if "ICCBased" in cs or base_image.get("width", 0) > 0:
                        # Check if image has alpha/smask
                        smask = img_info[1] if len(img_info) > 1 else 0
                        if smask and smask > 0:
                            has_transparency = True
                except Exception:
                    continue

        if has_transparency:
            checks.append({"label": "Przeźroczystość", "status": "warning",
                            "value": "Wykryta",
                            "message": "PDF zawiera przeźroczystości — mogą powodować problemy na niektórych maszynach."})

        # Proportions vs target
        if target_w and target_h:
            check_proportions(width_mm, height_mm, target_w, target_h, checks)

    doc.close()

    worst = "passed"
    for c in checks:
        if c["status"] == "failed":
            worst = "failed"
            break
        if c["status"] == "warning":
            worst = "warning"

    return {
        "status": worst,
        "file_type": "pdf",
        "checks": checks,
        "metadata": {
            "page_count": page_count,
            "width_mm": width_mm,
            "height_mm": height_mm,
            "min_image_dpi": round(min_img_dpi) if min_img_dpi else None,
        },
    }


@app.get("/health")
async def health():
    return {"ok": True, "service": "preflight", "version": "2.0.0"}


@app.post("/validate")
async def validate(
    file: UploadFile = File(...),
    authorization: str | None = Header(None),
    target_width_mm: float | None = Query(None),
    target_height_mm: float | None = Query(None),
):
    check_auth(authorization)

    data = await file.read()
    filename = file.filename or "unknown"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if len(data) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")

    try:
        if ext in ("jpg", "jpeg", "png", "tiff", "tif"):
            result = analyze_image(data, filename, target_width_mm, target_height_mm)
        elif ext == "pdf":
            result = analyze_pdf(data, filename, target_width_mm, target_height_mm)
        else:
            result = {
                "status": "warning", "file_type": "unknown",
                "checks": [{"label": "Typ pliku", "status": "warning", "value": ext,
                             "message": f"Nieobsługiwany typ pliku: .{ext}"}],
                "metadata": {},
            }
    except Exception as e:
        raw_msg = str(e)
        clean_msg = raw_msg.split("<")[0].strip() if "<" in raw_msg else raw_msg
        if not clean_msg:
            clean_msg = "Nieczytelny lub uszkodzony plik"

        result = {
            "status": "failed", "file_type": "error",
            "checks": [{"label": "Analiza", "status": "failed", "value": "error",
                         "message": f"Nie udało się przeanalizować pliku: {clean_msg}"}],
            "metadata": {},
        }

    return JSONResponse(content=result)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

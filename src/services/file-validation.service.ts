import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

/**
 * Preflight — walidacja plikow do druku.
 *
 * Sprawdza:
 * - DPI (rozdzielczosc) — minimum 300 dla druku
 * - Wymiary — czy plik ma sensowny rozmiar
 * - Profil kolorystyczny — RGB vs CMYK
 *
 * Uniwersalny check (nie per produkt) — te same reguly dla kazdego pliku.
 */

interface PreflightCheck {
  status: "passed" | "warning" | "failed";
  label: string;
  value: string;
  message?: string;
}

export interface PreflightResult {
  status: "passed" | "warning" | "failed";
  checks: PreflightCheck[];
  validatedAt: string;
}

const MIN_DPI = 150; // ponizej = failed (za niskie do druku)
const WARN_DPI = 300; // ponizej = warning (moze byc rozmyty)
const PT_TO_MM = 0.3528; // 1 punkt PDF = 0.3528 mm

/**
 * Waliduje plik uploadowany do zamówienia.
 * Obsluguje obrazki (JPG/PNG/TIFF) i PDF.
 */
export async function validateFile(
  buffer: Buffer,
  mimeType: string
): Promise<PreflightResult> {
  const checks: PreflightCheck[] = [];

  try {
    if (mimeType.startsWith("image/")) {
      // === OBRAZEK ===
      const metadata = await sharp(buffer).metadata();

      // DPI
      const dpi = metadata.density ?? 72; // domyslnie 72 jesli brak EXIF
      if (dpi < MIN_DPI) {
        checks.push({
          status: "failed",
          label: "DPI",
          value: `${dpi}`,
          message: `Za niska rozdzielczosc (${dpi} DPI). Minimum do druku: ${MIN_DPI} DPI.`,
        });
      } else if (dpi < WARN_DPI) {
        checks.push({
          status: "warning",
          label: "DPI",
          value: `${dpi}`,
          message: `Rozdzielczosc ${dpi} DPI — ponizej zalecanego 300 DPI. Moze byc lekko rozmyty.`,
        });
      } else {
        checks.push({
          status: "passed",
          label: "DPI",
          value: `${dpi}`,
        });
      }

      // Wymiary
      const w = metadata.width ?? 0;
      const h = metadata.height ?? 0;
      if (w < 200 || h < 200) {
        checks.push({
          status: "failed",
          label: "Wymiary",
          value: `${w}x${h} px`,
          message: "Plik za maly do druku (mniej niz 200px).",
        });
      } else {
        // Oblicz rozmiar w mm przy danym DPI
        const widthMm = Math.round((w / dpi) * 25.4);
        const heightMm = Math.round((h / dpi) * 25.4);
        checks.push({
          status: "passed",
          label: "Wymiary",
          value: `${w}x${h} px (${widthMm}x${heightMm} mm @ ${dpi} DPI)`,
        });
      }

      // Profil kolorystyczny
      const space = metadata.space ?? "unknown";
      if (space === "cmyk") {
        checks.push({
          status: "passed",
          label: "Profil",
          value: "CMYK",
        });
      } else if (space === "srgb" || space === "rgb") {
        checks.push({
          status: "warning",
          label: "Profil",
          value: "RGB",
          message:
            "Plik w profilu RGB — kolory moga wygladac inaczej na wydruku. Zalecany: CMYK.",
        });
      } else {
        checks.push({
          status: "passed",
          label: "Profil",
          value: space.toUpperCase(),
        });
      }
    } else if (mimeType === "application/pdf") {
      // === PDF ===
      const pdfDoc = await PDFDocument.load(buffer, {
        ignoreEncryption: true,
      });
      const pages = pdfDoc.getPages();

      // Ilosc stron
      checks.push({
        status: "passed",
        label: "Strony",
        value: `${pages.length}`,
      });

      // Wymiary pierwszej strony
      if (pages.length > 0) {
        const page = pages[0];
        const { width, height } = page.getSize();
        const widthMm = Math.round(width * PT_TO_MM);
        const heightMm = Math.round(height * PT_TO_MM);

        if (widthMm < 30 || heightMm < 30) {
          checks.push({
            status: "warning",
            label: "Wymiary",
            value: `${widthMm}x${heightMm} mm`,
            message: "Strona bardzo mala — sprawdz czy to poprawny rozmiar.",
          });
        } else {
          checks.push({
            status: "passed",
            label: "Wymiary",
            value: `${widthMm}x${heightMm} mm`,
          });
        }
      }

      // PDF nie pozwala latwo sprawdzic DPI osadzonych obrazkow — info
      checks.push({
        status: "passed",
        label: "Format",
        value: "PDF",
        message: "DPI obrazkow wewnatrz PDF nie jest sprawdzane automatycznie.",
      });
    } else {
      // Nieobslugiwany format
      checks.push({
        status: "warning",
        label: "Format",
        value: mimeType,
        message: "Ten format pliku nie jest sprawdzany automatycznie.",
      });
    }
  } catch (err) {
    checks.push({
      status: "failed",
      label: "Blad",
      value: "Nie udalo sie przeczytac pliku",
      message: err instanceof Error ? err.message : "Nieznany blad",
    });
  }

  // Okresl ogolny status — najgorszy z checkow
  let overall: "passed" | "warning" | "failed" = "passed";
  for (const check of checks) {
    if (check.status === "failed") {
      overall = "failed";
      break;
    }
    if (check.status === "warning") {
      overall = "warning";
    }
  }

  return {
    status: overall,
    checks,
    validatedAt: new Date().toISOString(),
  };
}

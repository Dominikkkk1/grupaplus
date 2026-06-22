import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

/**
 * Preflight — walidacja plikow do druku.
 *
 * Strategia:
 * 1. Jesli PREFLIGHT_SERVICE_URL ustawiony → wywolaj Python microservice (pelna analiza)
 * 2. Fallback → lokalna walidacja JS (podstawowa)
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

const MIN_DPI = 150;
const WARN_DPI = 300;
const PT_TO_MM = 0.3528;

/**
 * Waliduje plik — preferuje Python service, fallback na lokalna walidacje.
 */
export async function validateFile(
  buffer: Buffer,
  mimeType: string,
  fileName?: string
): Promise<PreflightResult> {
  const serviceUrl = process.env.PREFLIGHT_SERVICE_URL;

  if (serviceUrl) {
    try {
      const result = await validateViaPython(serviceUrl, buffer, fileName ?? "file");
      if (result) return result;
    } catch (err) {
      console.warn("[PREFLIGHT] Python service error, falling back to JS:", err);
    }
  }

  return validateLocally(buffer, mimeType);
}

/**
 * Python microservice preflight (FastAPI).
 */
async function validateViaPython(
  serviceUrl: string,
  buffer: Buffer,
  fileName: string
): Promise<PreflightResult | null> {
  const url = `${serviceUrl}/validate`;
  const secret = process.env.PREFLIGHT_SECRET;

  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(buffer)]), fileName);

  const headers: Record<string, string> = {};
  if (secret) headers["Authorization"] = `Bearer ${secret}`;

  const res = await fetch(url, {
    method: "POST",
    body: formData,
    headers,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    console.error("[PREFLIGHT] Python service returned %d", res.status);
    return null;
  }

  const data = await res.json();

  return {
    status: data.status,
    checks: (data.checks ?? []).map((c: Record<string, unknown>) => ({
      status: c.status,
      label: c.label,
      value: c.value,
      message: c.message ?? undefined,
    })),
    validatedAt: new Date().toISOString(),
  };
}

/**
 * Lokalna walidacja JS (fallback).
 */
async function validateLocally(
  buffer: Buffer,
  mimeType: string
): Promise<PreflightResult> {
  const checks: PreflightCheck[] = [];

  try {
    if (mimeType.startsWith("image/")) {
      const metadata = await sharp(buffer).metadata();

      const dpi = metadata.density ?? 72;
      if (dpi < MIN_DPI) {
        checks.push({
          status: "failed",
          label: "DPI",
          value: `${dpi}`,
          message: `Za niska rozdzielczość (${dpi} DPI). Minimum do druku: ${MIN_DPI} DPI.`,
        });
      } else if (dpi < WARN_DPI) {
        checks.push({
          status: "warning",
          label: "DPI",
          value: `${dpi}`,
          message: `Rozdzielczość ${dpi} DPI — poniżej zalecanego 300 DPI.`,
        });
      } else {
        checks.push({ status: "passed", label: "DPI", value: `${dpi}` });
      }

      const w = metadata.width ?? 0;
      const h = metadata.height ?? 0;
      if (w < 200 || h < 200) {
        checks.push({
          status: "failed",
          label: "Wymiary",
          value: `${w}x${h} px`,
          message: "Plik za mały do druku (mniej niż 200px).",
        });
      } else {
        const widthMm = Math.round((w / dpi) * 25.4);
        const heightMm = Math.round((h / dpi) * 25.4);
        checks.push({
          status: "passed",
          label: "Wymiary",
          value: `${w}x${h} px (${widthMm}x${heightMm} mm @ ${dpi} DPI)`,
        });
      }

      const space = metadata.space ?? "unknown";
      if (space === "cmyk") {
        checks.push({ status: "passed", label: "Profil", value: "CMYK" });
      } else if (space === "srgb" || space === "rgb") {
        checks.push({
          status: "warning",
          label: "Profil",
          value: "RGB",
          message: "Plik w profilu RGB — zalecana konwersja do CMYK.",
        });
      } else {
        checks.push({ status: "passed", label: "Profil", value: space.toUpperCase() });
      }
    } else if (mimeType === "application/pdf") {
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();

      checks.push({ status: "passed", label: "Strony", value: `${pages.length}` });

      if (pages.length > 0) {
        const { width, height } = pages[0].getSize();
        const widthMm = Math.round(width * PT_TO_MM);
        const heightMm = Math.round(height * PT_TO_MM);
        checks.push({ status: "passed", label: "Wymiary", value: `${widthMm}x${heightMm} mm` });
      }
    } else {
      checks.push({
        status: "warning",
        label: "Format",
        value: mimeType,
        message: "Ten format nie jest sprawdzany automatycznie.",
      });
    }
  } catch (err) {
    checks.push({
      status: "failed",
      label: "Błąd",
      value: "Nie udało się przeczytać pliku",
      message: err instanceof Error ? err.message : "Nieznany błąd",
    });
  }

  let overall: "passed" | "warning" | "failed" = "passed";
  for (const check of checks) {
    if (check.status === "failed") { overall = "failed"; break; }
    if (check.status === "warning") overall = "warning";
  }

  return { status: overall, checks, validatedAt: new Date().toISOString() };
}

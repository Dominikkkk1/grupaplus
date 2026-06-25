import { PDFDocument } from "pdf-lib";

/**
 * Preflight — walidacja plikow do druku.
 *
 * Strategia:
 * 1. Jesli PREFLIGHT_SERVICE_URL ustawiony → Python microservice (pelna analiza: DPI, CMYK, czcionki)
 * 2. Fallback → lokalna walidacja JS (tylko PDF wymiary, bez sharp)
 *
 * sharp usuniety — nie dziala na Vercel serverless (brak libvips).
 * Cala analiza obrazkow delegowana do Python service.
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

const PT_TO_MM = 0.3528;

/**
 * Waliduje plik — preferuje Python service, fallback na lokalna walidacje.
 */
export async function validateFile(
  buffer: Buffer,
  mimeType: string,
  fileName?: string,
  targetWidth?: number | null,
  targetHeight?: number | null,
): Promise<PreflightResult> {
  const serviceUrl = process.env.PREFLIGHT_SERVICE_URL;

  if (serviceUrl) {
    try {
      const result = await validateViaPython(serviceUrl, buffer, fileName ?? "file", targetWidth, targetHeight);
      if (result) return result;
    } catch (err) {
      console.warn("[PREFLIGHT] Python service error, falling back to JS:", err);
    }
  }

  return validateLocally(buffer, mimeType);
}

/**
 * Python microservice preflight (FastAPI on Railway).
 */
async function validateViaPython(
  serviceUrl: string,
  buffer: Buffer,
  fileName: string,
  targetWidth?: number | null,
  targetHeight?: number | null,
): Promise<PreflightResult | null> {
  let url = `${serviceUrl}/validate`;
  const params = new URLSearchParams();
  if (targetWidth) params.set("target_width_mm", String(targetWidth));
  if (targetHeight) params.set("target_height_mm", String(targetHeight));
  if (params.toString()) url += `?${params.toString()}`;
  const secret = process.env.PREFLIGHT_SECRET;

  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(buffer)]), fileName);

  const headers: Record<string, string> = {};
  if (secret) headers["Authorization"] = `Bearer ${secret}`;

  const res = await fetch(url, {
    method: "POST",
    body: formData,
    headers,
    signal: AbortSignal.timeout(30000),
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
 * Lokalna walidacja JS (fallback — bez sharp, tylko PDF).
 * Obrazki: zwraca warning ze nie mozna sprawdzic bez Python service.
 */
async function validateLocally(
  buffer: Buffer,
  mimeType: string
): Promise<PreflightResult> {
  const checks: PreflightCheck[] = [];

  try {
    if (mimeType.startsWith("image/")) {
      // Bez sharp nie mozemy sprawdzic DPI/profilu — info dla usera
      checks.push({
        status: "warning",
        label: "Analiza",
        value: "Ograniczona",
        message: "Serwis preflight niedostępny — DPI i profil kolorów nie zostały sprawdzone.",
      });
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

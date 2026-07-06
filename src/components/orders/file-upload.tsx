"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface PreflightCheck {
  status: "passed" | "warning" | "failed";
  label: string;
  value: string;
  message?: string;
}

interface OrderFile {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  file_path: string;
  preflight_status: string | null;
  preflight_result: { checks?: PreflightCheck[] } | null;
  created_at: string;
}

export function FileUpload({
  orderId,
  orderItemId,
  files,
}: {
  orderId: string;
  orderItemId?: string;
  files: OrderFile[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [deleteFile, setDeleteFile] = useState<OrderFile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [preflightWarning, setPreflightWarning] = useState("");
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});

  // Generuj miniaturki dla obrazow (rownolegle, nie blokujace)
  const fileIds = files.map((f) => f.id).join(",");
  useEffect(() => {
    const supabase = createClient();
    const imageFiles = files.filter((f) => f.mime_type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    let cancelled = false;
    Promise.all(
      imageFiles.map(async (f) => {
        const { data } = await supabase.storage
          .from("order-files")
          .createSignedUrl(f.file_path, 600);
        return [f.id, data?.signedUrl] as const;
      })
    ).then((results) => {
      if (cancelled) return;
      const urls: Record<string, string> = {};
      for (const [id, url] of results) {
        if (url) urls[id] = url;
      }
      setThumbUrls(urls);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileIds]);

  // Prosty preflight: sprawdz rozmiar obrazka i DPI
  async function checkImageDpi(file: File): Promise<string | null> {
    if (!file.type.startsWith("image/")) return null;

    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        // Jesli obraz mniejszy niz 1000px w obu wymiarach — prawdopodobnie niskie DPI
        if (img.width < 1000 || img.height < 1000) {
          resolve(
            `Uwaga: obraz ma ${img.width}x${img.height}px — moze miec za niska rozdzielczosc do druku (zalecane min. 300 DPI)`
          );
        } else {
          resolve(null);
        }
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        resolve(null);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setPreflightWarning("");
    setUploading(true);

    // Prosty preflight dla obrazkow
    const warning = await checkImageDpi(file);
    if (warning) {
      setPreflightWarning(warning);
    }

    // Walidacja rozszerzenia client-side
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!["pdf", "jpg", "jpeg", "png", "tiff", "tif"].includes(ext)) {
      setError("Niedozwolony typ pliku (dozwolone: PDF, JPG, PNG, TIFF)");
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setError("Plik za duży — maksymalny rozmiar to 100 MB");
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      // Direct upload do Supabase Storage (bypass Vercel 4.5MB limit)
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${orderId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("order-files")
        .upload(filePath, file, { contentType: file.type });

      if (uploadError) {
        setError(`Błąd uploadu: ${uploadError.message}`);
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // Zapisz metadata + triggeruj preflight przez API (mały request, bez pliku)
      const res = await fetch(`/api/orders/${orderId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          orderItemId: orderItemId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Błąd serwera" }));
        setError(data.error || "Błąd zapisu metadanych");
      }
    } catch (err) {
      setError("Błąd uploadu — sprawdź połączenie");
      console.error("[UPLOAD] error:", err);
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  async function handleDownload(file: OrderFile) {
    const supabase = createClient();
    const { data } = await supabase.storage
      .from("order-files")
      .createSignedUrl(file.file_path, 60);

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  }

  async function handleDelete() {
    if (!deleteFile) return;
    setDeleteLoading(true);

    const res = await fetch(
      `/api/orders/${orderId}/files?fileId=${deleteFile.id}`,
      { method: "DELETE" }
    );

    if (res.ok) {
      setDeleteFile(null);
      setDeleteLoading(false);
      router.refresh();
    } else {
      setDeleteLoading(false);
      setDeleteFile(null);
      setError("Nie udało się usunąć pliku");
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const FileThumbnail = ({ file }: { file: OrderFile }) => {
    const thumbUrl = thumbUrls[file.id];
    if (file.mime_type.startsWith("image/") && thumbUrl) {
      return (
        <img
          src={thumbUrl}
          alt=""
          className="h-10 w-10 flex-shrink-0 rounded border border-zinc-200 object-cover"
        />
      );
    }
    return (
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded border border-zinc-200 bg-zinc-50">
        <FileText size={16} className="text-zinc-400" />
      </div>
    );
  };

  return (
    <div>
      {/* Lista plikow */}
      {files.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {files.map((file) => (
            <div
              key={file.id}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <FileThumbnail file={file} />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[12px] font-medium text-zinc-900">
                    {file.file_name}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {formatSize(file.file_size)}
                  </p>
                </div>
                {/* Preflight badge */}
                {file.preflight_status && file.preflight_status !== "pending" && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      file.preflight_status === "passed"
                        ? "bg-emerald-50 text-emerald-600"
                        : file.preflight_status === "warning"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-red-50 text-red-600"
                    }`}
                  >
                    {file.preflight_status === "passed"
                      ? "OK"
                      : file.preflight_status === "warning"
                        ? "Uwaga"
                        : "Blad"}
                  </span>
                )}
              <button
                onClick={() => handleDownload(file)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                title="Pobierz"
              >
                <Download size={14} />
              </button>
              <button
                onClick={() => setDeleteFile(file)}
                className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                title="Usuń"
              >
                <Trash2 size={14} />
              </button>
              </div>
              {/* Szczegóły preflight */}
              {file.preflight_result?.checks &&
                file.preflight_result.checks.some(
                  (c) => c.status !== "passed"
                ) && (
                  <div className="mt-1.5 space-y-0.5 border-t border-zinc-100 pt-1.5">
                    {file.preflight_result.checks
                      .filter((c) => c.message)
                      .map((c, ci) => (
                        <p
                          key={ci}
                          className={`text-[11px] ${
                            c.status === "failed"
                              ? "text-red-600"
                              : "text-amber-600"
                          }`}
                        >
                          {c.label}: {c.message}
                        </p>
                      ))}
                  </div>
                )}
            </div>
          ))}
        </div>
      )}

      {/* Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
        onChange={handleUpload}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 py-2.5 text-[12px] font-medium text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-700 disabled:opacity-50"
      >
        {uploading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Uploadowanie...
          </>
        ) : (
          <>
            <Upload size={14} />
            Dodaj plik (PDF, JPG, PNG)
          </>
        )}
      </button>

      {error && (
        <p className="mt-2 text-[12px] text-red-600">{error}</p>
      )}

      {preflightWarning && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
          {preflightWarning}
        </div>
      )}

      {deleteFile && (
        <ConfirmDialog
          title="Usuń plik"
          message={`Usunąć "${deleteFile.file_name}"?`}
          loading={deleteLoading}
          onConfirm={handleDelete}
          onCancel={() => setDeleteFile(null)}
        />
      )}
    </div>
  );
}

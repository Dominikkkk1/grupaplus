"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface OrderFile {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  file_path: string;
  created_at: string;
}

export function FileUpload({
  orderId,
  files,
}: {
  orderId: string;
  files: OrderFile[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [deleteFile, setDeleteFile] = useState<OrderFile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [preflightWarning, setPreflightWarning] = useState("");

  // Prosty preflight: sprawdz rozmiar obrazka i DPI
  async function checkImageDpi(file: File): Promise<string | null> {
    if (!file.type.startsWith("image/")) return null;

    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        // Jesli obraz mniejszy niz 1000px w obu wymiarach — prawdopodobnie niskie DPI
        if (img.width < 1000 && img.height < 1000) {
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

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/orders/${orderId}/files`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Blad uploadu");
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
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const FileIcon = ({ mime }: { mime: string }) =>
    mime.startsWith("image/") ? (
      <ImageIcon size={16} className="text-blue-500" />
    ) : (
      <FileText size={16} className="text-red-500" />
    );

  return (
    <div>
      {/* Lista plikow */}
      {files.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2"
            >
              <FileIcon mime={file.mime_type} />
              <div className="flex-1 min-w-0">
                <p className="truncate text-[12px] font-medium text-zinc-900">
                  {file.file_name}
                </p>
                <p className="text-[11px] text-zinc-400">
                  {formatSize(file.file_size)}
                </p>
              </div>
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
                title="Usun"
              >
                <Trash2 size={14} />
              </button>
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
          title="Usun plik"
          message={`Usunac "${deleteFile.file_name}"?`}
          loading={deleteLoading}
          onConfirm={handleDelete}
          onCancel={() => setDeleteFile(null)}
        />
      )}
    </div>
  );
}

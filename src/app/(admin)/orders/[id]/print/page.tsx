"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";

interface OrderData {
  order_number: string;
  source: string;
  status: string;
  payment_status: string;
  is_priority: boolean;
  delivery_type: string;
  shipping_method: string | null;
  total_price: number | null;
  notes: string | null;
  deadline: string | null;
  created_at: string;
  contact: { full_name: string; email: string | null; phone: string | null } | null;
  company: { name: string; nip: string | null } | null;
}

interface OrderItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number | null;
  product: { name: string; sku: string | null } | null;
  progress: { step_order: number; branch_type?: string; step: { name: string } }[];
}

interface OrderFile {
  file_name: string;
  file_path: string;
  mime_type: string;
  preflight_status: string | null;
  order_item_id: string | null;
}

export default function PrintPage() {
  const params = useParams();
  const id = params.id as string;

  const [order, setOrder] = useState<OrderData | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    const [orderRes, itemsRes, filesRes] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "order_number, source, status, payment_status, is_priority, delivery_type, shipping_method, total_price, notes, deadline, created_at, contact:contacts(full_name, email, phone), company:companies(name, nip)"
        )
        .eq("id", id)
        .single(),
      supabase
        .from("order_items")
        .select(
          "id, description, quantity, unit_price, product:products(name, sku), progress:order_item_progress(step_order, branch_type, step:workflow_steps(name))"
        )
        .eq("order_id", id)
        .order("created_at"),
      supabase
        .from("order_files")
        .select("file_name, file_path, mime_type, preflight_status, order_item_id")
        .eq("order_id", id),
    ]);

    setOrder(orderRes.data as unknown as OrderData);
    const fetchedItems = (itemsRes.data ?? []) as unknown as OrderItem[];
    setItems(fetchedItems);
    const fetchedFiles = (filesRes.data ?? []) as unknown as OrderFile[];
    setFiles(fetchedFiles);

    // Generuj signed URLs dla miniaturek (rownolegle)
    const thumbEntries = await Promise.all(
      fetchedItems.map(async (item) => {
        const itemFile = fetchedFiles.find(
          (f) => f.order_item_id === item.id && f.mime_type.startsWith("image/")
        );
        if (!itemFile) return null;
        const { data: signed } = await supabase.storage
          .from("order-files")
          .createSignedUrl(itemFile.file_path, 600);
        return signed?.signedUrl ? [item.id, signed.signedUrl] as const : null;
      })
    );
    const thumbMap: Record<string, string> = {};
    for (const entry of thumbEntries) {
      if (entry) thumbMap[entry[0]] = entry[1];
    }
    setThumbnails(thumbMap);

    // Generuj QR kod
    const url = `${window.location.origin}/orders/${id}`;
    const qr = await QRCode.toDataURL(url, { width: 200, margin: 1 });
    setQrDataUrl(qr);

    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-zinc-400">Przygotowywanie karty...</p>
      </div>
    );
  }

  if (!order) {
    return <p className="p-8 text-zinc-500">Zamówienie nie znalezione</p>;
  }

  const paymentLabel =
    order.payment_status === "paid"
      ? "Opłacone"
      : order.payment_status === "cod"
        ? "Za pobraniem"
        : "Oczekuje";

  const isAllegro = order.source === "allegro";

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; font-size: 11px; }
          .no-print { display: none !important; }
          .print-page { page-break-after: auto; }
        }
        @media screen {
          body { background: #f4f4f5; }
          .print-page { max-width: 700px; margin: 2rem auto; background: white; padding: 2rem; border: 1px solid #e4e4e7; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        }
      `}</style>

      <div className="no-print fixed top-4 right-4 z-50">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-zinc-800"
        >
          Drukuj (Ctrl+P)
        </button>
      </div>

      <div className="print-page" style={{ fontFamily: "Arial, sans-serif" }}>
        {/* === GORA: PRODUKCJA === */}
        <div style={{ borderBottom: "2px dashed #d4d4d8", paddingBottom: "1.5rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
            <div>
              <h1 style={{ fontSize: "1.25rem", fontWeight: "bold", margin: 0 }}>
                KARTA PRODUKCYJNA
                {order.is_priority && (
                  <span style={{ marginLeft: "0.5rem", color: "#d97706", fontSize: "1rem" }}>★ PRIORYTET</span>
                )}
              </h1>
              <p style={{ fontSize: "1.1rem", fontWeight: "bold", fontFamily: "monospace", marginTop: "0.25rem" }}>
                {order.order_number}
              </p>
            </div>
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR" style={{ width: "150px", height: "150px" }} />
            )}
          </div>

          <div style={{ display: "flex", gap: "2rem", fontSize: "0.85rem", color: "#52525b", marginBottom: "1rem", flexWrap: "wrap" }}>
            <span>Data: {new Date(order.created_at).toLocaleDateString("pl-PL")}</span>
            {order.deadline && !isAllegro && (
              <span style={{ fontWeight: "bold", color: "#dc2626" }}>
                Termin: {new Date(order.deadline).toLocaleDateString("pl-PL")}
              </span>
            )}
            <span style={{ fontWeight: "bold", color: order.delivery_type === "pickup" ? "#059669" : "#52525b" }}>
              {order.delivery_type === "pickup" ? "ODBIÓR OSOBISTY" : "WYSYŁKA"}
            </span>
          </div>

          {/* Termin Allegro — prominentny box */}
          {isAllegro && order.deadline && (
            <div style={{
              marginBottom: "1rem",
              padding: "0.5rem 0.75rem",
              border: "2px solid #dc2626",
              borderRadius: "6px",
              background: "#fef2f2",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            } as React.CSSProperties}>
              <span style={{ fontWeight: "bold", color: "#dc2626", fontSize: "0.95rem" }}>
                TERMIN ALLEGRO
              </span>
              <span style={{ fontWeight: "bold", color: "#dc2626", fontSize: "1.1rem", fontFamily: "monospace" }}>
                {new Date(order.deadline).toLocaleDateString("pl-PL")}
              </span>
            </div>
          )}

          <h2 style={{ fontSize: "0.9rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717a", marginBottom: "0.75rem" }}>
            Pozycje
          </h2>

          {items.map((item, idx) => {
            const allSteps = [...(item.progress ?? [])].sort((a, b) => a.step_order - b.step_order);
            const thumbUrl = thumbnails[item.id];
            const itemFiles = files.filter((f) => f.order_item_id === item.id);
            const hasPdf = itemFiles.some((f) => f.mime_type === "application/pdf");
            const preflightFile = itemFiles.find((f) => f.preflight_status && f.preflight_status !== "pending") ?? itemFiles[0];
            const preflightStatus = preflightFile?.preflight_status;
            const hasFork = allSteps.some((s) => s.branch_type === "branch_a" || s.branch_type === "branch_b");

            const renderItemHeader = (label?: string) => (
              <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.5rem" }}>
                {thumbUrl ? (
                  <img src={thumbUrl} alt="" style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "4px", border: "1px solid #e4e4e7", flexShrink: 0 }} />
                ) : hasPdf ? (
                  <div style={{ width: "60px", height: "60px", borderRadius: "4px", border: "1px solid #e4e4e7", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa", flexShrink: 0, fontSize: "0.65rem", color: "#a1a1aa", fontWeight: "bold" }}>PDF</div>
                ) : null}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong style={{ fontSize: "0.9rem" }}>
                      {idx + 1}. {item.product?.name ?? item.description}
                      {label && <span style={{ marginLeft: "0.5rem", color: label === "A" ? "#2563eb" : "#059669", fontSize: "1rem", fontWeight: "bold" }}>— KARTA {label}</span>}
                    </strong>
                    <span style={{ fontSize: "0.85rem", color: "#71717a" }}>{item.quantity} szt.</span>
                  </div>
                  {item.product?.sku && <p style={{ fontSize: "0.75rem", color: "#a1a1aa", fontFamily: "monospace", margin: "0.15rem 0" }}>SKU: {item.product.sku}</p>}
                  {preflightStatus && preflightStatus !== "pending" && (
                    <span style={{ display: "inline-block", padding: "0.1rem 0.4rem", borderRadius: "3px", fontSize: "0.7rem", fontWeight: "bold", marginTop: "0.15rem", background: preflightStatus === "passed" ? "#dcfce7" : preflightStatus === "warning" ? "#fef9c3" : "#fee2e2", color: preflightStatus === "passed" ? "#166534" : preflightStatus === "warning" ? "#854d0e" : "#991b1b", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                      {preflightStatus === "passed" ? "✓ Zweryfikowany" : preflightStatus === "warning" ? "⚠ Ostrzeżenia" : "✗ Błędy"}
                    </span>
                  )}
                </div>
              </div>
            );

            const renderSteps = (stepsToRender: typeof allSteps, highlightBranch?: string) => (
              stepsToRender.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {stepsToRender.map((s, si) => {
                    const isBranchStep = s.branch_type === highlightBranch;
                    return (
                      <span key={si} style={{
                        display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.2rem 0.5rem",
                        border: isBranchStep ? "2px solid #7c3aed" : "1px solid #d4d4d8",
                        borderRadius: "4px", fontSize: "0.8rem",
                        fontWeight: isBranchStep ? "bold" : "normal",
                        background: isBranchStep ? "#f5f3ff" : "transparent",
                      }}>
                        <span style={{ display: "inline-block", width: "10px", height: "10px", border: "1.5px solid #a1a1aa", borderRadius: "2px" }} />
                        {s.step?.name}
                      </span>
                    );
                  })}
                </div>
              ) : null
            );

            if (!hasFork) {
              // Liniowy — 1 karta jak dotychczas
              return (
                <div key={idx} style={{ marginBottom: "1rem", padding: "0.75rem", border: "1px solid #e4e4e7", borderRadius: "6px" }}>
                  {renderItemHeader()}
                  {renderSteps(allSteps)}
                </div>
              );
            }

            // Fork/Join — 2 karty (A + B)
            const preFork = allSteps.filter((s) => (s.branch_type ?? "common") === "common" && s.step_order < 100);
            const branchA = allSteps.filter((s) => s.branch_type === "branch_a");
            const branchB = allSteps.filter((s) => s.branch_type === "branch_b");
            const postJoin = allSteps.filter((s) => (s.branch_type ?? "common") === "common" && s.step_order >= 100);
            const stepsA = [...preFork, ...branchA, ...postJoin];
            const stepsB = [...preFork, ...branchB, ...postJoin];

            return (
              <div key={idx}>
                {/* KARTA A */}
                <div style={{ marginBottom: "1rem", padding: "0.75rem", border: "2px solid #2563eb", borderRadius: "6px" }}>
                  {renderItemHeader("A")}
                  {renderSteps(stepsA, "branch_a")}
                </div>

                {/* Page break dla druku */}
                <div style={{ pageBreakBefore: "always" }} />

                {/* KARTA B */}
                <div style={{ marginBottom: "1rem", padding: "0.75rem", border: "2px solid #059669", borderRadius: "6px" }}>
                  {renderItemHeader("B")}
                  {renderSteps(stepsB, "branch_b")}
                </div>
              </div>
            );
          })}

          {order.notes && (
            <div style={{ marginTop: "0.75rem", padding: "0.5rem 0.75rem", background: "#fef3c7", border: "2px solid #f59e0b", borderRadius: "4px", fontSize: "0.95rem", color: "#78350f", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
              <strong>UWAGI:</strong> {order.notes}
            </div>
          )}
        </div>

        {/* === DOL: DANE KLIENTA === */}
        <div>
          <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#a1a1aa", marginBottom: "0.75rem" }}>
            Dane klienta (odetnij po zakończeniu)
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.85rem" }}>
            <div>
              <span style={{ color: "#71717a" }}>Klient: </span>
              <strong>
                {(order.contact as unknown as { full_name: string })?.full_name ?? "\u2014"}
              </strong>
            </div>
            {order.company && (
              <div>
                <span style={{ color: "#71717a" }}>Firma: </span>
                <strong>{(order.company as unknown as { name: string }).name}</strong>
              </div>
            )}
            {(order.contact as unknown as { phone: string | null })?.phone && (
              <div>
                <span style={{ color: "#71717a" }}>Tel: </span>
                {(order.contact as unknown as { phone: string }).phone}
              </div>
            )}
            {(order.contact as unknown as { email: string | null })?.email && (
              <div>
                <span style={{ color: "#71717a" }}>Email: </span>
                {(order.contact as unknown as { email: string }).email}
              </div>
            )}
            <div>
              <span style={{ color: "#71717a" }}>Płatność: </span>
              <strong>{paymentLabel}</strong>
            </div>
            {order.total_price && (
              <div>
                <span style={{ color: "#71717a" }}>Wartość: </span>
                <strong>{order.total_price.toLocaleString("pl-PL")} zł</strong>
              </div>
            )}
            {order.shipping_method && (
              <div>
                <span style={{ color: "#71717a" }}>Wysyłka: </span>
                {order.shipping_method}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

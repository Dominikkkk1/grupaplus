"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";

interface OrderData {
  order_number: string;
  status: string;
  payment_status: string;
  shipping_method: string | null;
  total_price: number | null;
  notes: string | null;
  deadline: string | null;
  created_at: string;
  contact: { full_name: string; email: string | null; phone: string | null } | null;
  company: { name: string; nip: string | null } | null;
}

interface OrderItem {
  description: string;
  quantity: number;
  unit_price: number | null;
  product: { name: string; sku: string | null } | null;
  progress: { step_order: number; step: { name: string } }[];
}

export default function PrintPage() {
  const params = useParams();
  const id = params.id as string;

  const [order, setOrder] = useState<OrderData | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    const [orderRes, itemsRes] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "order_number, status, payment_status, shipping_method, total_price, notes, deadline, created_at, contact:contacts(full_name, email, phone), company:companies(name, nip)"
        )
        .eq("id", id)
        .single(),
      supabase
        .from("order_items")
        .select(
          "description, quantity, unit_price, product:products(name, sku), progress:order_item_progress(step_order, step:workflow_steps(name))"
        )
        .eq("order_id", id)
        .order("created_at"),
    ]);

    setOrder(orderRes.data as unknown as OrderData);
    setItems((itemsRes.data ?? []) as unknown as OrderItem[]);

    // Generuj QR kod
    const url = `${window.location.origin}/orders/${id}`;
    const qr = await QRCode.toDataURL(url, { width: 120, margin: 1 });
    setQrDataUrl(qr);

    setLoading(false);

    // Auto-print po zaladowaniu
    setTimeout(() => window.print(), 500);
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
    return <p className="p-8 text-zinc-500">Zamowienie nie znalezione</p>;
  }

  const paymentLabel =
    order.payment_status === "paid"
      ? "Oplacone"
      : order.payment_status === "cod"
        ? "Za pobraniem"
        : "Oczekuje";

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
              </h1>
              <p style={{ fontSize: "1.1rem", fontWeight: "bold", fontFamily: "monospace", marginTop: "0.25rem" }}>
                {order.order_number}
              </p>
            </div>
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR" style={{ width: "100px", height: "100px" }} />
            )}
          </div>

          <div style={{ display: "flex", gap: "2rem", fontSize: "0.85rem", color: "#52525b", marginBottom: "1rem" }}>
            <span>Data: {new Date(order.created_at).toLocaleDateString("pl-PL")}</span>
            {order.deadline && (
              <span style={{ fontWeight: "bold", color: "#dc2626" }}>
                Termin: {new Date(order.deadline).toLocaleDateString("pl-PL")}
              </span>
            )}
          </div>

          <h2 style={{ fontSize: "0.9rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717a", marginBottom: "0.75rem" }}>
            Pozycje
          </h2>

          {items.map((item, idx) => {
            const steps = [...(item.progress ?? [])].sort(
              (a, b) => a.step_order - b.step_order
            );
            return (
              <div key={idx} style={{ marginBottom: "1rem", padding: "0.75rem", border: "1px solid #e4e4e7", borderRadius: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <strong style={{ fontSize: "0.9rem" }}>
                    {idx + 1}. {item.product?.name ?? item.description}
                  </strong>
                  <span style={{ fontSize: "0.85rem", color: "#71717a" }}>
                    {item.quantity} szt.
                  </span>
                </div>
                {item.product?.sku && (
                  <p style={{ fontSize: "0.75rem", color: "#a1a1aa", fontFamily: "monospace", marginBottom: "0.5rem" }}>
                    SKU: {item.product.sku}
                  </p>
                )}
                {steps.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {steps.map((s, si) => (
                      <span
                        key={si}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          padding: "0.2rem 0.5rem",
                          border: "1px solid #d4d4d8",
                          borderRadius: "4px",
                          fontSize: "0.8rem",
                        }}
                      >
                        <span style={{ display: "inline-block", width: "10px", height: "10px", border: "1.5px solid #a1a1aa", borderRadius: "2px" }} />
                        {s.step?.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {order.notes && (
            <div style={{ marginTop: "0.75rem", padding: "0.5rem 0.75rem", background: "#fafafa", border: "1px solid #e4e4e7", borderRadius: "4px", fontSize: "0.85rem", color: "#52525b" }}>
              <strong>Uwagi:</strong> {order.notes}
            </div>
          )}
        </div>

        {/* === DOL: DANE KLIENTA === */}
        <div>
          <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#a1a1aa", marginBottom: "0.75rem" }}>
            Dane klienta (odetnij po zakonczeniu)
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
              <span style={{ color: "#71717a" }}>Platnosc: </span>
              <strong>{paymentLabel}</strong>
            </div>
            {order.total_price && (
              <div>
                <span style={{ color: "#71717a" }}>Wartosc: </span>
                <strong>{order.total_price.toLocaleString("pl-PL")} zl</strong>
              </div>
            )}
            {order.shipping_method && (
              <div>
                <span style={{ color: "#71717a" }}>Wysylka: </span>
                {order.shipping_method}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

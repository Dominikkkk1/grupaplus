"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, X, Star, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
  lead_time_days: number | null;
}

interface ContactOption {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company_id: string | null;
  is_blacklisted: boolean;
}

interface CompanyOption {
  id: string;
  name: string;
  nip: string | null;
}

export function NewOrderForm({
  products,
  contacts = [],
  companies = [],
  onClose,
}: {
  products: ProductOption[];
  contacts?: ContactOption[];
  companies?: CompanyOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Sugestie kontaktow/firm na podstawie wpisanego tekstu
  const suggestions = customerName.length >= 2
    ? [
        ...contacts
          .filter((c) => c.full_name.toLowerCase().includes(customerName.toLowerCase()))
          .slice(0, 3)
          .map((c) => ({
            type: "contact" as const,
            label: c.full_name,
            sub: c.email || c.phone || "",
            contact: c,
          })),
        ...companies
          .filter((c) => c.name.toLowerCase().includes(customerName.toLowerCase()))
          .slice(0, 3)
          .map((c) => ({
            type: "company" as const,
            label: c.name,
            sub: c.nip ? `NIP: ${c.nip}` : "",
            company: c,
          })),
      ]
    : [];

  function selectContact(contact: ContactOption) {
    setCustomerName(contact.full_name);
    setCustomerEmail(contact.email ?? "");
    setCustomerPhone(contact.phone ?? "");
    setIsBlacklisted(contact.is_blacklisted ?? false);
    setShowSuggestions(false);
    // Znajdz firme kontaktu
    if (contact.company_id) {
      const company = companies.find((c) => c.id === contact.company_id);
      if (company) {
        setNip(company.nip ?? "");
      }
    }
  }

  function selectCompany(company: CompanyOption) {
    setCustomerName(company.name);
    setNip(company.nip ?? "");
    setShowSuggestions(false);
  }

  const [nip, setNip] = useState("");
  const [source, setSource] = useState<string>("stacjonarne");
  const [paymentStatus, setPaymentStatus] = useState<string>("cod");
  const [isPriority, setIsPriority] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [isBlacklisted, setIsBlacklisted] = useState(false);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([
    { productId: "", description: "", quantity: 1 },
  ]);

  function addItem() {
    setItems([...items, { productId: "", description: "", quantity: 1 }]);
  }

  function removeItem(index: number) {
    if (items.length === 1) return;
    const remaining = items.filter((_, i) => i !== index);
    setItems(remaining);
    // Przelicz deadline z remaining items
    const maxLeadTime = remaining.reduce((max, item) => {
      const p = products.find((pr) => pr.id === item.productId);
      return Math.max(max, p?.lead_time_days ?? 0);
    }, 0);
    if (maxLeadTime > 0) {
      const d = new Date();
      d.setDate(d.getDate() + maxLeadTime);
      setDeadline(d.toISOString().split("T")[0]);
    }
  }

  function updateItem(index: number, field: string, value: string | number) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    // Auto-fill description from product
    if (field === "productId" && value) {
      const product = products.find((p) => p.id === value);
      if (product) {
        updated[index].description = product.name;
      }
    }
    setItems(updated);

    // Auto-fill deadline z max lead_time_days
    if (field === "productId") {
      const maxLeadTime = updated.reduce((max, item) => {
        const p = products.find((pr) => pr.id === item.productId);
        return Math.max(max, p?.lead_time_days ?? 0);
      }, 0);
      if (maxLeadTime > 0) {
        const d = new Date();
        d.setDate(d.getDate() + maxLeadTime);
        setDeadline(d.toISOString().split("T")[0]);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const orderItems = items
      .filter((i) => i.description.trim())
      .map((i) => ({
        productId: i.productId || undefined,
        description: i.description,
        quantity: i.quantity,
      }));

    console.log("[ORDER FORM] raw items state:", items);
    console.log("[ORDER FORM] filtered orderItems:", orderItems);

    if (orderItems.length === 0) {
      setError("Dodaj przynajmniej jedną pozycję");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source,
        customerName: customerName || "Klient",
        customerEmail: customerEmail || undefined,
        customerPhone: customerPhone || undefined,
        nip: nip || undefined,
        paymentStatus,
        isPriority,
        deadline: deadline || undefined,
        notes: notes || undefined,
        items: orderItems,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Blad tworzenia zamówienia");
      setLoading(false);
      return;
    }

    const data = await res.json();
    router.push(`/orders/${data.orderId}`);
    router.refresh();
  }

  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [handleEsc]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-16 pb-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-[15px] font-semibold text-zinc-900">
            Nowe zamówienie
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Źródło + platnosc */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
                Źródło
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              >
                <option value="stacjonarne">Stacjonarne</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
                Płatność
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              >
                <option value="cod">Za pobraniem</option>
                <option value="paid">Opłacone</option>
                <option value="pending">Oczekuje</option>
              </select>
            </div>
          </div>

          {/* Klient z autocomplete */}
          <div className="relative">
            <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
              Klient
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                setShowSuggestions(true);
                setIsBlacklisted(false);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Wpisz imie, nazwisko lub nazwe firmy..."
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (s.type === "contact") selectContact(s.contact);
                      else selectCompany(s.company);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-zinc-50"
                  >
                    <span className={`rounded px-1 py-0.5 text-[10px] font-medium ${s.type === "contact" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>
                      {s.type === "contact" ? "Kontakt" : "Firma"}
                    </span>
                    <span className="font-medium text-zinc-900">{s.label}</span>
                    {s.type === "contact" && s.contact.is_blacklisted && (
                      <span className="rounded bg-red-100 px-1 py-0.5 text-[10px] font-medium text-red-600">Czarna lista</span>
                    )}
                    {s.sub && <span className="text-zinc-400">{s.sub}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="Email (opcjonalnie)"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-[13px] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Telefon (opcjonalnie)"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-[13px] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>

          {/* Blacklist warning */}
          {isBlacklisted && (
            <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
              <AlertTriangle size={16} className="flex-shrink-0" />
              <span><strong>Uwaga:</strong> Ten klient jest na czarnej liście!</span>
            </div>
          )}

          {/* Priorytet + Deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
                Termin realizacji
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
            <div className="flex items-end pb-0.5">
              <button
                type="button"
                onClick={() => setIsPriority(!isPriority)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors ${
                  isPriority
                    ? "border-amber-300 bg-amber-50 text-amber-700"
                    : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
                }`}
              >
                <Star size={14} className={isPriority ? "fill-amber-400 text-amber-400" : ""} />
                Priorytet
              </button>
            </div>
          </div>

          {/* Pozycje */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-zinc-600">
              Pozycje
            </label>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <select
                    value={item.productId}
                    onChange={(e) => updateItem(i, "productId", e.target.value)}
                    className="w-44 flex-shrink-0 rounded-lg border border-zinc-300 bg-white px-2 py-2 text-[13px] focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  >
                    <option value="">— Produkt —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      updateItem(i, "description", e.target.value)
                    }
                    placeholder="Opis pozycji"
                    className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-[13px] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(i, "quantity", parseInt(e.target.value) || 1)
                    }
                    className="w-16 rounded-lg border border-zinc-300 px-2 py-2 text-center text-[13px] focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="mt-1.5 rounded p-1 text-zinc-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="mt-2 flex items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-zinc-900"
            >
              <Plus size={14} />
              Dodaj pozycje
            </button>
          </div>

          {/* Uwagi */}
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
              Uwagi (opcjonalnie)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              placeholder="Dodatkowe informacje..."
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-[13px]"
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-zinc-900 text-[13px] text-white hover:bg-zinc-800"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Tworzenie...
                </span>
              ) : (
                "Utworz zamówienie"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

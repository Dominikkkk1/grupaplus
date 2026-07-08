"use client";

import { Copy } from "lucide-react";

export function DuplicateOrderButton({
  items,
  customerName,
  customerEmail,
  customerPhone,
}: {
  items: { productId: string; description: string; quantity: number; unitPrice: string }[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}) {
  return (
    <button
      onClick={() => {
        const dupItems = items.map((i) => ({
          productId: i.productId,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        }));
        sessionStorage.setItem(
          "duplicateOrder",
          JSON.stringify({ items: dupItems, customerName, customerEmail, customerPhone })
        );
        window.location.href = "/orders?newOrder=1&duplicate=1";
      }}
      className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 sm:px-3 sm:py-2 sm:text-[13px]"
    >
      <Copy size={14} />
      <span className="hidden sm:inline">Powiel</span>
    </button>
  );
}

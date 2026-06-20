/**
 * Wspolny interfejs adaptera zamowien.
 * Kazde źródło (WooCommerce, BaseLinker, reczne) mapuje swoj payload na ten format.
 * Wymiana integratora = podmiana jednego pliku adaptera.
 */

export type OrderSource =
  | "allegro"
  | "woo"
  | "email"
  | "stacjonarne"
  | "baselinker";

export interface OrderInput {
  source: OrderSource;
  externalId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  /** Allegro koduje maile — identyfikator to login/ID, NIE email */
  allegroLogin?: string;
  companyName?: string;
  nip?: string;
  shippingAddress?: string;
  shippingMethod?: string;
  paymentStatus: "pending" | "paid" | "cod";
  deadline?: Date;
  items: OrderItemInput[];
  notes?: string;
}

export interface OrderItemInput {
  externalId?: string;
  /** UUID produktu — uzywane przez formularz reczny */
  productId?: string;
  /** SKU do matchowania z tabela products — uzywane przez webhooki */
  productSku?: string;
  description: string;
  quantity: number;
  unitPrice?: number;
  specifications?: Record<string, unknown>;
}

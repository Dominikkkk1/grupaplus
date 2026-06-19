"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ProductForm } from "@/components/products/product-form";
import { WorkflowBuilder } from "@/components/products/workflow-builder";
import { WorkflowStepForm } from "@/components/products/workflow-step-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  base_price: number | null;
  description: string | null;
}

interface Step {
  id: string;
  name: string;
  color: string;
}

interface WorkflowEntry {
  step_id: string;
  step_order: number;
  step: { id: string; name: string; color: string };
}

interface MachineGroup {
  id: string;
  name: string;
}

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const supabase = createClient();

  const [product, setProduct] = useState<Product | null>(null);
  const [allSteps, setAllSteps] = useState<Step[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowEntry[]>([]);
  const [machineGroups, setMachineGroups] = useState<MachineGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showNewStep, setShowNewStep] = useState(false);

  const fetchData = useCallback(async () => {
    const [productRes, stepsRes, workflowRes, groupsRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, sku, category, base_price, description")
        .eq("id", id)
        .single(),
      supabase.from("workflow_steps").select("id, name, color").order("name"),
      supabase
        .from("product_workflow")
        .select("step_id, step_order, step:workflow_steps(id, name, color)")
        .eq("product_id", id)
        .order("step_order"),
      supabase.from("machine_groups").select("id, name").order("name"),
    ]);

    setProduct(productRes.data);
    setAllSteps(stepsRes.data ?? []);
    setWorkflow((workflowRes.data ?? []) as unknown as WorkflowEntry[]);
    setMachineGroups(groupsRes.data ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDelete() {
    setDeleteLoading(true);
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/products");
      router.refresh();
    } else {
      setDeleteLoading(false);
    }
  }

  const initialWorkflow = workflow.map((w) => ({
    stepId: w.step_id,
    stepOrder: w.step_order,
    name: w.step?.name ?? "?",
    color: w.step?.color ?? "#6b7280",
  }));

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[13px] text-zinc-400">Ladowanie...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center">
        <p className="text-zinc-500">Produkt nie znaleziony</p>
        <Link
          href="/products"
          className="mt-2 text-sm text-blue-600 hover:underline"
        >
          Wstecz
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/products"
          className="mb-3 inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft size={14} />
          Produkty
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
              <ClipboardList size={22} className="text-zinc-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900">
                {product.name}
              </h1>
              <p className="text-[13px] text-zinc-500">
                {product.sku ? `SKU: ${product.sku}` : ""}
                {product.sku ? " · " : ""}
                {product.category === "duzy_format"
                  ? "Duzy format"
                  : "Maly format"}
                {product.base_price
                  ? ` · ${product.base_price} zl`
                  : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Pencil size={14} />
              Edytuj
            </button>
            <button
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 size={14} />
              Usun
            </button>
          </div>
        </div>
      </div>

      {product.description && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-[13px] text-zinc-600">{product.description}</p>
        </div>
      )}

      {/* Workflow Builder */}
      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div />
          <button
            onClick={() => setShowNewStep(true)}
            className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-500 hover:text-zinc-900"
          >
            <Plus size={14} />
            Nowy etap produkcji
          </button>
        </div>
        <WorkflowBuilder
          productId={id}
          allSteps={allSteps}
          initialWorkflow={initialWorkflow}
        />
      </div>

      {/* Modals */}
      {showEdit && (
        <ProductForm
          product={product}
          onClose={() => {
            setShowEdit(false);
            fetchData();
          }}
        />
      )}

      {showDelete && (
        <ConfirmDialog
          title="Usun produkt"
          message={`Czy na pewno chcesz usunac "${product.name}"? Workflow zostanie usuniety. Istniejace zamowienia zachowaja swoje etapy.`}
          loading={deleteLoading}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}

      {showNewStep && (
        <WorkflowStepForm
          machineGroups={machineGroups}
          onClose={() => {
            setShowNewStep(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

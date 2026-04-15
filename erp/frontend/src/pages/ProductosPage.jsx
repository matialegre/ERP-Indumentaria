import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { exportExcel } from "../lib/exportUtils";
import Pagination from "../components/Pagination";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Power,
  FileUp,
  CheckCircle,
  AlertTriangle,
  Download,
} from "lucide-react";

/* ── Helpers ──────────────────────────────────────────── */
const badge = (text, color) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
    {text}
  </span>
);

const PAGE_SIZE = 50;
const EXPORT_BATCH_SIZE = 500;
const PRODUCT_EXPORT_COLUMNS = [
  { key: "code", label: "Código" },
  { key: "name", label: "Nombre" },
  { key: "brand", label: "Marca" },
  { key: "category", label: "Categoría" },
  { key: "base_cost", label: "Costo base" },
  { key: "variant_count", label: "Variantes" },
  { key: "total_stock", label: "Stock total" },
  { key: "status", label: "Estado" },
];

const getProductTotalStock = (product) =>
  (product.variants ?? []).reduce((sum, variant) => sum + (variant.stock ?? 0), 0);

const toProductExportRow = (product) => ({
  code: product.code || "",
  name: product.name || "",
  brand: product.brand || "",
  category: product.category || "",
  base_cost: product.base_cost ?? "",
  variant_count: product.variants?.length ?? 0,
  total_stock: getProductTotalStock(product),
  status: product.is_active ? "Activo" : "Inactivo",
});

const buildProductsParams = ({ search = "", providerId = "", skip = 0, limit = PAGE_SIZE }) => {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (providerId) params.set("provider_id", providerId);
  params.set("skip", skip);
  params.set("limit", limit);
  return params;
};

export default function ProductosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [providerId, setProviderId] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [variantModal, setVariantModal] = useState(null); // { productId, variant? }
  const [importResult, setImportResult] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => { setPage(1); }, [search, providerId]);

  /* ── Excel import ─────────────────────────────────── */
  const importMut = useMutation({
    mutationFn: (file) => {
      const form = new FormData();
      form.append("file", file);
      return api.postForm("/products/import-excel", form);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setImportResult(data);
    },
    onError: (e) => setImportResult({ error: e.message || "Error al importar" }),
  });

  function handleExcelFile(e) {
    const file = e.target.files?.[0];
    if (file) { setImportResult(null); importMut.mutate(file); }
    e.target.value = "";
  }

  /* ── Queries ──────────────────────────────────────── */
  const { data: providersData } = useQuery({
    queryKey: ["providers-all"],
    queryFn: () => api.get("/providers/?limit=500"),
    staleTime: 5 * 60 * 1000,
  });
  const providers = providersData?.items ?? [];

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["products", search, providerId, page],
    queryFn: () =>
      api.get(
        `/products/?${buildProductsParams({
          search,
          providerId,
          skip: (page - 1) * PAGE_SIZE,
          limit: PAGE_SIZE,
        })}`
      ),
  });
  const products = pageData?.items ?? [];
  const total = pageData?.total ?? 0;

  /* ── Product mutations ──────────────────────────────── */
  const createMut = useMutation({
    mutationFn: (data) => api.post("/products/", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); setModalOpen(false); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/products/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); setModalOpen(false); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
  const toggleMut = useMutation({
    mutationFn: (id) => api.patch(`/products/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  /* ── Variant mutations ──────────────────────────────── */
  const addVariantMut = useMutation({
    mutationFn: ({ productId, ...data }) => api.post(`/products/${productId}/variants`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); setVariantModal(null); },
  });
  const updateVariantMut = useMutation({
    mutationFn: ({ productId, variantId, ...data }) =>
      api.put(`/products/${productId}/variants/${variantId}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); setVariantModal(null); },
  });
  const deleteVariantMut = useMutation({
    mutationFn: ({ productId, variantId }) =>
      api.delete(`/products/${productId}/variants/${variantId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  /* ── Excel export ─────────────────────────────────── */
  const exportToExcel = async () => {
    if (total === 0 || isExporting) return;

    setIsExporting(true);
    try {
      const items = [];

      for (let skip = 0; skip < total; skip += EXPORT_BATCH_SIZE) {
        const response = await api.get(
          `/products/?${buildProductsParams({
            search,
            providerId,
            skip,
            limit: EXPORT_BATCH_SIZE,
          })}`
        );
        const batch = response?.items ?? [];

        items.push(...batch);
        if (batch.length < EXPORT_BATCH_SIZE) break;
      }

      exportExcel(
        items.map(toProductExportRow),
        `productos-${new Date().toISOString().slice(0, 10)}`,
        PRODUCT_EXPORT_COLUMNS,
        "Productos"
      );
    } catch (error) {
      alert(error.message || "Error al exportar productos");
    } finally {
      setIsExporting(false);
    }
  };

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(p) {
    setEditing(p);
    setModalOpen(true);
  }
  function handleDelete(p) {
    if (confirm(`¿Eliminar "${p.name}"? Se eliminarán todas sus variantes.`)) {
      deleteMut.mutate(p.id);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} producto{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToExcel}
            disabled={total === 0 || isExporting}
            className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-2.5 rounded-lg hover:bg-emerald-700 transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" /> {isExporting ? "Exportando..." : "Exportar Excel"}
          </button>
          <label className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 transition font-medium text-sm cursor-pointer">
            <FileUp className="w-4 h-4" /> Importar Excel
            <input type="file" accept=".xlsx,.xls" onChange={handleExcelFile} className="hidden" />
          </label>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium text-sm"
          >
            <Plus className="w-4 h-4" /> Nuevo Producto
          </button>
        </div>
      </div>

      {/* Import result */}
      {importMut.isPending && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">Importando Excel...</div>
      )}
      {importResult && !importResult.error && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm flex items-start gap-3">
          <CheckCircle size={18} className="text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-800">Importación completada</p>
            <p className="text-green-700">{importResult.created_products} productos nuevos · {importResult.created_variants} variantes nuevas · {importResult.skipped_variants} variantes ya existían</p>
            {importResult.errors?.length > 0 && (
              <div className="mt-2">
                <p className="font-medium text-amber-700 flex items-center gap-1"><AlertTriangle size={14} /> Advertencias:</p>
                {importResult.errors.map((e, i) => <p key={i} className="text-amber-600 text-xs">{e}</p>)}
              </div>
            )}
          </div>
          <button onClick={() => setImportResult(null)} className="ml-auto text-green-500 hover:text-green-700"><X size={16} /></button>
        </div>
      )}
      {importResult?.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle size={16} /> {importResult.error}
          <button onClick={() => setImportResult(null)} className="ml-auto"><X size={16} /></button>
        </div>
      )}

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, código o marca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <select
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
          className="py-2.5 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-700 min-w-[200px]"
        >
          <option value="">Todos los proveedores</option>
          {providers.map((prov) => (
            <option key={prov.id} value={prov.id}>{prov.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No hay productos</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-8"></th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Código</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Marca</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Categoría</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Costo Base</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Variantes</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <ProductRow
                  key={p.id}
                  product={p}
                  expanded={expandedId === p.id}
                  onToggleExpand={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  onEdit={() => openEdit(p)}
                  onDelete={() => handleDelete(p)}
                  onToggleActive={() => toggleMut.mutate(p.id)}
                  onAddVariant={() => setVariantModal({ productId: p.id })}
                  onEditVariant={(v) => setVariantModal({ productId: p.id, variant: v })}
                  onDeleteVariant={(v) => {
                    if (confirm(`¿Eliminar variante ${v.sku}?`)) {
                      deleteVariantMut.mutate({ productId: p.id, variantId: v.id });
                    }
                  }}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination total={total} skip={(page - 1) * PAGE_SIZE} limit={PAGE_SIZE} onPageChange={setPage} />

      {/* Product Modal */}
      {modalOpen && (
        <ProductModal
          product={editing}
          onClose={() => setModalOpen(false)}
          onSave={(data) => {
            if (editing) updateMut.mutate({ id: editing.id, ...data });
            else createMut.mutate(data);
          }}
          loading={createMut.isPending || updateMut.isPending}
        />
      )}

      {/* Variant Modal */}
      {variantModal && (
        <VariantModal
          productId={variantModal.productId}
          variant={variantModal.variant}
          onClose={() => setVariantModal(null)}
          onSave={(data) => {
            if (variantModal.variant) {
              updateVariantMut.mutate({
                productId: variantModal.productId,
                variantId: variantModal.variant.id,
                ...data,
              });
            } else {
              addVariantMut.mutate({ productId: variantModal.productId, ...data });
            }
          }}
          loading={addVariantMut.isPending || updateVariantMut.isPending}
        />
      )}
    </div>
  );
}

/* ── Product Row (expandable) ─────────────────────────── */
function ProductRow({ product: p, expanded, onToggleExpand, onEdit, onDelete, onToggleActive, onAddVariant, onEditVariant, onDeleteVariant }) {
  const totalStock = getProductTotalStock(p);
  return (
    <>
      <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition">
        <td className="px-4 py-3">
          <button onClick={onToggleExpand} className="text-gray-400 hover:text-gray-600">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </td>
        <td className="px-4 py-3">
          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{p.code}</span>
        </td>
        <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
        <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{p.brand || "—"}</td>
        <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{p.category || "—"}</td>
        <td className="px-4 py-3 text-right text-gray-600 hidden sm:table-cell">
          {p.base_cost ? `$${Number(p.base_cost).toLocaleString("es-AR", { minimumFractionDigits: 2 })}` : "—"}
        </td>
        <td className="px-4 py-3 text-center">
          <span className="text-xs font-medium text-gray-700">
            {p.variants.length} <span className="text-gray-400">/ stock: {totalStock}</span>
          </span>
        </td>
        <td className="px-4 py-3 text-center">
          {p.is_active
            ? badge("Activo", "bg-green-50 text-green-700")
            : badge("Inactivo", "bg-red-50 text-red-700")}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <button onClick={onToggleActive} className="p-1.5 rounded-lg hover:bg-gray-100" title="Activar/Desactivar">
              <Power className="w-3.5 h-3.5 text-gray-500" />
            </button>
            <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-gray-100" title="Editar">
              <Pencil className="w-3.5 h-3.5 text-gray-500" />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50" title="Eliminar">
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} className="bg-slate-50 px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm text-gray-700">Variantes de "{p.name}"</h4>
              <button
                onClick={onAddVariant}
                className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-3 h-3" /> Agregar Variante
              </button>
            </div>
            {p.variants.length === 0 ? (
              <p className="text-xs text-gray-500">Sin variantes todavía</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-500">SKU</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Talle</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Color</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Código Barras</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-500">Stock</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-500">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {p.variants.map((v) => (
                    <tr key={v.id} className="border-b border-gray-100">
                      <td className="py-2 px-3 font-mono">{v.sku}</td>
                      <td className="py-2 px-3">{v.size}</td>
                      <td className="py-2 px-3">{v.color}</td>
                      <td className="py-2 px-3 text-gray-500">{v.barcode || "—"}</td>
                      <td className="py-2 px-3 text-right font-semibold">{v.stock}</td>
                      <td className="py-2 px-3 text-right">
                        <button onClick={() => onEditVariant(v)} className="p-1 hover:bg-gray-200 rounded" title="Editar">
                          <Pencil className="w-3 h-3 text-gray-500" />
                        </button>
                        <button onClick={() => onDeleteVariant(v)} className="p-1 hover:bg-red-100 rounded ml-1" title="Eliminar">
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Product Modal ────────────────────────────────────── */
function ProductModal({ product, onClose, onSave, loading }) {
  const [form, setForm] = useState({
    code: product?.code || "",
    name: product?.name || "",
    description: product?.description || "",
    brand: product?.brand || "",
    category: product?.category || "",
    base_cost: product?.base_cost || "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      base_cost: form.base_cost ? Number(form.base_cost) : null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">{product ? "Editar Producto" : "Nuevo Producto"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
              <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo Base</label>
              <input type="number" step="0.01" value={form.base_cost} onChange={(e) => setForm({ ...form, base_cost: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Variant Modal ────────────────────────────────────── */
function VariantModal({ variant, onClose, onSave, loading }) {
  const [form, setForm] = useState({
    size: variant?.size || "",
    color: variant?.color || "",
    sku: variant?.sku || "",
    barcode: variant?.barcode || "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...form, barcode: form.barcode || null });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">{variant ? "Editar Variante" : "Nueva Variante"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Talle *</label>
              <input required value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}
                placeholder="S, M, L, XL, 38..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color *</label>
              <input required value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder="Negro, Azul..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
            <input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
              placeholder="CAM-001-S-NEG"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código de Barras</label>
            <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

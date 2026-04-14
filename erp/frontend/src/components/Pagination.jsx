/**
 * Pagination — componente reutilizable para listas paginadas.
 * Recibe: total, skip, limit, onPageChange(newPage)
 */
function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total]);
  for (let i = Math.max(1, current - 1); i <= Math.min(total, current + 1); i++) set.add(i);
  const sorted = [...set].sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 2) result.push("...");
    else if (p - prev === 2) result.push(p - 1);
    result.push(p);
    prev = p;
  }
  return result;
}

export default function Pagination({ total, skip, limit, onPageChange }) {
  const page = Math.floor(skip / limit) + 1;
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;

  const from = skip + 1;
  const to = Math.min(skip + limit, total);
  const pageNums = getPageNumbers(page, pages);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg">
      <span className="text-sm text-gray-500">
        Mostrando <span className="font-medium text-gray-700">{from}–{to}</span> de <span className="font-medium text-gray-700">{total}</span>
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          ← Anterior
        </button>
        {pageNums.map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="px-2 text-gray-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-9 py-1.5 text-sm rounded-lg transition ${
                page === p
                  ? "bg-blue-600 text-white font-medium"
                  : "border border-gray-300 hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}

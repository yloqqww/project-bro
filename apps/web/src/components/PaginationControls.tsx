'use client';

type Props = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
};

export function PaginationControls({ page, totalPages, total, pageSize, loading, onPageChange, onPageSizeChange }: Props) {
  return (
    <nav aria-label="Table pagination" className="flex flex-col gap-2 border-t border-slate-200 bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-slate-600" aria-live="polite">Page {page} of {totalPages} · {total} total records</p>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <label className="flex items-center gap-2 text-xs text-slate-600">
            Rows
            <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-8 rounded border border-slate-300 bg-white px-2">
              {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        )}
        <button type="button" disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)} className="h-8 rounded border border-slate-300 px-3 font-medium disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
        <button type="button" disabled={loading || page >= totalPages} onClick={() => onPageChange(page + 1)} className="h-8 rounded border border-slate-300 px-3 font-medium disabled:cursor-not-allowed disabled:opacity-40">Next</button>
      </div>
    </nav>
  );
}

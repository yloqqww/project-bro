export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export function paginationParams(searchParams: URLSearchParams, defaultPageSize = 25, maxPageSize = 100) {
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(maxPageSize, Math.max(1, Number.parseInt(searchParams.get('pageSize') || String(defaultPageSize), 10) || defaultPageSize));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function paginationMeta(page: number, pageSize: number, total: number): Pagination {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

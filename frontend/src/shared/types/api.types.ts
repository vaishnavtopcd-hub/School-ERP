/** Mirrors the backend's TransformInterceptor envelope. */
export interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: string;
  path: string;
  requestId?: string;
}

/** Mirrors the backend's AllExceptionsFilter body. */
export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  error: string;
  details?: string[];
  timestamp: string;
  path: string;
  requestId?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

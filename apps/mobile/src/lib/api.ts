import { useAuthStore } from '../stores/auth';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// Type definitions
export interface Author {
  id: string;
  name: string;
  role?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  bookCount?: number;
  children?: Category[];
}

export interface Book {
  id: string;
  isbn?: string;
  ean?: string;
  title: string;
  originalTitle?: string;
  description?: string;
  coverUrl?: string;
  publishedAt?: string;
  publisher?: string;
  pageCount?: number;
  language: string;
  formats: {
    paper: boolean;
    ebook: boolean;
    audiobook: boolean;
  };
  avgRating: number;
  ratingsCount: number;
  authors: Author[];
  categories: Category[];
}

export interface Offer {
  id?: string;
  storeName: string;
  storeLogoUrl?: string;
  format: 'paper' | 'ebook' | 'audiobook';
  price: number;
  originalPrice?: number;
  currency: string;
  url: string;
  isAvailable: boolean;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Bookshelf types
export type ReadingStatus = 'WANT_TO_READ' | 'READING' | 'READ';

export interface BookshelfItem {
  id: string;
  bookId: string;
  status: ReadingStatus;
  rating?: number;
  review?: string;
  addedAt: string;
  statusChangedAt?: string;
  ratedAt?: string;
  book: Book;
}

export interface BookshelfStats {
  total: number;
  byStatus: {
    wantToRead: number;
    reading: number;
    read: number;
  };
  ratings: {
    count: number;
    average: number;
    distribution: Record<number, number>;
  };
}

// Recommendation types
export interface RecommendedBook {
  id: string;
  isbn?: string;
  title: string;
  coverUrl?: string;
  description?: string;
  authors: string[];
  categories: string[];
  formats: {
    paper: boolean;
    ebook: boolean;
    audiobook: boolean;
  };
  avgRating: number;
  ratingsCount: number;
  hasOffers: boolean;
}

export interface RecommendationDebug {
  categoryScore: number;
  authorScore: number;
  formatScore: number;
  popularityScore: number;
  matchedCategories: string[];
  matchedAuthors: string[];
  matchedFormat?: string;
}

export interface Recommendation {
  book: RecommendedBook;
  score: number;
  reasons: string[];
  debug?: RecommendationDebug;
}

export interface RecommendationResponse {
  items: Recommendation[];
  meta: {
    confidence: number;
    fallbackUsed: boolean;
    candidatesConsidered: number;
    excluded: number;
    algorithmVersion: string;
  };
}

export interface ExplainResponse {
  bookId: string;
  explanation: string;
  reasons: string[];
  confidence: number;
  alternatives?: Array<{
    id: string;
    title: string;
    authors: string[];
    reason: string;
  }>;
}

export interface CompareResponse {
  books: Array<{
    id: string;
    title: string;
    authors: string[];
    score: number;
    matchedCategories: string[];
    matchedAuthors: string[];
  }>;
  comparison: string;
  bestFitId?: string;
  bestFitReason?: string;
}

// Purchase types
export interface Purchase {
  id: string;
  bookId?: string;
  externalId: string;
  title: string;
  authors: string[];
  format: 'PAPER' | 'EBOOK' | 'AUDIOBOOK';
  price: number;
  currency: string;
  purchasedAt: string;
  storeName: string;
  book?: Book;
}

export interface PurchasesResponse {
  items: Purchase[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    total: number;
  };
}

export interface PurchaseStats {
  total: number;
  byFormat: {
    paper: number;
    ebook: number;
    audiobook: number;
  };
  totalSpent: number;
  currency: string;
}

interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const { getAccessToken, setTokens, logout } = useAuthStore.getState();
    const accessToken = getAccessToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle token refresh on 401
    if (response.status === 401 && accessToken) {
      const refreshResult = await this.refreshTokens();
      if (refreshResult) {
        // Retry the original request with new token
        (headers as Record<string, string>)['Authorization'] = `Bearer ${refreshResult.accessToken}`;
        const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          headers,
        });

        if (!retryResponse.ok) {
          const error = await retryResponse.json();
          throw new Error(error.message || 'Request failed');
        }

        return retryResponse.json();
      } else {
        // Refresh failed, logout user
        await logout();
        throw new Error('Session expired');
      }
    }

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.message || 'Request failed');
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }

    return {} as T;
  }

  private async refreshTokens() {
    const { refreshToken, setTokens } = useAuthStore.getState();

    if (!refreshToken) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        return null;
      }

      const tokens = await response.json();
      await setTokens(tokens.accessToken, tokens.refreshToken);
      return tokens;
    } catch {
      return null;
    }
  }

  // Auth endpoints
  auth = {
    register: (email: string, password: string, name?: string) =>
      this.request<{
        user: { id: string; email: string; name?: string };
        accessToken: string;
        refreshToken: string;
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }),

    login: (email: string, password: string) =>
      this.request<{
        user: { id: string; email: string; name?: string };
        accessToken: string;
        refreshToken: string;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    logout: (refreshToken: string) =>
      this.request<void>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }),
  };

  // Users endpoints
  users = {
    me: () =>
      this.request<{
        id: string;
        email: string;
        name?: string;
        avatarUrl?: string;
      }>('/users/me'),

    update: (data: { name?: string; avatarUrl?: string }) =>
      this.request<{
        id: string;
        email: string;
        name?: string;
        avatarUrl?: string;
      }>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: () =>
      this.request<void>('/users/me', {
        method: 'DELETE',
      }),
  };

  // Books endpoints
  books = {
    list: (params?: {
      search?: string;
      category?: string;
      format?: string;
      sort?: 'relevance' | 'title' | 'rating' | 'newest';
      page?: number;
      limit?: number;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set('search', params.search);
      if (params?.category) searchParams.set('category', params.category);
      if (params?.format) searchParams.set('format', params.format);
      if (params?.sort) searchParams.set('sort', params.sort);
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());

      const queryString = searchParams.toString();
      return this.request<{
        data: Book[];
        pagination: Pagination;
      }>(`/books${queryString ? `?${queryString}` : ''}`);
    },

    get: (id: string) => this.request<Book>(`/books/${id}`),

    getByIsbn: (isbn: string) => this.request<Book>(`/books/isbn/${isbn}`),

    categories: () => this.request<{ data: Category[] }>('/books/categories'),

    popular: (limit = 10) =>
      this.request<{ data: Book[] }>(`/books/popular?limit=${limit}`),

    newest: (limit = 10) =>
      this.request<{ data: Book[] }>(`/books/newest?limit=${limit}`),

    byCategory: (slug: string, page = 1, limit = 20) =>
      this.request<{
        data: Book[];
        pagination: Pagination;
      }>(`/books/category/${slug}?page=${page}&limit=${limit}`),
  };

  // Offers endpoints
  offers = {
    byBook: (bookId: string, format?: string) => {
      const params = format ? `?format=${format}` : '';
      return this.request<{ data: Offer[]; source: string }>(`/offers/book/${bookId}${params}`);
    },

    byIsbn: (isbn: string, format?: string) => {
      const params = format ? `?format=${format}` : '';
      return this.request<{ data: Offer[]; source: string }>(`/offers/isbn/${isbn}${params}`);
    },

    refresh: (bookId: string) =>
      this.request<{ data: Offer[]; refreshedAt: string }>(`/offers/book/${bookId}/refresh`, {
        method: 'POST',
      }),
  };

  // Chat endpoints
  chat = {
    list: (page = 1, limit = 20) =>
      this.request<{
        data: any[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/conversations?page=${page}&limit=${limit}`),

    get: (id: string) => this.request<any>(`/conversations/${id}`),

    create: (message: string) =>
      this.request<{ conversationId: string; message: any }>('/conversations', {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),

    sendMessage: (conversationId: string, content: string) =>
      this.request<any>(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),

    delete: (id: string) =>
      this.request<void>(`/conversations/${id}`, {
        method: 'DELETE',
      }),

    // Streaming message endpoint - returns EventSource URL
    getStreamUrl: (conversationId: string) =>
      `${this.baseUrl}/conversations/${conversationId}/messages/stream`,
  };

  // Bookshelf endpoints
  bookshelf = {
    list: (params?: { status?: ReadingStatus; limit?: number; cursor?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set('status', params.status);
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.cursor) searchParams.set('cursor', params.cursor);
      const queryString = searchParams.toString();
      return this.request<{
        items: BookshelfItem[];
        cursor?: string;
        hasMore: boolean;
      }>(`/bookshelf${queryString ? `?${queryString}` : ''}`);
    },

    getItem: (bookId: string) =>
      this.request<BookshelfItem>(`/bookshelf/${bookId}`),

    updateStatus: (bookId: string, status: ReadingStatus) =>
      this.request<BookshelfItem>(`/bookshelf/${bookId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }),

    updateRating: (bookId: string, rating: number) =>
      this.request<BookshelfItem>(`/bookshelf/${bookId}/rating`, {
        method: 'POST',
        body: JSON.stringify({ rating }),
      }),

    remove: (bookId: string) =>
      this.request<void>(`/bookshelf/${bookId}`, {
        method: 'DELETE',
      }),

    stats: () => this.request<BookshelfStats>('/bookshelf/stats'),
  };

  // Recommendations endpoints
  recommendations = {
    get: (params?: {
      limit?: number;
      debug?: boolean;
      format?: 'paper' | 'ebook' | 'audiobook';
      categoryId?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.debug) searchParams.set('debug', 'true');
      if (params?.format) searchParams.set('format', params.format);
      if (params?.categoryId) searchParams.set('categoryId', params.categoryId);
      const queryString = searchParams.toString();
      return this.request<RecommendationResponse>(
        `/recommendations${queryString ? `?${queryString}` : ''}`,
      );
    },

    explain: (bookId: string, context?: string) =>
      this.request<ExplainResponse>('/recommendations/explain', {
        method: 'POST',
        body: JSON.stringify({ bookId, context }),
      }),

    compare: (bookIds: string[], question?: string) =>
      this.request<CompareResponse>('/recommendations/compare', {
        method: 'POST',
        body: JSON.stringify({ bookIds, question }),
      }),
  };

  // Purchases endpoints
  purchases = {
    list: (params?: { limit?: number; cursor?: string; format?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.cursor) searchParams.set('cursor', params.cursor);
      if (params?.format) searchParams.set('format', params.format);
      const queryString = searchParams.toString();
      return this.request<PurchasesResponse>(`/purchases${queryString ? `?${queryString}` : ''}`);
    },

    refresh: () =>
      this.request<{ syncedCount: number; lastSyncAt: string }>('/purchases/refresh', {
        method: 'POST',
      }),

    stats: () => this.request<PurchaseStats>('/purchases/stats'),
  };

  // Health check (no auth required)
  health = {
    check: () =>
      this.request<{ status: string; timestamp: string }>('/health'),
  };
}

export const api = new ApiClient(API_BASE_URL);

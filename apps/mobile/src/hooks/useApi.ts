/**
 * React Query hooks for API data fetching
 *
 * Provides typed hooks with proper caching, refetching,
 * and error handling for all API endpoints.
 */
import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import {
  api,
  Book,
  Category,
  Offer,
  BookshelfItem,
  BookshelfStats,
  ReadingStatus,
  RecommendationResponse,
  ExplainResponse,
  CompareResponse,
  PurchasesResponse,
  PurchaseStats,
  Conversation,
  ConversationDetail,
  ChatMessage,
} from '@lib/api';

// ============================================
// Query Keys
// ============================================

export const queryKeys = {
  // Health
  health: ['health'] as const,

  // Books
  books: {
    all: ['books'] as const,
    list: (params?: Record<string, any>) => ['books', 'list', params] as const,
    detail: (id: string) => ['books', 'detail', id] as const,
    popular: (limit?: number) => ['books', 'popular', limit] as const,
    newest: (limit?: number) => ['books', 'newest', limit] as const,
    byCategory: (slug: string) => ['books', 'category', slug] as const,
  },

  // Categories
  categories: ['categories'] as const,

  // Offers
  offers: {
    byBook: (bookId: string, format?: string) => ['offers', 'book', bookId, format] as const,
  },

  // Bookshelf
  bookshelf: {
    all: ['bookshelf'] as const,
    list: (status?: ReadingStatus) => ['bookshelf', 'list', status] as const,
    item: (bookId: string) => ['bookshelf', 'item', bookId] as const,
    stats: ['bookshelf', 'stats'] as const,
  },

  // Recommendations
  recommendations: {
    all: ['recommendations'] as const,
    list: (params?: Record<string, any>) => ['recommendations', 'list', params] as const,
    explain: (bookId: string) => ['recommendations', 'explain', bookId] as const,
  },

  // Purchases
  purchases: {
    all: ['purchases'] as const,
    list: (params?: Record<string, any>) => ['purchases', 'list', params] as const,
    stats: ['purchases', 'stats'] as const,
  },

  // Chat
  chat: {
    all: ['chat'] as const,
    list: ['chat', 'list'] as const,
    detail: (id: string) => ['chat', 'detail', id] as const,
  },

  // User
  user: ['user', 'me'] as const,
};

// ============================================
// Health Hook
// ============================================

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.health.check(),
    staleTime: 30 * 1000, // 30 seconds
    retry: 1,
  });
}

// ============================================
// Books Hooks
// ============================================

export function useBooks(params?: {
  search?: string;
  category?: string;
  format?: string;
  sort?: 'relevance' | 'title' | 'rating' | 'newest';
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: queryKeys.books.list(params),
    queryFn: () => api.books.list(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useBook(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.books.detail(id),
    queryFn: () => api.books.get(id),
    enabled: options?.enabled ?? !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function usePopularBooks(limit = 10) {
  return useQuery({
    queryKey: queryKeys.books.popular(limit),
    queryFn: () => api.books.popular(limit),
    staleTime: 5 * 60 * 1000,
  });
}

export function useNewestBooks(limit = 10) {
  return useQuery({
    queryKey: queryKeys.books.newest(limit),
    queryFn: () => api.books.newest(limit),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => api.books.categories(),
    staleTime: 30 * 60 * 1000, // 30 minutes (categories rarely change)
  });
}

export function useBooksByCategory(slug: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: [...queryKeys.books.byCategory(slug), page, limit],
    queryFn: () => api.books.byCategory(slug, page, limit),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================
// Offers Hooks
// ============================================

export function useOffers(bookId: string, format?: string) {
  return useQuery({
    queryKey: queryKeys.offers.byBook(bookId, format),
    queryFn: () => api.offers.byBook(bookId, format),
    enabled: !!bookId,
    staleTime: 2 * 60 * 1000, // 2 minutes (prices change frequently)
  });
}

export function useRefreshOffers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookId: string) => api.offers.refresh(bookId),
    onSuccess: (_, bookId) => {
      // Invalidate offers for this book
      queryClient.invalidateQueries({
        queryKey: ['offers', 'book', bookId],
      });
    },
  });
}

// ============================================
// Bookshelf Hooks
// ============================================

export function useBookshelf(status?: ReadingStatus) {
  return useQuery({
    queryKey: queryKeys.bookshelf.list(status),
    queryFn: () => api.bookshelf.list({ status }),
    staleTime: 2 * 60 * 1000,
  });
}

export function useBookshelfItem(bookId: string) {
  return useQuery({
    queryKey: queryKeys.bookshelf.item(bookId),
    queryFn: () => api.bookshelf.getItem(bookId),
    enabled: !!bookId,
    retry: false, // Don't retry 404s
  });
}

export function useBookshelfStats() {
  return useQuery({
    queryKey: queryKeys.bookshelf.stats,
    queryFn: () => api.bookshelf.stats(),
    staleTime: 2 * 60 * 1000,
  });
}

export function useUpdateBookshelfStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookId, status }: { bookId: string; status: ReadingStatus }) =>
      api.bookshelf.updateStatus(bookId, status),
    onSuccess: (data, { bookId }) => {
      // Update cache
      queryClient.setQueryData(queryKeys.bookshelf.item(bookId), data);
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: queryKeys.bookshelf.all });
    },
  });
}

export function useUpdateBookshelfRating() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookId, rating }: { bookId: string; rating: number }) =>
      api.bookshelf.updateRating(bookId, rating),
    onSuccess: (data, { bookId }) => {
      queryClient.setQueryData(queryKeys.bookshelf.item(bookId), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.bookshelf.all });
    },
  });
}

export function useRemoveFromBookshelf() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookId: string) => api.bookshelf.remove(bookId),
    onSuccess: (_, bookId) => {
      queryClient.removeQueries({ queryKey: queryKeys.bookshelf.item(bookId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookshelf.all });
    },
  });
}

// ============================================
// Recommendations Hooks
// ============================================

export function useRecommendations(params?: {
  limit?: number;
  debug?: boolean;
  format?: 'paper' | 'ebook' | 'audiobook';
  categoryId?: string;
}) {
  return useQuery({
    queryKey: queryKeys.recommendations.list(params),
    queryFn: () => api.recommendations.get(params),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useExplainRecommendation() {
  return useMutation({
    mutationFn: ({ bookId, context }: { bookId: string; context?: string }) =>
      api.recommendations.explain(bookId, context),
  });
}

export function useCompareBooks() {
  return useMutation({
    mutationFn: ({ bookIds, question }: { bookIds: string[]; question?: string }) =>
      api.recommendations.compare(bookIds, question),
  });
}

// ============================================
// Purchases Hooks
// ============================================

export function usePurchases(params?: { limit?: number; cursor?: string; format?: string }) {
  return useQuery({
    queryKey: queryKeys.purchases.list(params),
    queryFn: () => api.purchases.list(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePurchaseStats() {
  return useQuery({
    queryKey: queryKeys.purchases.stats,
    queryFn: () => api.purchases.stats(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRefreshPurchases() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.purchases.refresh(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all });
    },
  });
}

// ============================================
// Chat Hooks
// ============================================

export function useConversations(page = 1, limit = 20) {
  return useQuery({
    queryKey: [...queryKeys.chat.list, page, limit],
    queryFn: () => api.chat.list(page, limit),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: queryKeys.chat.detail(id),
    queryFn: () => api.chat.get(id),
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: string) => api.chat.create(message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.list });
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, content }: { conversationId: string; content: string }) =>
      api.chat.sendMessage(conversationId, content),
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.detail(conversationId) });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.chat.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.list });
    },
  });
}

// ============================================
// User Hooks
// ============================================

export function useUser() {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: () => api.users.me(),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name?: string; avatarUrl?: string }) => api.users.update(data),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.user, data);
    },
  });
}

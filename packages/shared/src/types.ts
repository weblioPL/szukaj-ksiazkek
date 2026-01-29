// User types
export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

// Book types
export type BookFormat = 'paper' | 'ebook' | 'audiobook';

export interface Author {
  id: string;
  name: string;
  role?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
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
  hasPaper: boolean;
  hasEbook: boolean;
  hasAudiobook: boolean;
  avgRating: number;
  ratingsCount: number;
  authors: Author[];
  categories: Category[];
}

export interface BookListItem {
  id: string;
  isbn?: string;
  title: string;
  coverUrl?: string;
  avgRating: number;
  ratingsCount: number;
  authors: Author[];
  formats: BookFormat[];
  lowestPrice?: Record<BookFormat, number>;
}

// Offer types
export interface Offer {
  id: string;
  storeName: string;
  storeLogoUrl?: string;
  format: BookFormat;
  price: number;
  originalPrice?: number;
  currency: string;
  url: string;
  isAvailable: boolean;
}

// Reading status
export type ReadingStatus = 'want_to_read' | 'reading' | 'read';

export interface UserBook {
  id: string;
  book: BookListItem;
  status: ReadingStatus;
  rating?: number;
  review?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

// Chat types
export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  metadata?: {
    mentionedBooks?: { id: string; title: string; isbn?: string }[];
  };
  createdAt: string;
}

export interface Conversation {
  id: string;
  title?: string;
  lastMessage?: string;
  messages?: Message[];
  createdAt: string;
  updatedAt: string;
}

// Pagination
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

// API Error
export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: { field: string; message: string }[];
}

// API Configuration
export const API_VERSION = 'v1';

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Token expiration times (for reference)
export const ACCESS_TOKEN_EXPIRATION = '15m';
export const REFRESH_TOKEN_EXPIRATION = '7d';

// Book formats
export const BOOK_FORMATS = ['paper', 'ebook', 'audiobook'] as const;

// Reading statuses
export const READING_STATUSES = ['want_to_read', 'reading', 'read'] as const;

// Rating range
export const MIN_RATING = 1;
export const MAX_RATING = 5;

// Storage keys (for mobile app)
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER: 'user',
  THEME: 'theme',
  LANGUAGE: 'language',
} as const;

// Polish book categories (predefined)
export const POLISH_CATEGORIES = [
  { name: 'Biznes i ekonomia', slug: 'biznes-i-ekonomia' },
  { name: 'Rozwój osobisty', slug: 'rozwoj-osobisty' },
  { name: 'Literatura piękna', slug: 'literatura-piekna' },
  { name: 'Kryminał i thriller', slug: 'kryminal-i-thriller' },
  { name: 'Science fiction i fantasy', slug: 'science-fiction-i-fantasy' },
  { name: 'Historia', slug: 'historia' },
  { name: 'Biografia', slug: 'biografia' },
  { name: 'Nauka i technika', slug: 'nauka-i-technika' },
  { name: 'Psychologia', slug: 'psychologia' },
  { name: 'Zdrowie i uroda', slug: 'zdrowie-i-uroda' },
  { name: 'Poradniki', slug: 'poradniki' },
  { name: 'Dla dzieci', slug: 'dla-dzieci' },
  { name: 'Młodzieżowe', slug: 'mlodziezowe' },
  { name: 'Komiksy i manga', slug: 'komiksy-i-manga' },
  { name: 'Audiobooki', slug: 'audiobooki' },
] as const;

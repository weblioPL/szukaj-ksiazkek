/**
 * Reusable UI components for book listings
 *
 * These components are used across the app for consistent
 * presentation of book sections with loading/error/empty states.
 */
import { View, Text, TouchableOpacity, FlatList, Image, Dimensions } from 'react-native';
import { Link } from 'expo-router';
import { Book, RecommendedBook } from '@lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = 130;
const CARD_SPACING = 12;

// ============================================
// Section Header
// ============================================

interface SectionHeaderProps {
  title: string;
  linkHref?: string;
  linkText?: string;
}

export function SectionHeader({ title, linkHref, linkText = 'Zobacz wszystkie' }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center justify-between mb-4 px-4">
      <Text className="text-lg font-semibold text-gray-900">{title}</Text>
      {linkHref && (
        <Link href={linkHref as any} asChild>
          <TouchableOpacity>
            <Text className="text-primary-600 text-sm">{linkText}</Text>
          </TouchableOpacity>
        </Link>
      )}
    </View>
  );
}

// ============================================
// Compact Book Card (for horizontal lists)
// ============================================

type BookLike = Book | RecommendedBook;

interface BookCardCompactProps {
  book: BookLike;
  /** Show recommendation score badge */
  score?: number;
  /** Show recommendation reasons */
  reasons?: string[];
}

/**
 * Normalize authors from different book types
 */
function getAuthorsText(book: BookLike): string {
  if (!book.authors || book.authors.length === 0) return 'Nieznany autor';

  // RecommendedBook has string[], Book has Author[]
  if (typeof book.authors[0] === 'string') {
    return (book.authors as string[]).join(', ');
  }
  return (book.authors as Array<{ name: string }>).map((a) => a.name).join(', ');
}

/**
 * Check if book has formats (works for both Book and RecommendedBook)
 */
function getFormats(book: BookLike): { paper: boolean; ebook: boolean; audiobook: boolean } {
  if ('formats' in book && book.formats) {
    return book.formats;
  }
  return { paper: false, ebook: false, audiobook: false };
}

export function BookCardCompact({ book, score, reasons }: BookCardCompactProps) {
  const authorsText = getAuthorsText(book);
  const rating = book.avgRating?.toFixed(1) ?? '0.0';
  const coverUrl = 'coverUrl' in book ? book.coverUrl : undefined;

  return (
    <Link href={`/book/${book.id}`} asChild>
      <TouchableOpacity
        className="mr-3"
        style={{ width: CARD_WIDTH }}
        activeOpacity={0.7}
      >
        {/* Cover */}
        <View className="aspect-[2/3] bg-gray-100 rounded-xl overflow-hidden shadow-sm">
          {coverUrl ? (
            <Image
              source={{ uri: coverUrl }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full items-center justify-center bg-gray-200">
              <Text className="text-4xl">📖</Text>
            </View>
          )}

          {/* Score badge */}
          {score !== undefined && score > 0 && (
            <View className="absolute top-2 right-2 bg-primary-600 rounded-full px-2 py-0.5">
              <Text className="text-white text-xs font-bold">
                {Math.round(score * 100)}%
              </Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View className="mt-2">
          <Text className="text-sm font-semibold text-gray-900" numberOfLines={2}>
            {book.title}
          </Text>
          <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
            {authorsText}
          </Text>

          {/* Rating */}
          <View className="flex-row items-center mt-1">
            <Text className="text-yellow-500 text-xs">★</Text>
            <Text className="text-xs text-gray-600 ml-0.5">{rating}</Text>
          </View>

          {/* First reason (if provided) */}
          {reasons && reasons.length > 0 && (
            <Text className="text-xs text-primary-600 mt-1" numberOfLines={1}>
              {reasons[0]}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Link>
  );
}

// ============================================
// Loading Skeletons
// ============================================

export function BookCardSkeleton() {
  return (
    <View className="mr-3" style={{ width: CARD_WIDTH }}>
      <View className="aspect-[2/3] bg-gray-200 rounded-xl animate-pulse" />
      <View className="mt-2">
        <View className="h-4 bg-gray-200 rounded w-full animate-pulse" />
        <View className="h-3 bg-gray-200 rounded w-2/3 mt-1 animate-pulse" />
        <View className="h-3 bg-gray-200 rounded w-1/3 mt-1 animate-pulse" />
      </View>
    </View>
  );
}

export function HorizontalListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View className="flex-row px-4">
      {Array.from({ length: count }).map((_, i) => (
        <BookCardSkeleton key={i} />
      ))}
    </View>
  );
}

// ============================================
// Error State
// ============================================

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = 'Wystąpił błąd podczas ładowania',
  onRetry
}: ErrorStateProps) {
  return (
    <View className="bg-red-50 rounded-xl p-4 mx-4 items-center">
      <Text className="text-red-600 text-center">{message}</Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          className="mt-2 bg-red-100 px-4 py-2 rounded-lg"
        >
          <Text className="text-red-700 font-medium">Spróbuj ponownie</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ============================================
// Empty State
// ============================================

interface EmptyStateProps {
  message?: string;
  icon?: string;
}

export function EmptyState({
  message = 'Brak wyników',
  icon = '📚'
}: EmptyStateProps) {
  return (
    <View className="bg-gray-50 rounded-xl p-6 mx-4 items-center">
      <Text className="text-3xl mb-2">{icon}</Text>
      <Text className="text-gray-500 text-center">{message}</Text>
    </View>
  );
}

// ============================================
// Horizontal Book List
// ============================================

interface HorizontalBookListProps<T extends BookLike> {
  data: T[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  emptyMessage?: string;
  onRetry?: () => void;
  /** Extract score from item (for recommendations) */
  getScore?: (item: T) => number | undefined;
  /** Extract reasons from item (for recommendations) */
  getReasons?: (item: T) => string[] | undefined;
  /** Key extractor */
  keyExtractor?: (item: T) => string;
}

export function HorizontalBookList<T extends BookLike>({
  data,
  isLoading,
  isError,
  errorMessage,
  emptyMessage = 'Brak książek do wyświetlenia',
  onRetry,
  getScore,
  getReasons,
  keyExtractor = (item) => item.id,
}: HorizontalBookListProps<T>) {
  if (isLoading) {
    return <HorizontalListSkeleton />;
  }

  if (isError) {
    return <ErrorState message={errorMessage} onRetry={onRetry} />;
  }

  if (!data || data.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <FlatList
      data={data}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16 }}
      keyExtractor={keyExtractor}
      renderItem={({ item }) => (
        <BookCardCompact
          book={item}
          score={getScore?.(item)}
          reasons={getReasons?.(item)}
        />
      )}
    />
  );
}

// ============================================
// Recommendation Book List
// ============================================

interface RecommendationListProps {
  data: Array<{ book: RecommendedBook; score: number; reasons: string[] }>;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  emptyMessage?: string;
  onRetry?: () => void;
}

export function RecommendationList({
  data,
  isLoading,
  isError,
  errorMessage,
  emptyMessage = 'Brak rekomendacji. Dodaj książki do półki, aby otrzymać spersonalizowane polecenia!',
  onRetry,
}: RecommendationListProps) {
  if (isLoading) {
    return <HorizontalListSkeleton />;
  }

  if (isError) {
    return <ErrorState message={errorMessage} onRetry={onRetry} />;
  }

  if (!data || data.length === 0) {
    return <EmptyState message={emptyMessage} icon="✨" />;
  }

  return (
    <FlatList
      data={data}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16 }}
      keyExtractor={(item) => item.book.id}
      renderItem={({ item }) => (
        <BookCardCompact
          book={item.book}
          score={item.score}
          reasons={item.reasons}
        />
      )}
    />
  );
}

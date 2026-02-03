/**
 * Reusable components for the Purchases screen
 */
import { View, Text, TouchableOpacity } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Purchase } from '@lib/api';

// ============================================
// Format Badge Component
// ============================================

interface FormatBadgeProps {
  format: Purchase['format'];
}

const FORMAT_CONFIG = {
  PAPER: { label: 'Papier', emoji: '📖', bgColor: 'bg-amber-100', textColor: 'text-amber-700' },
  EBOOK: { label: 'E-book', emoji: '📱', bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
  AUDIOBOOK: { label: 'Audiobook', emoji: '🎧', bgColor: 'bg-purple-100', textColor: 'text-purple-700' },
};

export function FormatBadge({ format }: FormatBadgeProps) {
  const config = FORMAT_CONFIG[format] || FORMAT_CONFIG.PAPER;
  return (
    <View className={`px-2 py-0.5 rounded-full ${config.bgColor}`}>
      <Text className={`text-xs ${config.textColor}`}>
        {config.emoji} {config.label}
      </Text>
    </View>
  );
}

// ============================================
// Status Badge Component
// ============================================

interface StatusBadgeProps {
  status?: string;
}

const STATUS_CONFIG: Record<string, { label: string; bgColor: string; textColor: string }> = {
  paid: { label: 'Opłacone', bgColor: 'bg-green-100', textColor: 'text-green-700' },
  pending: { label: 'Oczekuje', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' },
  cancelled: { label: 'Anulowane', bgColor: 'bg-red-100', textColor: 'text-red-700' },
  refunded: { label: 'Zwrócone', bgColor: 'bg-gray-100', textColor: 'text-gray-700' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) return null;

  const config = STATUS_CONFIG[status.toLowerCase()] || {
    label: status,
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
  };

  return (
    <View className={`px-2 py-0.5 rounded-full ${config.bgColor}`}>
      <Text className={`text-xs ${config.textColor}`}>{config.label}</Text>
    </View>
  );
}

// ============================================
// Purchase Card Component
// ============================================

interface PurchaseCardProps {
  purchase: Purchase;
}

export function PurchaseCard({ purchase }: PurchaseCardProps) {
  const router = useRouter();
  const { bookId, title, authors, format, price, currency, storeName, status } = purchase;

  const hasMatch = !!bookId;
  const authorsText = authors.length > 0 ? authors.join(', ') : 'Autor nieznany';

  // Format price
  const formattedPrice = new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: currency || 'PLN',
  }).format(price);

  // Handle search fallback for unmatched purchases
  const handleSearchFallback = () => {
    // Navigate to search with title as query
    router.push({
      pathname: '/(tabs)/search',
      params: { q: title },
    });
  };

  const CardContent = () => (
    <View className="bg-white p-4 border-b border-gray-100">
      {/* Title and Author */}
      <Text className="text-base font-semibold text-gray-900" numberOfLines={2}>
        {title}
      </Text>
      <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={1}>
        {authorsText}
      </Text>

      {/* Badges Row */}
      <View className="flex-row flex-wrap items-center mt-2 gap-2">
        <FormatBadge format={format} />
        <StatusBadge status={status} />
      </View>

      {/* Store and Price Row */}
      <View className="flex-row items-center justify-between mt-3">
        <View className="flex-row items-center">
          <Text className="text-xs text-gray-400">🛒</Text>
          <Text className="text-sm text-gray-600 ml-1">{storeName}</Text>
        </View>
        <Text className="text-base font-bold text-primary-600">{formattedPrice}</Text>
      </View>

      {/* CTA */}
      <View className="mt-3">
        {hasMatch ? (
          <Link href={`/book/${bookId}`} asChild>
            <TouchableOpacity className="bg-primary-50 px-4 py-2 rounded-lg">
              <Text className="text-primary-600 text-sm font-medium text-center">
                📕 Zobacz książkę
              </Text>
            </TouchableOpacity>
          </Link>
        ) : (
          <TouchableOpacity
            className="bg-gray-100 px-4 py-2 rounded-lg"
            onPress={handleSearchFallback}
          >
            <Text className="text-gray-600 text-sm font-medium text-center">
              🔍 Znajdź w katalogu
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return <CardContent />;
}

// ============================================
// Date Group Header Component
// ============================================

interface DateGroupHeaderProps {
  date: string;
}

export function DateGroupHeader({ date }: DateGroupHeaderProps) {
  const formatDateHeader = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Reset times for comparison
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (dateOnly.getTime() === todayOnly.getTime()) {
      return 'Dzisiaj';
    }
    if (dateOnly.getTime() === yesterdayOnly.getTime()) {
      return 'Wczoraj';
    }

    return date.toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <View className="bg-gray-50 px-4 py-2 border-b border-gray-200">
      <Text className="text-sm font-semibold text-gray-600">
        {formatDateHeader(date)}
      </Text>
    </View>
  );
}

// ============================================
// Purchases Skeleton Component
// ============================================

export function PurchasesSkeleton() {
  return (
    <View>
      {/* Date header skeleton */}
      <View className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <View className="w-24 h-4 bg-gray-200 rounded animate-pulse" />
      </View>

      {/* Purchase cards skeleton */}
      {[1, 2, 3, 4].map((i) => (
        <View key={i} className="bg-white p-4 border-b border-gray-100">
          <View className="w-3/4 h-5 bg-gray-200 rounded mb-2 animate-pulse" />
          <View className="w-1/2 h-4 bg-gray-200 rounded mb-3 animate-pulse" />
          <View className="flex-row gap-2 mb-3">
            <View className="w-16 h-5 bg-gray-200 rounded animate-pulse" />
            <View className="w-20 h-5 bg-gray-200 rounded animate-pulse" />
          </View>
          <View className="flex-row justify-between mb-3">
            <View className="w-24 h-4 bg-gray-200 rounded animate-pulse" />
            <View className="w-16 h-5 bg-gray-200 rounded animate-pulse" />
          </View>
          <View className="w-full h-9 bg-gray-200 rounded-lg animate-pulse" />
        </View>
      ))}
    </View>
  );
}

// ============================================
// Empty State Component
// ============================================

export function PurchasesEmptyState() {
  return (
    <View className="flex-1 items-center justify-center py-16 px-6">
      <Text className="text-6xl mb-4">🧾</Text>
      <Text className="text-xl font-semibold text-gray-900 text-center">
        Brak historii zakupów
      </Text>
      <Text className="text-gray-500 text-center mt-2">
        Nie mamy jeszcze historii zakupów. Gdy kupisz książkę przez linki w aplikacji, zobaczysz ją tutaj.
      </Text>
    </View>
  );
}

// ============================================
// Error State Component
// ============================================

interface PurchasesErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function PurchasesErrorState({ message, onRetry }: PurchasesErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-16 px-6">
      <Text className="text-6xl mb-4">😕</Text>
      <Text className="text-xl font-semibold text-gray-900 text-center">
        Nie udało się pobrać zakupów
      </Text>
      <Text className="text-gray-500 text-center mt-2 mb-6">{message}</Text>
      <TouchableOpacity
        className="bg-primary-600 px-6 py-3 rounded-lg"
        onPress={onRetry}
      >
        <Text className="text-white font-medium">🔄 Spróbuj ponownie</Text>
      </TouchableOpacity>
    </View>
  );
}

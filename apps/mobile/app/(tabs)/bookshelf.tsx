import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { Link } from 'expo-router';
import { useBookshelf, useBookshelfStats } from '@hooks/useApi';
import { ReadingStatus, BookshelfItem, Book } from '@lib/api';

// ============================================
// Status Configuration
// ============================================

interface StatusConfig {
  value: ReadingStatus;
  label: string;
  emoji: string;
  emptyTitle: string;
  emptySubtitle: string;
}

const STATUS_TABS: StatusConfig[] = [
  {
    value: 'READING',
    label: 'Czytam',
    emoji: '📖',
    emptyTitle: 'Nie czytasz żadnej książki',
    emptySubtitle: 'Znajdź coś ciekawego w wyszukiwarce i zacznij czytać!',
  },
  {
    value: 'WANT_TO_READ',
    label: 'Chcę przeczytać',
    emoji: '📚',
    emptyTitle: 'Lista życzeń jest pusta',
    emptySubtitle: 'Dodaj książki, które chcesz przeczytać w przyszłości.',
  },
  {
    value: 'READ',
    label: 'Przeczytane',
    emoji: '✅',
    emptyTitle: 'Jeszcze nic nie przeczytałeś',
    emptySubtitle: 'Oznacz przeczytane książki i oceń je!',
  },
];

// ============================================
// Stats Header Component
// ============================================

interface StatsHeaderProps {
  stats?: {
    total: number;
    byStatus: {
      wantToRead: number;
      reading: number;
      read: number;
    };
  };
  isLoading: boolean;
}

function StatsHeader({ stats, isLoading }: StatsHeaderProps) {
  if (isLoading) {
    return (
      <View className="bg-white px-4 py-3 border-b border-gray-200">
        <View className="flex-row justify-around">
          {[1, 2, 3].map((i) => (
            <View key={i} className="items-center">
              <View className="w-8 h-8 bg-gray-200 rounded-full mb-1 animate-pulse" />
              <View className="w-16 h-3 bg-gray-200 rounded animate-pulse" />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (!stats) return null;

  return (
    <View className="bg-white px-4 py-3 border-b border-gray-200">
      <View className="flex-row justify-around">
        <View className="items-center">
          <Text className="text-2xl font-bold text-green-600">{stats.byStatus.read}</Text>
          <Text className="text-xs text-gray-500">Przeczytane</Text>
        </View>
        <View className="items-center">
          <Text className="text-2xl font-bold text-blue-600">{stats.byStatus.reading}</Text>
          <Text className="text-xs text-gray-500">Czytam</Text>
        </View>
        <View className="items-center">
          <Text className="text-2xl font-bold text-orange-600">{stats.byStatus.wantToRead}</Text>
          <Text className="text-xs text-gray-500">Chcę przeczytać</Text>
        </View>
      </View>
    </View>
  );
}

// ============================================
// Status Tabs Component
// ============================================

interface StatusTabsProps {
  activeStatus: ReadingStatus;
  onStatusChange: (status: ReadingStatus) => void;
  stats?: StatsHeaderProps['stats'];
}

function StatusTabs({ activeStatus, onStatusChange, stats }: StatusTabsProps) {
  const getCount = (status: ReadingStatus): number => {
    if (!stats) return 0;
    switch (status) {
      case 'WANT_TO_READ':
        return stats.byStatus.wantToRead;
      case 'READING':
        return stats.byStatus.reading;
      case 'READ':
        return stats.byStatus.read;
      default:
        return 0;
    }
  };

  return (
    <View className="bg-white border-b border-gray-200">
      <View className="flex-row px-2 py-2">
        {STATUS_TABS.map((tab) => {
          const isActive = activeStatus === tab.value;
          const count = getCount(tab.value);
          return (
            <TouchableOpacity
              key={tab.value}
              className={`flex-1 py-2.5 mx-1 rounded-lg ${
                isActive ? 'bg-primary-600' : 'bg-gray-100'
              }`}
              onPress={() => onStatusChange(tab.value)}
            >
              <Text
                className={`text-center text-sm font-medium ${
                  isActive ? 'text-white' : 'text-gray-700'
                }`}
                numberOfLines={1}
              >
                {tab.emoji} {tab.label}
                {count > 0 && (
                  <Text className={isActive ? 'text-white/80' : 'text-gray-400'}>
                    {' '}({count})
                  </Text>
                )}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ============================================
// Rating Stars Component
// ============================================

interface RatingDisplayProps {
  rating?: number;
}

function RatingDisplay({ rating }: RatingDisplayProps) {
  if (!rating) return null;

  return (
    <View className="flex-row items-center mt-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Text
          key={star}
          className={`text-sm ${star <= rating ? 'text-yellow-500' : 'text-gray-300'}`}
        >
          ★
        </Text>
      ))}
      <Text className="text-xs text-gray-500 ml-1">({rating}/5)</Text>
    </View>
  );
}

// ============================================
// Bookshelf Card Component
// ============================================

interface BookshelfCardProps {
  item: BookshelfItem;
  statusConfig: StatusConfig;
}

function getAuthorsText(book: Book): string {
  if (!book.authors || book.authors.length === 0) return 'Autor nieznany';
  return book.authors.map((a) => a.name).join(', ');
}

function BookshelfCard({ item, statusConfig }: BookshelfCardProps) {
  const { book, rating, addedAt } = item;

  const addedDate = new Date(addedAt);
  const formattedDate = addedDate.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Link href={`/book/${book.id}`} asChild>
      <TouchableOpacity className="flex-row bg-white p-3 border-b border-gray-100">
        {/* Cover Image */}
        <View className="w-16 h-24 rounded-md overflow-hidden bg-gray-200 mr-3">
          {book.coverUrl ? (
            <Image
              source={{ uri: book.coverUrl }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full items-center justify-center bg-gray-300">
              <Text className="text-2xl">📕</Text>
            </View>
          )}
        </View>

        {/* Book Info */}
        <View className="flex-1 justify-center">
          <Text className="text-base font-semibold text-gray-900" numberOfLines={2}>
            {book.title}
          </Text>
          <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={1}>
            {getAuthorsText(book)}
          </Text>

          {/* Rating (only for READ books) */}
          {statusConfig.value === 'READ' && (
            <RatingDisplay rating={rating} />
          )}

          {/* Status Badge */}
          <View className="flex-row items-center mt-2">
            <View
              className={`px-2 py-0.5 rounded-full ${
                statusConfig.value === 'READING'
                  ? 'bg-blue-100'
                  : statusConfig.value === 'READ'
                  ? 'bg-green-100'
                  : 'bg-orange-100'
              }`}
            >
              <Text
                className={`text-xs ${
                  statusConfig.value === 'READING'
                    ? 'text-blue-700'
                    : statusConfig.value === 'READ'
                    ? 'text-green-700'
                    : 'text-orange-700'
                }`}
              >
                {statusConfig.emoji} {statusConfig.label}
              </Text>
            </View>
            <Text className="text-xs text-gray-400 ml-2">
              Dodano: {formattedDate}
            </Text>
          </View>
        </View>

        {/* Arrow */}
        <View className="justify-center">
          <Text className="text-gray-400 text-lg">›</Text>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

// ============================================
// Loading Skeleton Component
// ============================================

function BookshelfSkeleton() {
  return (
    <View className="p-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} className="flex-row bg-white p-3 mb-2 rounded-lg">
          <View className="w-16 h-24 rounded-md bg-gray-200 mr-3 animate-pulse" />
          <View className="flex-1 justify-center">
            <View className="w-3/4 h-4 bg-gray-200 rounded mb-2 animate-pulse" />
            <View className="w-1/2 h-3 bg-gray-200 rounded mb-3 animate-pulse" />
            <View className="w-24 h-5 bg-gray-200 rounded animate-pulse" />
          </View>
        </View>
      ))}
    </View>
  );
}

// ============================================
// Empty State Component
// ============================================

interface EmptyStateProps {
  statusConfig: StatusConfig;
}

function EmptyState({ statusConfig }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-16 px-6">
      <Text className="text-6xl mb-4">{statusConfig.emoji}</Text>
      <Text className="text-xl font-semibold text-gray-900 text-center">
        {statusConfig.emptyTitle}
      </Text>
      <Text className="text-gray-500 text-center mt-2 mb-6">
        {statusConfig.emptySubtitle}
      </Text>
      <Link href="/(tabs)/search" asChild>
        <TouchableOpacity className="bg-primary-600 px-6 py-3 rounded-lg">
          <Text className="text-white font-medium">🔍 Szukaj książek</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

// ============================================
// Error State Component
// ============================================

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-16 px-6">
      <Text className="text-6xl mb-4">😕</Text>
      <Text className="text-xl font-semibold text-gray-900 text-center">
        Ups! Coś poszło nie tak
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

// ============================================
// Main Bookshelf Screen Component
// ============================================

export default function BookshelfScreen() {
  const [activeStatus, setActiveStatus] = useState<ReadingStatus>('READING');

  // Fetch bookshelf stats
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useBookshelfStats();

  // Fetch bookshelf items with status filter
  const {
    data: bookshelfData,
    isLoading,
    isError,
    error,
    refetch,
  } = useBookshelf(activeStatus);

  // Find current status config
  const currentStatusConfig = STATUS_TABS.find((t) => t.value === activeStatus) || STATUS_TABS[0];

  // Handle tab change
  const handleStatusChange = useCallback((status: ReadingStatus) => {
    setActiveStatus(status);
  }, []);

  // Handle pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), refetchStats()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchStats]);

  // Render book item
  const renderItem = useCallback(
    ({ item }: { item: BookshelfItem }) => (
      <BookshelfCard item={item} statusConfig={currentStatusConfig} />
    ),
    [currentStatusConfig]
  );

  // Key extractor
  const keyExtractor = useCallback((item: BookshelfItem) => item.id, []);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white pt-12 pb-2 px-4 border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">📚 Moja półka</Text>
      </View>

      {/* Stats */}
      <StatsHeader stats={stats} isLoading={statsLoading} />

      {/* Status Tabs */}
      <StatusTabs
        activeStatus={activeStatus}
        onStatusChange={handleStatusChange}
        stats={stats}
      />

      {/* Content */}
      {isLoading && !refreshing ? (
        <BookshelfSkeleton />
      ) : isError ? (
        <ErrorState
          message={error?.message || 'Nie udało się załadować listy książek'}
          onRetry={() => refetch()}
        />
      ) : !bookshelfData?.items || bookshelfData.items.length === 0 ? (
        <EmptyState statusConfig={currentStatusConfig} />
      ) : (
        <FlatList
          data={bookshelfData.items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#0ea5e9']}
              tintColor="#0ea5e9"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

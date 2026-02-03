/**
 * Home Screen
 *
 * Displays personalized recommendations, popular, and newest books.
 * Uses React Query hooks for data fetching with proper loading/error states.
 */
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Link } from 'expo-router';
import { useCallback } from 'react';
import { useAuthStore } from '../../src/stores/auth';
import { Category } from '../../src/lib/api';
import {
  useRecommendations,
  usePopularBooks,
  useNewestBooks,
  useCategories,
} from '../../src/hooks/useApi';
import {
  SectionHeader,
  HorizontalBookList,
  RecommendationList,
  EmptyState,
} from '../../src/components/BookListComponents';
import { BookCard } from '../../src/components/BookCard';

export default function HomeScreen() {
  const { user } = useAuthStore();

  // Fetch recommendations (personalized)
  const {
    data: recommendationsData,
    isLoading: recommendationsLoading,
    isError: recommendationsError,
    refetch: refetchRecommendations,
  } = useRecommendations({ limit: 10 });

  // Fetch categories
  const { data: categoriesData } = useCategories();

  // Fetch popular books
  const {
    data: popularData,
    isLoading: popularLoading,
    isError: popularError,
    refetch: refetchPopular,
  } = usePopularBooks(10);

  // Fetch newest books
  const {
    data: newestData,
    isLoading: newestLoading,
    isError: newestError,
    refetch: refetchNewest,
  } = useNewestBooks(10);

  // Determine if any section is refreshing
  const isRefreshing = recommendationsLoading || popularLoading || newestLoading;

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    await Promise.all([
      refetchRecommendations(),
      refetchPopular(),
      refetchNewest(),
    ]);
  }, [refetchRecommendations, refetchPopular, refetchNewest]);

  // Extract data
  const recommendations = recommendationsData?.items || [];
  const categories = categoriesData?.data || [];
  const popularBooks = popularData?.data || [];
  const newestBooks = newestData?.data || [];

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor="#0ea5e9"
        />
      }
    >
      {/* Welcome section */}
      <View className="bg-primary-600 px-6 py-8">
        <Text className="text-white text-lg">Cześć 👋</Text>
        <Text className="text-white text-2xl font-bold">
          {user?.name || 'Czytelniku'}!
        </Text>
        <Text className="text-primary-100 mt-2">
          Odkryj książki dopasowane do Twoich zainteresowań
        </Text>
      </View>

      {/* Quick actions */}
      <View className="px-4 py-6">
        <View className="flex-row gap-3">
          <Link href="/(tabs)/search" asChild>
            <TouchableOpacity className="bg-white rounded-xl p-4 flex-1 shadow-sm border border-gray-100">
              <Text className="text-2xl mb-2">🔍</Text>
              <Text className="font-medium text-gray-900">Szukaj książek</Text>
              <Text className="text-gray-500 text-sm">Przeglądaj katalog</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/(tabs)/chat" asChild>
            <TouchableOpacity className="bg-white rounded-xl p-4 flex-1 shadow-sm border border-gray-100">
              <Text className="text-2xl mb-2">💬</Text>
              <Text className="font-medium text-gray-900">Zapytaj AI</Text>
              <Text className="text-gray-500 text-sm">Polecenia dla Ciebie</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      {/* Recommendations section */}
      <View className="py-4">
        <SectionHeader
          title="Polecane dla Ciebie"
          linkHref="/(tabs)/search?sort=relevance"
          linkText="Zobacz więcej"
        />
        <RecommendationList
          data={recommendations}
          isLoading={recommendationsLoading}
          isError={recommendationsError}
          errorMessage="Nie udało się załadować rekomendacji"
          emptyMessage="Dodaj książki do półki, aby otrzymać spersonalizowane polecenia!"
          onRetry={refetchRecommendations}
        />
        {/* Confidence indicator */}
        {recommendationsData?.meta && !recommendationsLoading && recommendations.length > 0 && (
          <View className="px-4 mt-2">
            <Text className="text-xs text-gray-400">
              {recommendationsData.meta.fallbackUsed
                ? 'Popularne książki (dodaj więcej do półki dla lepszych rekomendacji)'
                : `Dopasowanie: ${Math.round(recommendationsData.meta.confidence * 100)}%`}
            </Text>
          </View>
        )}
      </View>

      {/* Categories */}
      <View className="py-4">
        <SectionHeader title="Kategorie" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {categories.slice(0, 8).map((category: Category) => (
            <Link
              key={category.id}
              href={`/(tabs)/search?category=${category.slug}`}
              asChild
            >
              <TouchableOpacity className="bg-white rounded-xl px-4 py-3 items-center mr-3 min-w-[90px] shadow-sm border border-gray-100">
                <Text className="text-2xl mb-1">
                  {getCategoryEmoji(category.slug)}
                </Text>
                <Text className="text-gray-700 text-sm text-center" numberOfLines={1}>
                  {category.name}
                </Text>
                {category.bookCount !== undefined && (
                  <Text className="text-gray-400 text-xs">
                    {category.bookCount} książek
                  </Text>
                )}
              </TouchableOpacity>
            </Link>
          ))}
        </ScrollView>
      </View>

      {/* Popular books */}
      <View className="py-4">
        <SectionHeader
          title="Popularne książki"
          linkHref="/(tabs)/search?sort=rating"
        />
        <HorizontalBookList
          data={popularBooks}
          isLoading={popularLoading}
          isError={popularError}
          errorMessage="Nie udało się załadować popularnych książek"
          emptyMessage="Brak popularnych książek"
          onRetry={refetchPopular}
        />
      </View>

      {/* Newest books */}
      <View className="py-4">
        <SectionHeader
          title="Nowości"
          linkHref="/(tabs)/search?sort=newest"
        />
        {newestLoading ? (
          <View className="px-4">
            {[1, 2, 3].map((i) => (
              <View key={i} className="flex-row bg-white p-3 rounded-xl mb-3 border border-gray-100">
                <View className="w-20 h-28 bg-gray-200 rounded-lg" />
                <View className="flex-1 ml-3 justify-center">
                  <View className="h-4 bg-gray-200 rounded w-3/4" />
                  <View className="h-3 bg-gray-200 rounded w-1/2 mt-2" />
                  <View className="h-3 bg-gray-200 rounded w-1/3 mt-2" />
                </View>
              </View>
            ))}
          </View>
        ) : newestError ? (
          <View className="bg-red-50 rounded-xl p-4 mx-4 items-center">
            <Text className="text-red-600 text-center">
              Nie udało się załadować nowości
            </Text>
            <TouchableOpacity
              onPress={() => refetchNewest()}
              className="mt-2 bg-red-100 px-4 py-2 rounded-lg"
            >
              <Text className="text-red-700 font-medium">Spróbuj ponownie</Text>
            </TouchableOpacity>
          </View>
        ) : newestBooks.length === 0 ? (
          <EmptyState message="Brak nowych książek" />
        ) : (
          <View className="px-4">
            {newestBooks.slice(0, 5).map((book) => (
              <BookCard key={book.id} book={book} variant="list" />
            ))}
          </View>
        )}
      </View>

      {/* Bottom padding */}
      <View className="h-8" />
    </ScrollView>
  );
}

/**
 * Get emoji for category based on slug
 */
function getCategoryEmoji(slug: string): string {
  const emojiMap: Record<string, string> = {
    'biznes-i-ekonomia': '💼',
    'rozwoj-osobisty': '🌱',
    'literatura-piekna': '📖',
    'kryminal-i-thriller': '🔎',
    'science-fiction-i-fantasy': '🚀',
    'historia': '🏛️',
    'biografia': '👤',
    'nauka-i-technika': '🔬',
    'psychologia': '🧠',
    'zdrowie-i-uroda': '💪',
    'poradniki': '📋',
    'dla-dzieci': '🧒',
    'mlodziezowe': '🎓',
    'komiksy-i-manga': '🎨',
  };
  return emojiMap[slug] || '📚';
}

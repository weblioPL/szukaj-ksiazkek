import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../src/stores/auth';
import { api, Book, Category } from '../../src/lib/api';
import { BookCard } from '../../src/components/BookCard';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.books.categories(),
  });

  // Fetch popular books
  const {
    data: popularData,
    isLoading: popularLoading,
    refetch: refetchPopular,
  } = useQuery({
    queryKey: ['books', 'popular'],
    queryFn: () => api.books.popular(6),
  });

  // Fetch newest books
  const {
    data: newestData,
    isLoading: newestLoading,
    refetch: refetchNewest,
  } = useQuery({
    queryKey: ['books', 'newest'],
    queryFn: () => api.books.newest(6),
  });

  const onRefresh = useCallback(async () => {
    await Promise.all([refetchPopular(), refetchNewest()]);
  }, [refetchPopular, refetchNewest]);

  const categories = categoriesData?.data || [];
  const popularBooks = popularData?.data || [];
  const newestBooks = newestData?.data || [];

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl
          refreshing={popularLoading || newestLoading}
          onRefresh={onRefresh}
        />
      }
    >
      {/* Welcome section */}
      <View className="bg-primary-600 px-6 py-8">
        <Text className="text-white text-lg">Witaj,</Text>
        <Text className="text-white text-2xl font-bold">
          {user?.name || 'Czytelniku'}!
        </Text>
        <Text className="text-primary-100 mt-2">
          Co dzisiaj chcesz przeczytac?
        </Text>
      </View>

      {/* Quick actions */}
      <View className="px-6 py-6">
        <Text className="text-lg font-semibold text-gray-900 mb-4">
          Szybkie akcje
        </Text>
        <View className="flex-row gap-4">
          <Link href="/(tabs)/search" asChild>
            <TouchableOpacity className="bg-white rounded-xl p-4 flex-1 shadow-sm">
              <Text className="text-3xl mb-2">🔍</Text>
              <Text className="font-medium text-gray-900">Szukaj ksiazek</Text>
              <Text className="text-gray-500 text-sm">Przegladaj katalog</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/(tabs)/chat" asChild>
            <TouchableOpacity className="bg-white rounded-xl p-4 flex-1 shadow-sm">
              <Text className="text-3xl mb-2">💬</Text>
              <Text className="font-medium text-gray-900">Zapytaj AI</Text>
              <Text className="text-gray-500 text-sm">Polecenia dla Ciebie</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      {/* Categories */}
      <View className="px-6 py-4">
        <Text className="text-lg font-semibold text-gray-900 mb-4">
          Kategorie
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row">
            {categories.slice(0, 8).map((category: Category) => (
              <Link
                key={category.id}
                href={`/(tabs)/search?category=${category.slug}`}
                asChild
              >
                <TouchableOpacity className="bg-white rounded-xl px-4 py-3 items-center mr-3 min-w-[90px] shadow-sm">
                  <Text className="text-2xl mb-1">
                    {getCategoryEmoji(category.slug)}
                  </Text>
                  <Text className="text-gray-700 text-sm text-center" numberOfLines={1}>
                    {category.name}
                  </Text>
                  {category.bookCount !== undefined && (
                    <Text className="text-gray-400 text-xs">
                      {category.bookCount} ksiazek
                    </Text>
                  )}
                </TouchableOpacity>
              </Link>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Popular books */}
      <View className="px-6 py-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-semibold text-gray-900">
            Popularne ksiazki
          </Text>
          <Link href="/(tabs)/search?sort=rating" asChild>
            <TouchableOpacity>
              <Text className="text-primary-600 text-sm">Zobacz wszystkie</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {popularLoading ? (
          <View className="py-8 items-center">
            <ActivityIndicator size="small" color="#4F46E5" />
          </View>
        ) : popularBooks.length === 0 ? (
          <View className="bg-white rounded-xl p-6 items-center shadow-sm">
            <Text className="text-gray-500">Brak popularnych ksiazek</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row">
              {popularBooks.map((book: Book) => (
                <View key={book.id} className="w-32 mr-4">
                  <BookCard book={book} variant="grid" />
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Newest books */}
      <View className="px-6 py-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-semibold text-gray-900">Nowosci</Text>
          <Link href="/(tabs)/search?sort=newest" asChild>
            <TouchableOpacity>
              <Text className="text-primary-600 text-sm">Zobacz wszystkie</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {newestLoading ? (
          <View className="py-8 items-center">
            <ActivityIndicator size="small" color="#4F46E5" />
          </View>
        ) : newestBooks.length === 0 ? (
          <View className="bg-white rounded-xl p-6 items-center shadow-sm">
            <Text className="text-gray-500">Brak nowych ksiazek</Text>
          </View>
        ) : (
          <View>
            {newestBooks.slice(0, 4).map((book: Book) => (
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

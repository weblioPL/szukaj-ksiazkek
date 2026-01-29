import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['books', searchQuery, activeCategory],
    queryFn: () =>
      api.books.list({
        search: searchQuery || undefined,
        category: activeCategory || undefined,
        limit: 20,
      }),
    enabled: searchQuery.length > 2 || activeCategory !== null,
  });

  const categories = [
    { slug: 'biznes-i-ekonomia', name: 'Biznes' },
    { slug: 'rozwoj-osobisty', name: 'Rozwój' },
    { slug: 'literatura-piekna', name: 'Literatura' },
    { slug: 'kryminal-i-thriller', name: 'Kryminał' },
    { slug: 'science-fiction-i-fantasy', name: 'Sci-Fi' },
  ];

  return (
    <View className="flex-1 bg-gray-50">
      {/* Search input */}
      <View className="bg-white px-4 py-3 border-b border-gray-200">
        <TextInput
          className="bg-gray-100 rounded-lg px-4 py-3 text-base"
          placeholder="Szukaj książek, autorów..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
      </View>

      {/* Category filters */}
      <View className="bg-white px-4 py-3 border-b border-gray-200">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            <TouchableOpacity
              className={`px-4 py-2 rounded-full ${
                activeCategory === null
                  ? 'bg-primary-600'
                  : 'bg-gray-100'
              }`}
              onPress={() => setActiveCategory(null)}
            >
              <Text
                className={
                  activeCategory === null ? 'text-white' : 'text-gray-700'
                }
              >
                Wszystkie
              </Text>
            </TouchableOpacity>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.slug}
                className={`px-4 py-2 rounded-full ${
                  activeCategory === category.slug
                    ? 'bg-primary-600'
                    : 'bg-gray-100'
                }`}
                onPress={() => setActiveCategory(category.slug)}
              >
                <Text
                  className={
                    activeCategory === category.slug
                      ? 'text-white'
                      : 'text-gray-700'
                  }
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Results */}
      <ScrollView className="flex-1">
        {isLoading && (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color="#0ea5e9" />
            <Text className="text-gray-500 mt-4">Szukam książek...</Text>
          </View>
        )}

        {error && (
          <View className="py-12 items-center px-6">
            <Text className="text-red-500 text-center">
              Wystąpił błąd podczas wyszukiwania
            </Text>
          </View>
        )}

        {!isLoading && !error && data?.data && data.data.length > 0 && (
          <View className="p-4">
            {data.data.map((book: any) => (
              <TouchableOpacity
                key={book.id}
                className="bg-white rounded-xl p-4 mb-3 flex-row shadow-sm"
              >
                <View className="w-16 h-24 bg-gray-200 rounded-lg mr-4 items-center justify-center">
                  <Text className="text-2xl">📖</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-gray-900" numberOfLines={2}>
                    {book.title}
                  </Text>
                  <Text className="text-gray-500 text-sm mt-1">
                    {book.authors?.map((a: any) => a.name).join(', ') || 'Nieznany autor'}
                  </Text>
                  {book.avgRating > 0 && (
                    <View className="flex-row items-center mt-2">
                      <Text className="text-yellow-500">★</Text>
                      <Text className="text-gray-600 text-sm ml-1">
                        {book.avgRating.toFixed(1)} ({book.ratingsCount})
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!isLoading &&
          !error &&
          (searchQuery.length < 3 && activeCategory === null) && (
            <View className="py-12 items-center px-6">
              <Text className="text-5xl mb-4">🔍</Text>
              <Text className="text-gray-900 font-medium text-center">
                Szukaj książek
              </Text>
              <Text className="text-gray-500 text-center mt-2">
                Wpisz tytuł, autora lub wybierz kategorię
              </Text>
            </View>
          )}

        {!isLoading &&
          !error &&
          data?.data?.length === 0 && (
            <View className="py-12 items-center px-6">
              <Text className="text-5xl mb-4">📭</Text>
              <Text className="text-gray-900 font-medium text-center">
                Brak wyników
              </Text>
              <Text className="text-gray-500 text-center mt-2">
                Spróbuj innych słów kluczowych
              </Text>
            </View>
          )}
      </ScrollView>
    </View>
  );
}

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api, Book, Category } from '../../src/lib/api';
import { BookCard } from '../../src/components/BookCard';
import { useDebouncedValue } from '../../src/hooks/useDebounce';

type FormatFilter = 'all' | 'paper' | 'ebook' | 'audiobook';

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeFormat, setActiveFormat] = useState<FormatFilter>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.books.categories(),
  });

  // Fetch books
  const {
    data: booksData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['books', debouncedSearch, activeCategory, activeFormat],
    queryFn: () =>
      api.books.list({
        search: debouncedSearch || undefined,
        category: activeCategory || undefined,
        format: activeFormat === 'all' ? undefined : activeFormat,
        limit: 20,
      }),
    enabled: debouncedSearch.length >= 2 || activeCategory !== null,
  });

  const categories = categoriesData?.data || [];
  const books = booksData?.data || [];

  const renderBook = useCallback(
    ({ item }: { item: Book }) => <BookCard book={item} variant={viewMode} />,
    [viewMode],
  );

  return (
    <View className="flex-1 bg-gray-50">
      {/* Search input */}
      <View className="bg-white px-4 py-3 border-b border-gray-200">
        <View className="flex-row items-center">
          <View className="flex-1 bg-gray-100 rounded-xl px-4 py-3 flex-row items-center">
            <Text className="text-gray-400 mr-2">🔍</Text>
            <TextInput
              className="flex-1 text-base"
              placeholder="Szukaj ksiazek, autorow..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text className="text-gray-400 text-lg">✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* View toggle */}
          <TouchableOpacity
            className="ml-3 p-2"
            onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
          >
            <Text className="text-xl">{viewMode === 'list' ? '⊞' : '☰'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Category filters */}
      <View className="bg-white px-2 py-3 border-b border-gray-200">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <FilterChip
            label="Wszystkie"
            selected={activeCategory === null}
            onPress={() => setActiveCategory(null)}
          />
          {categories.slice(0, 8).map((category: Category) => (
            <FilterChip
              key={category.slug}
              label={category.name}
              selected={activeCategory === category.slug}
              onPress={() => setActiveCategory(category.slug)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Format filters */}
      <View className="bg-white px-2 py-2 border-b border-gray-200">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <FilterChip
            label="Wszystkie formaty"
            selected={activeFormat === 'all'}
            onPress={() => setActiveFormat('all')}
          />
          <FilterChip
            label="📚 Papierowe"
            selected={activeFormat === 'paper'}
            onPress={() => setActiveFormat('paper')}
          />
          <FilterChip
            label="📱 E-booki"
            selected={activeFormat === 'ebook'}
            onPress={() => setActiveFormat('ebook')}
          />
          <FilterChip
            label="🎧 Audiobooki"
            selected={activeFormat === 'audiobook'}
            onPress={() => setActiveFormat('audiobook')}
          />
        </ScrollView>
      </View>

      {/* Results */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text className="text-gray-500 mt-4">Szukam ksiazek...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-5xl mb-4">😕</Text>
          <Text className="text-red-500 text-center">
            Wystapil blad podczas wyszukiwania
          </Text>
          <TouchableOpacity
            className="mt-4 bg-primary-600 px-6 py-3 rounded-lg"
            onPress={() => refetch()}
          >
            <Text className="text-white font-medium">Sprobuj ponownie</Text>
          </TouchableOpacity>
        </View>
      ) : debouncedSearch.length < 2 && activeCategory === null ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-5xl mb-4">🔍</Text>
          <Text className="text-gray-900 font-medium text-center text-lg">
            Szukaj ksiazek
          </Text>
          <Text className="text-gray-500 text-center mt-2">
            Wpisz tytul, autora lub wybierz kategorie
          </Text>
        </View>
      ) : books.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-5xl mb-4">📭</Text>
          <Text className="text-gray-900 font-medium text-center text-lg">
            Brak wynikow
          </Text>
          <Text className="text-gray-500 text-center mt-2">
            Sprobuj innych slow kluczowych
          </Text>
        </View>
      ) : (
        <FlatList
          data={books}
          renderItem={renderBook}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: 16,
            ...(viewMode === 'grid' && { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }),
          }}
          numColumns={viewMode === 'grid' ? 2 : 1}
          key={viewMode} // Force re-render when view mode changes
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text className="text-gray-500 text-sm mb-4">
              Znaleziono {booksData?.pagination?.total || books.length} ksiazek
            </Text>
          }
        />
      )}
    </View>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className={`px-4 py-2 rounded-full mx-1 ${
        selected ? 'bg-primary-600' : 'bg-gray-100'
      }`}
      onPress={onPress}
    >
      <Text
        className={`text-sm font-medium ${selected ? 'text-white' : 'text-gray-700'}`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

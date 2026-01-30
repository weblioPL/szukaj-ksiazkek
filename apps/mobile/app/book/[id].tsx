import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { api, Book, Offer } from '../../src/lib/api';
import { OfferCard } from '../../src/components/OfferCard';

type FormatFilter = 'all' | 'paper' | 'ebook' | 'audiobook';

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [offersLoading, setOffersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<FormatFilter>('all');

  const loadBook = async () => {
    try {
      setError(null);
      const data = await api.books.get(id!);
      setBook(data);
    } catch (err: any) {
      setError(err.message || 'Nie udalo sie zaladowac ksiazki');
    } finally {
      setLoading(false);
    }
  };

  const loadOffers = async (format?: string) => {
    if (!id) return;

    try {
      setOffersLoading(true);
      const response = await api.offers.byBook(
        id,
        format === 'all' ? undefined : format,
      );
      setOffers(response.data);
    } catch (err: any) {
      console.error('Failed to load offers:', err);
    } finally {
      setOffersLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadBook(), loadOffers(selectedFormat)]);
    setRefreshing(false);
  };

  useEffect(() => {
    if (id) {
      loadBook();
      loadOffers();
    }
  }, [id]);

  useEffect(() => {
    loadOffers(selectedFormat);
  }, [selectedFormat]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (error || !book) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <Text className="text-red-500 text-center">{error || 'Nie znaleziono ksiazki'}</Text>
        <TouchableOpacity
          className="mt-4 bg-primary-600 px-6 py-3 rounded-lg"
          onPress={() => router.back()}
        >
          <Text className="text-white font-medium">Wróc</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const authorsText = book.authors.map((a) => a.name).join(', ');
  const categoriesText = book.categories.map((c) => c.name).join(', ');

  return (
    <>
      <Stack.Screen
        options={{
          title: book.title,
          headerTitleStyle: { fontSize: 16 },
        }}
      />

      <ScrollView
        className="flex-1 bg-gray-50"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Hero section with cover */}
        <View className="bg-white pb-6">
          <View className="items-center pt-6">
            <View className="w-40 h-60 bg-gray-100 rounded-xl overflow-hidden shadow-lg">
              {book.coverUrl ? (
                <Image
                  source={{ uri: book.coverUrl }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-full items-center justify-center bg-gray-200">
                  <Text className="text-6xl">📖</Text>
                </View>
              )}
            </View>
          </View>

          {/* Book info */}
          <View className="px-6 mt-6">
            <Text className="text-2xl font-bold text-gray-900 text-center">
              {book.title}
            </Text>
            {book.originalTitle && book.originalTitle !== book.title && (
              <Text className="text-sm text-gray-500 text-center mt-1">
                ({book.originalTitle})
              </Text>
            )}
            <Text className="text-base text-primary-600 text-center mt-2">
              {authorsText}
            </Text>

            {/* Rating */}
            <View className="flex-row items-center justify-center mt-3">
              <Text className="text-yellow-500 text-xl">★</Text>
              <Text className="text-lg font-semibold text-gray-900 ml-1">
                {book.avgRating.toFixed(1)}
              </Text>
              <Text className="text-sm text-gray-500 ml-1">
                ({book.ratingsCount} ocen)
              </Text>
            </View>

            {/* Formats */}
            <View className="flex-row justify-center mt-4">
              {book.formats.paper && (
                <View className="bg-gray-100 px-3 py-1.5 rounded-full mr-2">
                  <Text className="text-sm text-gray-700">📚 Papierowa</Text>
                </View>
              )}
              {book.formats.ebook && (
                <View className="bg-gray-100 px-3 py-1.5 rounded-full mr-2">
                  <Text className="text-sm text-gray-700">📱 E-book</Text>
                </View>
              )}
              {book.formats.audiobook && (
                <View className="bg-gray-100 px-3 py-1.5 rounded-full">
                  <Text className="text-sm text-gray-700">🎧 Audiobook</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Quick actions */}
        <View className="flex-row px-6 py-4 bg-white mt-2">
          <TouchableOpacity className="flex-1 bg-primary-600 py-3 rounded-xl mr-2">
            <Text className="text-white text-center font-semibold">
              Chce przeczytac
            </Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1 bg-gray-100 py-3 rounded-xl ml-2">
            <Text className="text-gray-700 text-center font-medium">Ocen</Text>
          </TouchableOpacity>
        </View>

        {/* Description */}
        {book.description && (
          <View className="bg-white mt-2 px-6 py-4">
            <Text className="text-lg font-semibold text-gray-900 mb-2">Opis</Text>
            <Text className="text-gray-600 leading-6">{book.description}</Text>
          </View>
        )}

        {/* Details */}
        <View className="bg-white mt-2 px-6 py-4">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Szczegoly</Text>
          <View className="flex-row flex-wrap">
            {book.isbn && (
              <DetailItem label="ISBN" value={book.isbn} />
            )}
            {book.publisher && (
              <DetailItem label="Wydawnictwo" value={book.publisher} />
            )}
            {book.pageCount && (
              <DetailItem label="Liczba stron" value={book.pageCount.toString()} />
            )}
            {categoriesText && (
              <DetailItem label="Kategorie" value={categoriesText} />
            )}
          </View>
        </View>

        {/* Offers section */}
        <View className="bg-white mt-2 px-6 py-4">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-gray-900">
              Oferty ({offers.length})
            </Text>
            {offersLoading && <ActivityIndicator size="small" color="#4F46E5" />}
          </View>

          {/* Format filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4 -mx-1"
          >
            <FormatFilterButton
              label="Wszystkie"
              selected={selectedFormat === 'all'}
              onPress={() => setSelectedFormat('all')}
            />
            {book.formats.paper && (
              <FormatFilterButton
                label="📚 Papierowa"
                selected={selectedFormat === 'paper'}
                onPress={() => setSelectedFormat('paper')}
              />
            )}
            {book.formats.ebook && (
              <FormatFilterButton
                label="📱 E-book"
                selected={selectedFormat === 'ebook'}
                onPress={() => setSelectedFormat('ebook')}
              />
            )}
            {book.formats.audiobook && (
              <FormatFilterButton
                label="🎧 Audiobook"
                selected={selectedFormat === 'audiobook'}
                onPress={() => setSelectedFormat('audiobook')}
              />
            )}
          </ScrollView>

          {/* Offers list */}
          {offers.length === 0 ? (
            <View className="py-8 items-center">
              <Text className="text-gray-500">Brak ofert dla wybranego formatu</Text>
            </View>
          ) : (
            offers.map((offer, index) => (
              <OfferCard key={offer.id || index} offer={offer} />
            ))
          )}
        </View>

        {/* Bottom padding */}
        <View className="h-8" />
      </ScrollView>
    </>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View className="w-1/2 mb-3">
      <Text className="text-xs text-gray-500">{label}</Text>
      <Text className="text-sm text-gray-900 mt-0.5">{value}</Text>
    </View>
  );
}

function FormatFilterButton({
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
        className={`text-sm font-medium ${
          selected ? 'text-white' : 'text-gray-700'
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

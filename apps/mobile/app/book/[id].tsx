/**
 * Book Detail Screen
 *
 * Main conversion point: displays book info, offers, bookshelf actions.
 * Uses React Query for data fetching with optimistic updates.
 */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { ReadingStatus } from '../../src/lib/api';
import {
  useBook,
  useOffers,
  useBookshelfItem,
  useUpdateBookshelfStatus,
  useUpdateBookshelfRating,
  useRecommendations,
  useExplainRecommendation,
} from '../../src/hooks/useApi';
import { OfferCard } from '../../src/components/OfferCard';
import { BookCardCompact, SectionHeader } from '../../src/components/BookListComponents';

type FormatFilter = 'all' | 'paper' | 'ebook' | 'audiobook';

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [selectedFormat, setSelectedFormat] = useState<FormatFilter>('all');
  const [showExplanation, setShowExplanation] = useState(false);

  // Data fetching with React Query
  const {
    data: book,
    isLoading: bookLoading,
    isError: bookError,
    refetch: refetchBook,
  } = useBook(id!, { enabled: !!id });

  const {
    data: offersData,
    isLoading: offersLoading,
    refetch: refetchOffers,
  } = useOffers(id!, selectedFormat === 'all' ? undefined : selectedFormat);

  const {
    data: bookshelfItem,
    isLoading: bookshelfLoading,
  } = useBookshelfItem(id!);

  const {
    data: recommendationsData,
  } = useRecommendations({ limit: 5 });

  // Mutations
  const updateStatus = useUpdateBookshelfStatus();
  const updateRating = useUpdateBookshelfRating();
  const explainMutation = useExplainRecommendation();

  // Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchBook(), refetchOffers()]);
    setRefreshing(false);
  }, [refetchBook, refetchOffers]);

  // Handle status change
  const handleStatusChange = (status: ReadingStatus) => {
    if (!id) return;

    updateStatus.mutate(
      { bookId: id, status },
      {
        onError: (error) => {
          Alert.alert('Błąd', 'Nie udało się zaktualizować statusu');
        },
      }
    );
  };

  // Handle rating change
  const handleRatingChange = (rating: number) => {
    if (!id) return;

    // Check if book is READ
    if (bookshelfItem?.status !== 'READ') {
      Alert.alert(
        'Najpierw przeczytaj',
        'Możesz ocenić książkę dopiero po oznaczeniu jej jako przeczytanej.',
      );
      return;
    }

    updateRating.mutate(
      { bookId: id, rating },
      {
        onError: () => {
          Alert.alert('Błąd', 'Nie udało się zapisać oceny');
        },
      }
    );
  };

  // Handle explanation toggle
  const handleExplainToggle = () => {
    if (!showExplanation && !explainMutation.data && id) {
      explainMutation.mutate({ bookId: id });
    }
    setShowExplanation(!showExplanation);
  };

  // Loading state
  if (bookLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Ładowanie...' }} />
        <ScrollView className="flex-1 bg-gray-50">
          <BookDetailSkeleton />
        </ScrollView>
      </>
    );
  }

  // Error state
  if (bookError || !book) {
    return (
      <>
        <Stack.Screen options={{ title: 'Błąd' }} />
        <View className="flex-1 items-center justify-center bg-gray-50 px-6">
          <Text className="text-4xl mb-4">😕</Text>
          <Text className="text-red-500 text-center text-lg">
            Nie udało się załadować książki
          </Text>
          <TouchableOpacity
            className="mt-4 bg-primary-600 px-6 py-3 rounded-lg"
            onPress={() => refetchBook()}
          >
            <Text className="text-white font-medium">Spróbuj ponownie</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="mt-2 px-6 py-3"
            onPress={() => router.back()}
          >
            <Text className="text-primary-600 font-medium">Wróć</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const offers = offersData?.data || [];
  const authorsText = book.authors.map((a) => a.name).join(', ');
  const currentStatus = bookshelfItem?.status;
  const currentRating = bookshelfItem?.rating;

  // Similar books (excluding current book)
  const similarBooks = recommendationsData?.items
    .filter((r) => r.book.id !== id)
    .slice(0, 4) || [];

  return (
    <>
      <Stack.Screen
        options={{
          title: book.title.length > 30 ? book.title.substring(0, 30) + '...' : book.title,
          headerTitleStyle: { fontSize: 16 },
        }}
      />

      <ScrollView
        className="flex-1 bg-gray-50"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0ea5e9"
          />
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

            {/* Categories as pills */}
            <View className="flex-row flex-wrap justify-center mt-3">
              {book.categories.slice(0, 3).map((cat) => (
                <View key={cat.id} className="bg-gray-100 px-3 py-1 rounded-full mr-2 mb-2">
                  <Text className="text-xs text-gray-600">{cat.name}</Text>
                </View>
              ))}
            </View>

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

        {/* Bookshelf Status Control */}
        <View className="bg-white mt-2 px-6 py-4">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Moja półka</Text>
          <StatusSelector
            currentStatus={currentStatus}
            onStatusChange={handleStatusChange}
            isLoading={updateStatus.isPending || bookshelfLoading}
          />

          {/* Rating (only if READ) */}
          {currentStatus === 'READ' && (
            <View className="mt-4">
              <Text className="text-sm text-gray-600 mb-2">Twoja ocena</Text>
              <RatingStars
                rating={currentRating || 0}
                onRatingChange={handleRatingChange}
                disabled={updateRating.isPending}
              />
            </View>
          )}

          {/* Helper text if not READ */}
          {currentStatus && currentStatus !== 'READ' && (
            <Text className="text-xs text-gray-400 mt-3">
              Oznacz jako przeczytaną, aby dodać ocenę
            </Text>
          )}
        </View>

        {/* Description */}
        {book.description && (
          <View className="bg-white mt-2 px-6 py-4">
            <Text className="text-lg font-semibold text-gray-900 mb-2">Opis</Text>
            <Text className="text-gray-600 leading-6">{book.description}</Text>
          </View>
        )}

        {/* Recommendation Explanation (collapsible) */}
        <View className="bg-white mt-2 px-6 py-4">
          <TouchableOpacity
            onPress={handleExplainToggle}
            className="flex-row items-center justify-between"
          >
            <Text className="text-lg font-semibold text-gray-900">
              Dlaczego polecamy tę książkę?
            </Text>
            <Text className="text-primary-600 text-xl">
              {showExplanation ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {showExplanation && (
            <View className="mt-3">
              {explainMutation.isPending ? (
                <View className="py-4 items-center">
                  <Text className="text-gray-500">Analizuję...</Text>
                </View>
              ) : explainMutation.isError ? (
                <View className="py-2">
                  <Text className="text-red-500">
                    Nie udało się załadować wyjaśnienia
                  </Text>
                  <TouchableOpacity
                    onPress={() => explainMutation.mutate({ bookId: id! })}
                    className="mt-2"
                  >
                    <Text className="text-primary-600">Spróbuj ponownie</Text>
                  </TouchableOpacity>
                </View>
              ) : explainMutation.data ? (
                <View>
                  <Text className="text-gray-700 leading-6">
                    {explainMutation.data.explanation}
                  </Text>
                  {explainMutation.data.alternatives && explainMutation.data.alternatives.length > 0 && (
                    <View className="mt-3 pt-3 border-t border-gray-100">
                      <Text className="text-sm text-gray-500 mb-2">Sprawdź też:</Text>
                      {explainMutation.data.alternatives.map((alt) => (
                        <TouchableOpacity
                          key={alt.id}
                          onPress={() => router.push(`/book/${alt.id}`)}
                          className="py-1"
                        >
                          <Text className="text-primary-600">• {alt.title}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ) : (
                <Text className="text-gray-500">
                  Brak dostępnego wyjaśnienia
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Offers section */}
        <View className="bg-white mt-2 px-6 py-4">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-gray-900">
              Gdzie kupić {offers.length > 0 && `(${offers.length})`}
            </Text>
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
          {offersLoading ? (
            <View className="py-8 items-center">
              <Text className="text-gray-500">Ładowanie ofert...</Text>
            </View>
          ) : offers.length === 0 ? (
            <View className="py-8 items-center bg-gray-50 rounded-xl">
              <Text className="text-3xl mb-2">🛒</Text>
              <Text className="text-gray-500 text-center">
                Brak ofert dla wybranego formatu
              </Text>
              <Text className="text-xs text-gray-400 mt-1">
                Spróbuj wybrać inny format lub sprawdź później
              </Text>
            </View>
          ) : (
            offers.map((offer, index) => (
              <OfferCard key={offer.id || index} offer={offer} />
            ))
          )}
        </View>

        {/* Details */}
        <View className="bg-white mt-2 px-6 py-4">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Szczegóły</Text>
          <View className="flex-row flex-wrap">
            {book.isbn && <DetailItem label="ISBN" value={book.isbn} />}
            {book.publisher && <DetailItem label="Wydawnictwo" value={book.publisher} />}
            {book.pageCount && <DetailItem label="Liczba stron" value={book.pageCount.toString()} />}
            {book.language && <DetailItem label="Język" value={book.language} />}
          </View>
        </View>

        {/* Similar Books */}
        {similarBooks.length > 0 && (
          <View className="mt-2 py-4">
            <SectionHeader title="Podobne książki" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            >
              {similarBooks.map((rec) => (
                <BookCardCompact
                  key={rec.book.id}
                  book={rec.book}
                  score={rec.score}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Bottom padding */}
        <View className="h-8" />
      </ScrollView>
    </>
  );
}

// ============================================
// Sub-components
// ============================================

function StatusSelector({
  currentStatus,
  onStatusChange,
  isLoading,
}: {
  currentStatus?: ReadingStatus;
  onStatusChange: (status: ReadingStatus) => void;
  isLoading: boolean;
}) {
  const statuses: { value: ReadingStatus; label: string; emoji: string }[] = [
    { value: 'WANT_TO_READ', label: 'Chcę przeczytać', emoji: '📚' },
    { value: 'READING', label: 'Czytam', emoji: '📖' },
    { value: 'READ', label: 'Przeczytana', emoji: '✅' },
  ];

  return (
    <View className="flex-row">
      {statuses.map((status, index) => {
        const isSelected = currentStatus === status.value;
        const isFirst = index === 0;
        const isLast = index === statuses.length - 1;

        return (
          <TouchableOpacity
            key={status.value}
            onPress={() => onStatusChange(status.value)}
            disabled={isLoading}
            className={`flex-1 py-3 items-center border ${
              isSelected
                ? 'bg-primary-600 border-primary-600'
                : 'bg-white border-gray-200'
            } ${isFirst ? 'rounded-l-xl' : ''} ${isLast ? 'rounded-r-xl' : ''} ${
              !isFirst ? '-ml-px' : ''
            }`}
          >
            <Text className={`text-lg ${isLoading ? 'opacity-50' : ''}`}>
              {status.emoji}
            </Text>
            <Text
              className={`text-xs mt-1 ${
                isSelected ? 'text-white font-medium' : 'text-gray-600'
              } ${isLoading ? 'opacity-50' : ''}`}
            >
              {status.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function RatingStars({
  rating,
  onRatingChange,
  disabled,
}: {
  rating: number;
  onRatingChange: (rating: number) => void;
  disabled: boolean;
}) {
  return (
    <View className="flex-row">
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => onRatingChange(star)}
          disabled={disabled}
          className="mr-2"
        >
          <Text
            className={`text-3xl ${disabled ? 'opacity-50' : ''}`}
          >
            {star <= rating ? '★' : '☆'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
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

function BookDetailSkeleton() {
  return (
    <View className="bg-white">
      {/* Cover skeleton */}
      <View className="items-center pt-6 pb-6">
        <View className="w-40 h-60 bg-gray-200 rounded-xl" />
      </View>

      {/* Title and author skeleton */}
      <View className="px-6">
        <View className="h-8 bg-gray-200 rounded w-3/4 mx-auto" />
        <View className="h-5 bg-gray-200 rounded w-1/2 mx-auto mt-3" />
        <View className="h-4 bg-gray-200 rounded w-1/3 mx-auto mt-3" />
      </View>

      {/* Status selector skeleton */}
      <View className="px-6 py-4 mt-4">
        <View className="h-5 bg-gray-200 rounded w-24 mb-3" />
        <View className="flex-row">
          <View className="flex-1 h-16 bg-gray-200 rounded-l-xl" />
          <View className="flex-1 h-16 bg-gray-200 -ml-px" />
          <View className="flex-1 h-16 bg-gray-200 rounded-r-xl -ml-px" />
        </View>
      </View>

      {/* Description skeleton */}
      <View className="px-6 py-4 mt-2">
        <View className="h-5 bg-gray-200 rounded w-16 mb-3" />
        <View className="h-4 bg-gray-200 rounded w-full mb-2" />
        <View className="h-4 bg-gray-200 rounded w-full mb-2" />
        <View className="h-4 bg-gray-200 rounded w-3/4" />
      </View>

      {/* Offers skeleton */}
      <View className="px-6 py-4 mt-2">
        <View className="h-5 bg-gray-200 rounded w-32 mb-4" />
        <View className="h-20 bg-gray-200 rounded-xl mb-3" />
        <View className="h-20 bg-gray-200 rounded-xl" />
      </View>
    </View>
  );
}

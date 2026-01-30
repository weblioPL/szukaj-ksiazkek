import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';
import { Book } from '../lib/api';

interface BookCardProps {
  book: Book;
  variant?: 'grid' | 'list';
}

export function BookCard({ book, variant = 'grid' }: BookCardProps) {
  const authorsText = book.authors.map((a) => a.name).join(', ');
  const rating = book.avgRating.toFixed(1);

  if (variant === 'list') {
    return (
      <Link href={`/book/${book.id}`} asChild>
        <TouchableOpacity className="flex-row bg-white p-3 rounded-xl mb-3 border border-gray-100">
          {/* Cover */}
          <View className="w-20 h-28 bg-gray-100 rounded-lg overflow-hidden">
            {book.coverUrl ? (
              <Image
                source={{ uri: book.coverUrl }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-full items-center justify-center bg-gray-200">
                <Text className="text-3xl">📖</Text>
              </View>
            )}
          </View>

          {/* Info */}
          <View className="flex-1 ml-3 justify-center">
            <Text className="text-base font-semibold text-gray-900" numberOfLines={2}>
              {book.title}
            </Text>
            <Text className="text-sm text-gray-500 mt-1" numberOfLines={1}>
              {authorsText}
            </Text>

            {/* Rating & Formats */}
            <View className="flex-row items-center mt-2">
              <Text className="text-yellow-500">★</Text>
              <Text className="text-sm text-gray-700 ml-1">
                {rating} ({book.ratingsCount})
              </Text>

              <View className="flex-row ml-3">
                {book.formats.paper && (
                  <Text className="text-xs bg-gray-100 px-2 py-0.5 rounded mr-1">📚</Text>
                )}
                {book.formats.ebook && (
                  <Text className="text-xs bg-gray-100 px-2 py-0.5 rounded mr-1">📱</Text>
                )}
                {book.formats.audiobook && (
                  <Text className="text-xs bg-gray-100 px-2 py-0.5 rounded">🎧</Text>
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Link>
    );
  }

  // Grid variant
  return (
    <Link href={`/book/${book.id}`} asChild>
      <TouchableOpacity className="w-[48%] mb-4">
        {/* Cover */}
        <View className="aspect-[2/3] bg-gray-100 rounded-xl overflow-hidden shadow-sm">
          {book.coverUrl ? (
            <Image
              source={{ uri: book.coverUrl }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full items-center justify-center bg-gray-200">
              <Text className="text-5xl">📖</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View className="mt-2 px-1">
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
        </View>
      </TouchableOpacity>
    </Link>
  );
}

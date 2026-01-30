import { View, Text, Image, TouchableOpacity, Linking } from 'react-native';
import { Offer } from '../lib/api';

interface OfferCardProps {
  offer: Offer;
}

const formatLabels: Record<string, string> = {
  paper: 'Papierowa',
  ebook: 'E-book',
  audiobook: 'Audiobook',
};

const formatIcons: Record<string, string> = {
  paper: '📚',
  ebook: '📱',
  audiobook: '🎧',
};

export function OfferCard({ offer }: OfferCardProps) {
  const handlePress = () => {
    Linking.openURL(offer.url);
  };

  const discount = offer.originalPrice
    ? Math.round(((offer.originalPrice - offer.price) / offer.originalPrice) * 100)
    : null;

  return (
    <TouchableOpacity
      className="bg-white rounded-xl p-4 mb-3 border border-gray-100 flex-row items-center"
      onPress={handlePress}
    >
      {/* Store logo */}
      <View className="w-12 h-12 rounded-lg bg-gray-100 items-center justify-center mr-3">
        {offer.storeLogoUrl ? (
          <Image
            source={{ uri: offer.storeLogoUrl }}
            className="w-10 h-10"
            resizeMode="contain"
          />
        ) : (
          <Text className="text-xl">🏪</Text>
        )}
      </View>

      {/* Store info */}
      <View className="flex-1">
        <Text className="text-sm font-medium text-gray-900">{offer.storeName}</Text>
        <View className="flex-row items-center mt-1">
          <Text className="text-xs text-gray-500">
            {formatIcons[offer.format]} {formatLabels[offer.format]}
          </Text>
          {!offer.isAvailable && (
            <Text className="text-xs text-red-500 ml-2">Niedostępny</Text>
          )}
        </View>
      </View>

      {/* Price */}
      <View className="items-end">
        <View className="flex-row items-baseline">
          <Text className="text-lg font-bold text-primary-600">
            {offer.price.toFixed(2)}
          </Text>
          <Text className="text-sm text-gray-500 ml-0.5">{offer.currency}</Text>
        </View>
        {discount && (
          <View className="flex-row items-center">
            <Text className="text-xs text-gray-400 line-through mr-1">
              {offer.originalPrice?.toFixed(2)}
            </Text>
            <Text className="text-xs text-green-600 font-medium">-{discount}%</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

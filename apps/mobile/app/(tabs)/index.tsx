import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Link } from 'expo-router';
import { useState, useCallback } from 'react';
import { useAuthStore } from '../../src/stores/auth';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // TODO: Refresh data
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Welcome section */}
      <View className="bg-primary-600 px-6 py-8">
        <Text className="text-white text-lg">Witaj,</Text>
        <Text className="text-white text-2xl font-bold">
          {user?.name || 'Czytelniku'}!
        </Text>
        <Text className="text-primary-100 mt-2">
          Co dzisiaj chcesz przeczytać?
        </Text>
      </View>

      {/* Quick actions */}
      <View className="px-6 py-6">
        <Text className="text-lg font-semibold text-gray-900 mb-4">
          Szybkie akcje
        </Text>
        <View className="flex-row flex-wrap gap-4">
          <Link href="/(tabs)/search" asChild>
            <TouchableOpacity className="bg-white rounded-xl p-4 flex-1 min-w-[140px] shadow-sm">
              <Text className="text-3xl mb-2">🔍</Text>
              <Text className="font-medium text-gray-900">Szukaj książek</Text>
              <Text className="text-gray-500 text-sm">
                Przeglądaj katalog
              </Text>
            </TouchableOpacity>
          </Link>

          <Link href="/(tabs)/chat" asChild>
            <TouchableOpacity className="bg-white rounded-xl p-4 flex-1 min-w-[140px] shadow-sm">
              <Text className="text-3xl mb-2">💬</Text>
              <Text className="font-medium text-gray-900">Zapytaj AI</Text>
              <Text className="text-gray-500 text-sm">
                Polecenia dla Ciebie
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      {/* Categories */}
      <View className="px-6 py-6">
        <Text className="text-lg font-semibold text-gray-900 mb-4">
          Kategorie
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-3">
            {[
              { name: 'Biznes', emoji: '💼' },
              { name: 'Rozwój osobisty', emoji: '🌱' },
              { name: 'Literatura', emoji: '📖' },
              { name: 'Kryminał', emoji: '🔎' },
              { name: 'Sci-Fi', emoji: '🚀' },
              { name: 'Historia', emoji: '🏛️' },
            ].map((category) => (
              <TouchableOpacity
                key={category.name}
                className="bg-white rounded-xl px-4 py-3 items-center min-w-[90px] shadow-sm"
              >
                <Text className="text-2xl mb-1">{category.emoji}</Text>
                <Text className="text-gray-700 text-sm">{category.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Placeholder for recommendations */}
      <View className="px-6 py-6">
        <Text className="text-lg font-semibold text-gray-900 mb-4">
          Polecane dla Ciebie
        </Text>
        <View className="bg-white rounded-xl p-6 items-center shadow-sm">
          <Text className="text-5xl mb-4">📚</Text>
          <Text className="text-gray-900 font-medium text-center">
            Dodaj książki do swojej półki
          </Text>
          <Text className="text-gray-500 text-center mt-2">
            Im więcej książek ocenisz, tym lepsze będą nasze rekomendacje
          </Text>
          <Link href="/(tabs)/search" asChild>
            <TouchableOpacity className="bg-primary-600 rounded-lg px-6 py-3 mt-4">
              <Text className="text-white font-medium">Przeglądaj książki</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}

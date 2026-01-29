import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';

type ReadingStatus = 'want_to_read' | 'reading' | 'read';

const statusLabels: Record<ReadingStatus, string> = {
  want_to_read: 'Chcę przeczytać',
  reading: 'Czytam',
  read: 'Przeczytane',
};

const statusEmojis: Record<ReadingStatus, string> = {
  want_to_read: '📚',
  reading: '📖',
  read: '✅',
};

export default function BookshelfScreen() {
  const [activeTab, setActiveTab] = useState<ReadingStatus>('reading');

  // Placeholder for actual API call
  const { data, isLoading } = useQuery({
    queryKey: ['user-books', activeTab],
    queryFn: async () => {
      // TODO: Implement actual API call
      return { data: [] };
    },
  });

  const tabs: ReadingStatus[] = ['reading', 'want_to_read', 'read'];

  return (
    <View className="flex-1 bg-gray-50">
      {/* Tabs */}
      <View className="bg-white border-b border-gray-200">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row px-4 py-3">
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab}
                className={`px-4 py-2 mr-2 rounded-full ${
                  activeTab === tab ? 'bg-primary-600' : 'bg-gray-100'
                }`}
                onPress={() => setActiveTab(tab)}
              >
                <Text
                  className={activeTab === tab ? 'text-white' : 'text-gray-700'}
                >
                  {statusEmojis[tab]} {statusLabels[tab]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView className="flex-1">
        {isLoading ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color="#0ea5e9" />
          </View>
        ) : data?.data && data.data.length > 0 ? (
          <View className="p-4">
            {/* Book items would go here */}
          </View>
        ) : (
          <View className="py-12 items-center px-6">
            <Text className="text-6xl mb-4">{statusEmojis[activeTab]}</Text>
            <Text className="text-xl font-semibold text-gray-900 text-center">
              {activeTab === 'reading' && 'Nie czytasz żadnej książki'}
              {activeTab === 'want_to_read' && 'Lista jest pusta'}
              {activeTab === 'read' && 'Jeszcze nic nie przeczytałeś'}
            </Text>
            <Text className="text-gray-500 text-center mt-2">
              {activeTab === 'reading' &&
                'Dodaj książkę, którą właśnie czytasz'}
              {activeTab === 'want_to_read' &&
                'Dodaj książki, które chcesz przeczytać'}
              {activeTab === 'read' && 'Oznacz przeczytane książki'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

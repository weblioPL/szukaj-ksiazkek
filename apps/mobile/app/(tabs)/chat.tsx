import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useConversations } from '@hooks/useApi';
import { Conversation } from '@lib/api';
import {
  ConversationRow,
  ConversationsSkeleton,
  EmptyConversations,
  ChatErrorState,
} from '@components/ChatComponents';

// ============================================
// Main Conversations List Screen
// ============================================

export default function ChatScreen() {
  const router = useRouter();

  // Fetch conversations
  const {
    data: conversationsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useConversations();

  // Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Navigate to conversation
  const handleConversationPress = useCallback(
    (conversationId: string) => {
      router.push(`/chat/${conversationId}`);
    },
    [router]
  );

  // Start new conversation
  const handleNewChat = useCallback(() => {
    router.push('/chat/new');
  }, [router]);

  // Render conversation item
  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <ConversationRow
        conversation={item}
        onPress={() => handleConversationPress(item.id)}
      />
    ),
    [handleConversationPress]
  );

  // Key extractor
  const keyExtractor = useCallback((item: Conversation) => item.id, []);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white pt-12 pb-3 px-4 border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-gray-900">💬 Czat</Text>
          <TouchableOpacity
            className="bg-primary-600 px-4 py-2 rounded-lg"
            onPress={handleNewChat}
          >
            <Text className="text-white font-medium">+ Nowa rozmowa</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {isLoading && !refreshing ? (
        <ConversationsSkeleton />
      ) : isError ? (
        <ChatErrorState
          message={error?.message || 'Nie udało się załadować rozmów'}
          onRetry={() => refetch()}
        />
      ) : !conversationsData?.data || conversationsData.data.length === 0 ? (
        <EmptyConversations onNewChat={handleNewChat} />
      ) : (
        <FlatList
          data={conversationsData.data}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#0ea5e9']}
              tintColor="#0ea5e9"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useConversation } from '@hooks/useApi';
import { api, ChatMessage } from '@lib/api';
import { streamChatMessage } from '@lib/sse';
import {
  MessageList,
  ChatComposer,
  TypingIndicator,
  ChatErrorState,
} from '@components/ChatComponents';
import { queryKeys } from '@hooks/useApi';

// ============================================
// Conversation Detail Screen
// ============================================

export default function ConversationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Local state for messages (combines fetched + optimistic)
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | undefined>();

  // Abort controller ref for cancelling streams
  const abortStreamRef = useRef<(() => void) | null>(null);

  // Fetch conversation data
  const {
    data: conversation,
    isLoading,
    isError,
    error,
    refetch,
  } = useConversation(id!);

  // Sync fetched messages to local state
  useEffect(() => {
    if (conversation?.messages) {
      setLocalMessages(conversation.messages);
    }
  }, [conversation?.messages]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (abortStreamRef.current) {
        abortStreamRef.current();
      }
    };
  }, []);

  // Handle sending message with streaming
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isStreaming || !id) return;

    const content = inputText.trim();
    setInputText('');

    // Add optimistic user message
    const userMessageId = `user-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      conversationId: id,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    setLocalMessages((prev) => [...prev, userMessage]);

    // Add placeholder assistant message
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      conversationId: id,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };

    setLocalMessages((prev) => [...prev, assistantMessage]);
    setIsStreaming(true);
    setStreamingMessageId(assistantMessageId);

    // Get auth token and base URL
    const token = api.chat.getAuthToken();
    const baseUrl = api.chat.getBaseUrl();

    // Start streaming
    abortStreamRef.current = streamChatMessage({
      conversationId: id,
      content,
      baseUrl,
      token,
      onToken: (token) => {
        setLocalMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: msg.content + token }
              : msg
          )
        );
      },
      onComplete: (fullMessage, messageId) => {
        setIsStreaming(false);
        setStreamingMessageId(undefined);
        abortStreamRef.current = null;

        // Update message with final ID if provided
        if (messageId) {
          setLocalMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, id: messageId } : msg
            )
          );
        }

        // Invalidate conversations list to update last message
        queryClient.invalidateQueries({ queryKey: queryKeys.chat.list });
      },
      onError: (err) => {
        setIsStreaming(false);
        setStreamingMessageId(undefined);
        abortStreamRef.current = null;

        // Remove the empty assistant message on error
        setLocalMessages((prev) =>
          prev.filter((msg) => msg.id !== assistantMessageId)
        );

        Alert.alert(
          'Błąd',
          err.message || 'Nie udało się wysłać wiadomości. Spróbuj ponownie.',
          [{ text: 'OK' }]
        );
      },
    });
  }, [inputText, isStreaming, id, queryClient]);

  // Handle stop streaming
  const handleStopStreaming = useCallback(() => {
    if (abortStreamRef.current) {
      abortStreamRef.current();
      abortStreamRef.current = null;
      setIsStreaming(false);
      setStreamingMessageId(undefined);
    }
  }, []);

  // Handle back navigation
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // Loading skeleton
  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Rozmowa',
            headerLeft: () => (
              <TouchableOpacity onPress={handleBack} className="mr-4">
                <Text className="text-primary-600 text-lg">← Wróć</Text>
              </TouchableOpacity>
            ),
          }}
        />
        <View className="flex-1 bg-gray-50 items-center justify-center">
          <Text className="text-gray-500">Ładowanie rozmowy...</Text>
        </View>
      </>
    );
  }

  // Error state
  if (isError) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Błąd',
            headerLeft: () => (
              <TouchableOpacity onPress={handleBack} className="mr-4">
                <Text className="text-primary-600 text-lg">← Wróć</Text>
              </TouchableOpacity>
            ),
          }}
        />
        <ChatErrorState
          message={error?.message || 'Nie udało się załadować rozmowy'}
          onRetry={() => refetch()}
        />
      </>
    );
  }

  const conversationTitle = conversation?.title || 'Rozmowa';

  return (
    <>
      <Stack.Screen
        options={{
          title: conversationTitle,
          headerBackTitle: 'Czat',
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-gray-50"
        keyboardVerticalOffset={90}
      >
        {/* Messages */}
        <MessageList messages={localMessages} streamingMessageId={streamingMessageId}>
          {isStreaming && !localMessages.find((m) => m.id === streamingMessageId)?.content && (
            <TypingIndicator />
          )}
        </MessageList>

        {/* Composer */}
        <ChatComposer
          value={inputText}
          onChangeText={setInputText}
          onSend={handleSend}
          onStop={handleStopStreaming}
          isLoading={false}
          isStreaming={isStreaming}
        />
      </KeyboardAvoidingView>
    </>
  );
}

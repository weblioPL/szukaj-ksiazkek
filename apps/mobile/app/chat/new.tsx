import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api, ChatMessage } from '@lib/api';
import { streamChatMessage } from '@lib/sse';
import {
  MessageList,
  ChatComposer,
  TypingIndicator,
  ChatWelcome,
} from '@components/ChatComponents';
import { queryKeys } from '@hooks/useApi';

// ============================================
// New Conversation Screen
// ============================================

export default function NewConversationScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Local state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | undefined>();
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Abort controller ref for cancelling streams
  const abortStreamRef = useRef<(() => void) | null>(null);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (abortStreamRef.current) {
        abortStreamRef.current();
      }
    };
  }, []);

  // Handle suggested prompt selection
  const handlePromptSelect = useCallback((prompt: string) => {
    setInputText(prompt);
  }, []);

  // Handle sending first message (creates conversation)
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isLoading || isStreaming) return;

    const content = inputText.trim();
    setInputText('');
    setIsLoading(true);

    // Add optimistic user message
    const userMessageId = `user-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      conversationId: '',
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      // Create new conversation
      const response = await api.chat.create(content);
      const newConversationId = response.conversationId;
      setConversationId(newConversationId);

      // Update user message with real conversation ID
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === userMessageId ? { ...msg, conversationId: newConversationId } : msg
        )
      );

      // Add placeholder assistant message
      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        conversationId: newConversationId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
      setIsStreaming(true);
      setStreamingMessageId(assistantMessageId);

      // Get auth token and base URL
      const token = api.chat.getAuthToken();
      const baseUrl = api.chat.getBaseUrl();

      // Start streaming for follow-up (if backend returns streaming response from create)
      // For now, we'll use the initial message response
      if (response.message) {
        // Backend returned non-streaming response
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, id: response.message.id, content: response.message.content }
              : msg
          )
        );
        setIsStreaming(false);
        setStreamingMessageId(undefined);

        // Navigate to the conversation
        queryClient.invalidateQueries({ queryKey: queryKeys.chat.list });
        router.replace(`/chat/${newConversationId}`);
      }
    } catch (err) {
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingMessageId(undefined);

      // Remove the user message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== userMessageId));

      Alert.alert(
        'Błąd',
        err instanceof Error
          ? err.message
          : 'Nie udało się utworzyć rozmowy. Spróbuj ponownie.',
        [{ text: 'OK' }]
      );
    }
  }, [inputText, isLoading, isStreaming, router, queryClient]);

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

  const hasMessages = messages.length > 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Nowa rozmowa',
          headerBackTitle: 'Czat',
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-gray-50"
        keyboardVerticalOffset={90}
      >
        {/* Content */}
        {hasMessages ? (
          <MessageList messages={messages} streamingMessageId={streamingMessageId}>
            {(isLoading || (isStreaming && !messages.find((m) => m.id === streamingMessageId)?.content)) && (
              <TypingIndicator />
            )}
          </MessageList>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <ChatWelcome onPromptSelect={handlePromptSelect} />
          </ScrollView>
        )}

        {/* Composer */}
        <ChatComposer
          value={inputText}
          onChangeText={setInputText}
          onSend={handleSend}
          onStop={handleStopStreaming}
          isLoading={isLoading}
          isStreaming={isStreaming}
          placeholder="Napisz wiadomość, aby rozpocząć..."
        />
      </KeyboardAvoidingView>
    </>
  );
}

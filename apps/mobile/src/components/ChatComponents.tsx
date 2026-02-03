/**
 * Reusable components for Chat screens
 */
import { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Link } from 'expo-router';
import { ChatMessage, Conversation, Book } from '@lib/api';
import { timeAgoPl, parseBookIdsFromText, cleanBookIdsFromText } from '@lib/sse';
import { useBook } from '@hooks/useApi';

// ============================================
// Typing Indicator Component
// ============================================

export function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animation = Animated.parallel([
      animate(dot1, 0),
      animate(dot2, 150),
      animate(dot3, 300),
    ]);

    animation.start();

    return () => animation.stop();
  }, [dot1, dot2, dot3]);

  const dotStyle = (dot: Animated.Value) => ({
    opacity: dot.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    }),
    transform: [
      {
        scale: dot.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1.2],
        }),
      },
    ],
  });

  return (
    <View className="self-start mb-4">
      <View className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex-row items-center">
        <Text className="text-gray-500 mr-2">🤖</Text>
        <View className="flex-row items-center space-x-1">
          <Animated.View
            style={dotStyle(dot1)}
            className="w-2 h-2 bg-primary-500 rounded-full mx-0.5"
          />
          <Animated.View
            style={dotStyle(dot2)}
            className="w-2 h-2 bg-primary-500 rounded-full mx-0.5"
          />
          <Animated.View
            style={dotStyle(dot3)}
            className="w-2 h-2 bg-primary-500 rounded-full mx-0.5"
          />
        </View>
      </View>
    </View>
  );
}

// ============================================
// Book Card in Chat Component
// ============================================

interface BookCardInChatProps {
  bookId: string;
}

export function BookCardInChat({ bookId }: BookCardInChatProps) {
  const { data: book, isLoading } = useBook(bookId);

  if (isLoading) {
    return (
      <View className="bg-gray-100 rounded-lg p-3 my-2">
        <View className="flex-row">
          <View className="w-12 h-16 bg-gray-200 rounded animate-pulse" />
          <View className="ml-3 flex-1">
            <View className="w-3/4 h-4 bg-gray-200 rounded mb-2 animate-pulse" />
            <View className="w-1/2 h-3 bg-gray-200 rounded animate-pulse" />
          </View>
        </View>
      </View>
    );
  }

  if (!book) return null;

  const authorsText = book.authors?.map((a) => a.name).join(', ') || 'Autor nieznany';

  return (
    <Link href={`/book/${bookId}`} asChild>
      <TouchableOpacity className="bg-primary-50 border border-primary-100 rounded-lg p-3 my-2">
        <View className="flex-row">
          {book.coverUrl ? (
            <Image
              source={{ uri: book.coverUrl }}
              className="w-12 h-16 rounded"
              resizeMode="cover"
            />
          ) : (
            <View className="w-12 h-16 bg-gray-200 rounded items-center justify-center">
              <Text>📕</Text>
            </View>
          )}
          <View className="ml-3 flex-1 justify-center">
            <Text className="text-sm font-semibold text-gray-900" numberOfLines={2}>
              {book.title}
            </Text>
            <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
              {authorsText}
            </Text>
            <Text className="text-xs text-primary-600 mt-1">Zobacz książkę →</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

// ============================================
// Chat Bubble Component
// ============================================

interface ChatBubbleProps {
  message: ChatMessage | { id: string; role: 'user' | 'assistant'; content: string };
  isStreaming?: boolean;
}

export function ChatBubble({ message, isStreaming }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const bookIds = parseBookIdsFromText(message.content);
  const cleanContent = cleanBookIdsFromText(message.content);

  return (
    <View className={`mb-4 max-w-[85%] ${isUser ? 'self-end' : 'self-start'}`}>
      <View
        className={`rounded-2xl px-4 py-3 ${
          isUser ? 'bg-primary-600' : 'bg-white border border-gray-200'
        }`}
      >
        <Text className={isUser ? 'text-white' : 'text-gray-900'}>
          {cleanContent}
          {isStreaming && <Text className="text-primary-400">▋</Text>}
        </Text>
      </View>

      {/* Render book cards for assistant messages */}
      {!isUser && bookIds.length > 0 && (
        <View className="mt-2">
          {bookIds.map((bookId) => (
            <BookCardInChat key={bookId} bookId={bookId} />
          ))}
        </View>
      )}
    </View>
  );
}

// ============================================
// Chat Composer Component
// ============================================

interface ChatComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onStop?: () => void;
  isLoading: boolean;
  isStreaming?: boolean;
  placeholder?: string;
}

export function ChatComposer({
  value,
  onChangeText,
  onSend,
  onStop,
  isLoading,
  isStreaming,
  placeholder = 'Napisz wiadomość...',
}: ChatComposerProps) {
  const canSend = value.trim() && !isLoading && !isStreaming;

  return (
    <View className="bg-white border-t border-gray-200 px-4 py-3">
      <View className="flex-row items-end">
        <TextInput
          className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-base max-h-24"
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          multiline
          editable={!isLoading && !isStreaming}
        />

        {isStreaming && onStop ? (
          <TouchableOpacity
            onPress={onStop}
            className="ml-2 w-12 h-12 rounded-full items-center justify-center bg-red-500"
          >
            <Text className="text-white text-lg">⏹</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onSend}
            disabled={!canSend}
            className={`ml-2 w-12 h-12 rounded-full items-center justify-center ${
              canSend ? 'bg-primary-600' : 'bg-gray-200'
            }`}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-xl">{canSend ? '➤' : '➤'}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ============================================
// Conversation Row Component
// ============================================

interface ConversationRowProps {
  conversation: Conversation;
  onPress: () => void;
}

export function ConversationRow({ conversation, onPress }: ConversationRowProps) {
  const { title, lastMessage, updatedAt, messageCount } = conversation;
  const displayTitle = title || 'Rozmowa';
  const timeAgo = timeAgoPl(updatedAt);

  return (
    <TouchableOpacity
      className="bg-white px-4 py-4 border-b border-gray-100 flex-row items-center"
      onPress={onPress}
    >
      {/* Avatar */}
      <View className="w-12 h-12 bg-primary-100 rounded-full items-center justify-center mr-3">
        <Text className="text-xl">💬</Text>
      </View>

      {/* Content */}
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
            {displayTitle}
          </Text>
          <Text className="text-xs text-gray-400">{timeAgo}</Text>
        </View>
        {lastMessage && (
          <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={2}>
            {lastMessage}
          </Text>
        )}
        <Text className="text-xs text-gray-400 mt-1">
          {messageCount} {messageCount === 1 ? 'wiadomość' : messageCount < 5 ? 'wiadomości' : 'wiadomości'}
        </Text>
      </View>

      {/* Arrow */}
      <Text className="text-gray-400 text-lg ml-2">›</Text>
    </TouchableOpacity>
  );
}

// ============================================
// Message List Component (with auto-scroll)
// ============================================

interface MessageListProps {
  messages: Array<ChatMessage | { id: string; role: 'user' | 'assistant'; content: string }>;
  streamingMessageId?: string;
  children?: React.ReactNode;
}

export function MessageList({ messages, streamingMessageId, children }: MessageListProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, messages[messages.length - 1]?.content]);

  return (
    <ScrollView
      ref={scrollViewRef}
      className="flex-1"
      contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 16 }}
      onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      showsVerticalScrollIndicator={false}
    >
      {messages.map((message) => (
        <ChatBubble
          key={message.id}
          message={message}
          isStreaming={message.id === streamingMessageId}
        />
      ))}
      {children}
    </ScrollView>
  );
}

// ============================================
// Conversations Skeleton Component
// ============================================

export function ConversationsSkeleton() {
  return (
    <View>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} className="bg-white px-4 py-4 border-b border-gray-100 flex-row items-center">
          <View className="w-12 h-12 bg-gray-200 rounded-full mr-3 animate-pulse" />
          <View className="flex-1">
            <View className="flex-row justify-between mb-2">
              <View className="w-32 h-4 bg-gray-200 rounded animate-pulse" />
              <View className="w-16 h-3 bg-gray-200 rounded animate-pulse" />
            </View>
            <View className="w-full h-3 bg-gray-200 rounded mb-1 animate-pulse" />
            <View className="w-2/3 h-3 bg-gray-200 rounded animate-pulse" />
          </View>
        </View>
      ))}
    </View>
  );
}

// ============================================
// Empty State Component
// ============================================

interface EmptyConversationsProps {
  onNewChat: () => void;
}

export function EmptyConversations({ onNewChat }: EmptyConversationsProps) {
  return (
    <View className="flex-1 items-center justify-center py-16 px-6">
      <Text className="text-6xl mb-4">💬</Text>
      <Text className="text-xl font-semibold text-gray-900 text-center">
        Nie masz jeszcze rozmów
      </Text>
      <Text className="text-gray-500 text-center mt-2 mb-6">
        Zacznij nową rozmowę z asystentem książkowym. Pomoże Ci znaleźć idealne książki!
      </Text>
      <TouchableOpacity className="bg-primary-600 px-6 py-3 rounded-lg" onPress={onNewChat}>
        <Text className="text-white font-medium">✨ Nowa rozmowa</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================
// Error State Component
// ============================================

interface ChatErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ChatErrorState({ message, onRetry }: ChatErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-16 px-6">
      <Text className="text-6xl mb-4">😕</Text>
      <Text className="text-xl font-semibold text-gray-900 text-center">
        Coś poszło nie tak
      </Text>
      <Text className="text-gray-500 text-center mt-2 mb-6">{message}</Text>
      <TouchableOpacity className="bg-primary-600 px-6 py-3 rounded-lg" onPress={onRetry}>
        <Text className="text-white font-medium">🔄 Spróbuj ponownie</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================
// Welcome Screen Component (for new conversations)
// ============================================

interface ChatWelcomeProps {
  onPromptSelect: (prompt: string) => void;
}

export function ChatWelcome({ onPromptSelect }: ChatWelcomeProps) {
  const suggestedPrompts = [
    'Polecasz książki o inwestowaniu dla początkujących?',
    'Szukam dobrego thrillera psychologicznego',
    'Jakie książki o historii Polski polecasz?',
    'Potrzebuję książki do nauki programowania',
  ];

  return (
    <View className="flex-1 items-center justify-center px-6 py-8">
      <Text className="text-6xl mb-6">🤖📚</Text>
      <Text className="text-xl font-semibold text-gray-900 text-center">
        Witaj! Jestem Twoim asystentem książkowym
      </Text>
      <Text className="text-gray-500 text-center mt-4">
        Pomogę Ci znaleźć idealne książki. Opowiedz mi o swoich zainteresowaniach lub zapytaj o
        konkretny gatunek.
      </Text>

      <View className="mt-8 w-full">
        <Text className="text-gray-700 font-medium mb-3">Przykładowe pytania:</Text>
        {suggestedPrompts.map((prompt) => (
          <TouchableOpacity
            key={prompt}
            className="bg-white rounded-lg p-4 mb-2 border border-gray-200"
            onPress={() => onPromptSelect(prompt)}
          >
            <Text className="text-gray-700">{prompt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

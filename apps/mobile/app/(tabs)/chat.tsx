import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const queryClient = useQueryClient();

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!conversationId) {
        // Start new conversation
        const response = await api.chat.create(content);
        return response;
      } else {
        // Continue conversation
        const response = await api.chat.sendMessage(conversationId, content);
        return { conversationId, message: response };
      }
    },
    onSuccess: (data) => {
      if (!conversationId) {
        setConversationId(data.conversationId);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: data.message.id,
          role: 'assistant',
          content: data.message.content,
        },
      ]);
    },
  });

  const handleSend = () => {
    if (!inputText.trim() || sendMessageMutation.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    sendMessageMutation.mutate(inputText.trim());
    setInputText('');
  };

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-50"
      keyboardVerticalOffset={90}
    >
      {/* Header with new chat button */}
      {messages.length > 0 && (
        <View className="bg-white px-4 py-2 border-b border-gray-200 flex-row justify-end">
          <TouchableOpacity
            onPress={handleNewChat}
            className="px-4 py-2 bg-gray-100 rounded-lg"
          >
            <Text className="text-gray-700">Nowa rozmowa</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerStyle={{ paddingVertical: 16 }}
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({ animated: true })
        }
      >
        {messages.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6 py-12">
            <Text className="text-6xl mb-6">🤖📚</Text>
            <Text className="text-xl font-semibold text-gray-900 text-center">
              Witaj! Jestem Twoim asystentem książkowym
            </Text>
            <Text className="text-gray-500 text-center mt-4">
              Pomogę Ci znaleźć idealne książki. Opowiedz mi o swoich
              zainteresowaniach lub zapytaj o konkretny gatunek.
            </Text>

            {/* Suggested prompts */}
            <View className="mt-8 w-full">
              <Text className="text-gray-700 font-medium mb-3">
                Przykładowe pytania:
              </Text>
              {[
                'Polecasz książki o inwestowaniu dla początkujących?',
                'Szukam dobrego thrillera psychologicznego',
                'Jakie książki o historii Polski polecasz?',
              ].map((prompt) => (
                <TouchableOpacity
                  key={prompt}
                  className="bg-white rounded-lg p-4 mb-2 border border-gray-200"
                  onPress={() => {
                    setInputText(prompt);
                  }}
                >
                  <Text className="text-gray-700">{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View className="px-4">
            {messages.map((message) => (
              <View
                key={message.id}
                className={`mb-4 max-w-[85%] ${
                  message.role === 'user' ? 'self-end' : 'self-start'
                }`}
              >
                <View
                  className={`rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-primary-600'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  <Text
                    className={
                      message.role === 'user' ? 'text-white' : 'text-gray-900'
                    }
                  >
                    {message.content}
                  </Text>
                </View>
              </View>
            ))}

            {sendMessageMutation.isPending && (
              <View className="self-start mb-4">
                <View className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                  <ActivityIndicator size="small" color="#0ea5e9" />
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View className="bg-white border-t border-gray-200 px-4 py-3">
        <View className="flex-row items-end">
          <TextInput
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-base max-h-24"
            placeholder="Napisz wiadomość..."
            value={inputText}
            onChangeText={setInputText}
            multiline
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || sendMessageMutation.isPending}
            className={`ml-2 w-12 h-12 rounded-full items-center justify-center ${
              inputText.trim() && !sendMessageMutation.isPending
                ? 'bg-primary-600'
                : 'bg-gray-200'
            }`}
          >
            <Text className="text-xl">
              {sendMessageMutation.isPending ? '⏳' : '➤'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

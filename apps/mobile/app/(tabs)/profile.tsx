import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/stores/auth';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Wylogowanie',
      'Czy na pewno chcesz się wylogować?',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Wyloguj',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Profile header */}
      <View className="bg-white px-6 py-8 items-center border-b border-gray-200">
        <View className="w-24 h-24 bg-primary-100 rounded-full items-center justify-center mb-4">
          <Text className="text-4xl">👤</Text>
        </View>
        <Text className="text-xl font-semibold text-gray-900">
          {user?.name || 'Użytkownik'}
        </Text>
        <Text className="text-gray-500 mt-1">{user?.email}</Text>
      </View>

      {/* Stats */}
      <View className="bg-white mt-4 px-6 py-4">
        <Text className="text-lg font-semibold text-gray-900 mb-4">
          Statystyki
        </Text>
        <View className="flex-row justify-around">
          <View className="items-center">
            <Text className="text-2xl font-bold text-primary-600">0</Text>
            <Text className="text-gray-500 text-sm">Przeczytane</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-primary-600">0</Text>
            <Text className="text-gray-500 text-sm">Ocenione</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-primary-600">0</Text>
            <Text className="text-gray-500 text-sm">Rozmowy AI</Text>
          </View>
        </View>
      </View>

      {/* Menu items */}
      <View className="bg-white mt-4">
        <TouchableOpacity className="px-6 py-4 flex-row items-center border-b border-gray-100">
          <Text className="text-xl mr-4">⚙️</Text>
          <Text className="flex-1 text-gray-900">Ustawienia</Text>
          <Text className="text-gray-400">›</Text>
        </TouchableOpacity>

        <TouchableOpacity className="px-6 py-4 flex-row items-center border-b border-gray-100">
          <Text className="text-xl mr-4">📊</Text>
          <Text className="flex-1 text-gray-900">Historia zakupów</Text>
          <Text className="text-gray-400">›</Text>
        </TouchableOpacity>

        <TouchableOpacity className="px-6 py-4 flex-row items-center border-b border-gray-100">
          <Text className="text-xl mr-4">🎯</Text>
          <Text className="flex-1 text-gray-900">Preferencje</Text>
          <Text className="text-gray-400">›</Text>
        </TouchableOpacity>

        <TouchableOpacity className="px-6 py-4 flex-row items-center border-b border-gray-100">
          <Text className="text-xl mr-4">❓</Text>
          <Text className="flex-1 text-gray-900">Pomoc</Text>
          <Text className="text-gray-400">›</Text>
        </TouchableOpacity>

        <TouchableOpacity className="px-6 py-4 flex-row items-center">
          <Text className="text-xl mr-4">📜</Text>
          <Text className="flex-1 text-gray-900">Polityka prywatności</Text>
          <Text className="text-gray-400">›</Text>
        </TouchableOpacity>
      </View>

      {/* Logout button */}
      <View className="px-6 py-6">
        <TouchableOpacity
          className="bg-red-50 border border-red-200 rounded-xl py-4"
          onPress={handleLogout}
        >
          <Text className="text-red-600 text-center font-medium">
            Wyloguj się
          </Text>
        </TouchableOpacity>
      </View>

      {/* App version */}
      <View className="items-center pb-8">
        <Text className="text-gray-400 text-sm">Wersja 1.0.0</Text>
      </View>
    </ScrollView>
  );
}

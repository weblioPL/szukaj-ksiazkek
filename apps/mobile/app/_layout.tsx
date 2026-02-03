import { useEffect, useCallback } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Alert } from 'react-native';
import { useAuthStore } from '../src/stores/auth';

import '../global.css';

/**
 * Global error handler for API errors
 *
 * Handles:
 * - 401 Unauthorized: Logout user and redirect to login
 * - Network errors: Show user-friendly message
 * - Other errors: Log for debugging
 */
function createQueryClient(onAuthError: () => void) {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Handle session expired errors globally
        if (error.message === 'Session expired') {
          onAuthError();
          return;
        }

        // Log other errors for debugging
        console.error('Query error:', query.queryKey, error.message);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        // Handle session expired errors globally
        if (error.message === 'Session expired') {
          onAuthError();
          return;
        }

        // Log mutation errors
        console.error('Mutation error:', error.message);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: (failureCount, error) => {
          // Don't retry on auth errors
          if (error.message === 'Session expired') {
            return false;
          }
          return failureCount < 1;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export default function RootLayout() {
  const { initialize, isInitialized, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  // Handle auth errors globally
  const handleAuthError = useCallback(async () => {
    await logout();
    Alert.alert(
      'Sesja wygasła',
      'Twoja sesja wygasła. Zaloguj się ponownie.',
      [{ text: 'OK' }],
    );
    router.replace('/(auth)/login');
  }, [logout, router]);

  // Create query client with auth error handler
  const queryClient = createQueryClient(handleAuthError);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Handle navigation based on auth state
  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to home if authenticated and on auth screens
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isInitialized, segments, router]);

  if (!isInitialized) {
    return null; // Or a loading screen
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="book/[id]"
            options={{
              headerShown: true,
              title: 'Szczegóły książki',
              headerBackTitle: 'Wstecz',
            }}
          />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

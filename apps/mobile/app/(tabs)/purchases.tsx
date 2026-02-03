import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { usePurchases, useRefreshPurchases } from '@hooks/useApi';
import { Purchase } from '@lib/api';
import {
  PurchaseCard,
  DateGroupHeader,
  PurchasesSkeleton,
  PurchasesEmptyState,
  PurchasesErrorState,
} from '@components/PurchaseComponents';

// ============================================
// Types
// ============================================

interface PurchaseSection {
  date: string;
  data: Purchase[];
}

// ============================================
// Utility Functions
// ============================================

/**
 * Groups purchases by date (YYYY-MM-DD)
 */
function groupPurchasesByDate(purchases: Purchase[]): PurchaseSection[] {
  const groups: Record<string, Purchase[]> = {};

  purchases.forEach((purchase) => {
    // Extract date part only
    const dateKey = purchase.purchasedAt.split('T')[0];
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(purchase);
  });

  // Convert to sections array, sorted by date descending
  return Object.entries(groups)
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .map(([date, data]) => ({
      date,
      data,
    }));
}

/**
 * Formats the last sync time
 */
function formatSyncTime(isoString?: string): string {
  if (!isoString) return '';

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMinutes < 1) {
    return 'przed chwilą';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} min temu`;
  }
  if (diffHours < 24) {
    return `${diffHours} godz. temu`;
  }

  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================
// Header Component
// ============================================

interface HeaderProps {
  lastSyncAt?: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}

function Header({ lastSyncAt, isRefreshing, onRefresh }: HeaderProps) {
  return (
    <View className="bg-white px-4 pt-12 pb-4 border-b border-gray-200">
      {/* Title */}
      <Text className="text-2xl font-bold text-gray-900">🧾 Zakupy</Text>

      {/* Info line */}
      <View className="flex-row items-center mt-1">
        <Text className="text-sm text-gray-500">Dane z BUY.BOX</Text>
        {lastSyncAt && (
          <Text className="text-sm text-gray-400 ml-2">
            • Synchronizacja: {formatSyncTime(lastSyncAt)}
          </Text>
        )}
      </View>

      {/* Refresh button */}
      <TouchableOpacity
        className={`mt-3 flex-row items-center justify-center px-4 py-2.5 rounded-lg ${
          isRefreshing ? 'bg-primary-100' : 'bg-primary-600'
        }`}
        onPress={onRefresh}
        disabled={isRefreshing}
      >
        {isRefreshing ? (
          <>
            <ActivityIndicator size="small" color="#0ea5e9" />
            <Text className="text-primary-600 font-medium ml-2">Odświeżanie...</Text>
          </>
        ) : (
          <>
            <Text className="text-white font-medium">🔄 Odśwież</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ============================================
// Main Purchases Screen
// ============================================

export default function PurchasesScreen() {
  const [lastSyncAt, setLastSyncAt] = useState<string | undefined>();

  // Fetch purchases
  const {
    data: purchasesData,
    isLoading,
    isError,
    error,
    refetch,
  } = usePurchases();

  // Refresh mutation
  const refreshMutation = useRefreshPurchases();

  // Group purchases by date
  const sections = useMemo(() => {
    if (!purchasesData?.items) return [];
    return groupPurchasesByDate(purchasesData.items);
  }, [purchasesData?.items]);

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    try {
      const result = await refreshMutation.mutateAsync();
      setLastSyncAt(result.lastSyncAt);
      // Refetch list after sync
      await refetch();
    } catch (err) {
      console.error('Failed to refresh purchases:', err);
    }
  }, [refreshMutation, refetch]);

  // Handle pull-to-refresh
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const handlePullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      // First trigger sync, then refetch
      const result = await refreshMutation.mutateAsync();
      setLastSyncAt(result.lastSyncAt);
      await refetch();
    } catch (err) {
      // Still try to refetch even if sync fails
      await refetch();
    } finally {
      setPullRefreshing(false);
    }
  }, [refreshMutation, refetch]);

  // Render section header (date group)
  const renderSectionHeader = useCallback(
    ({ section }: { section: PurchaseSection }) => (
      <DateGroupHeader date={section.date} />
    ),
    []
  );

  // Render purchase item
  const renderItem = useCallback(
    ({ item }: { item: Purchase }) => <PurchaseCard purchase={item} />,
    []
  );

  // Key extractor
  const keyExtractor = useCallback((item: Purchase) => item.id, []);

  // Check if any refresh is in progress
  const isRefreshing = refreshMutation.isPending;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header with refresh button */}
      <Header
        lastSyncAt={lastSyncAt}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
      />

      {/* Content */}
      {isLoading && !pullRefreshing ? (
        <PurchasesSkeleton />
      ) : isError ? (
        <PurchasesErrorState
          message={error?.message || 'Wystąpił błąd podczas pobierania danych'}
          onRetry={() => refetch()}
        />
      ) : !purchasesData?.items || purchasesData.items.length === 0 ? (
        <PurchasesEmptyState />
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingBottom: 100 }}
          stickySectionHeadersEnabled={true}
          refreshControl={
            <RefreshControl
              refreshing={pullRefreshing}
              onRefresh={handlePullRefresh}
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

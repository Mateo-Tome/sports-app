// components/library/AllVideosList.tsx
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import type { LibraryRow } from './LibraryVideoRow';

type Props = {
  rows: LibraryRow[];
  renderItem: any;
  refreshing: boolean;
  onRefresh: () => void;
  tabBarHeight: number;
  onViewableItemsChanged: any;
  viewabilityConfig: any;
  onEndReached?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
};

export default function AllVideosList(props: Props) {
  const {
    rows,
    renderItem,
    refreshing,
    onRefresh,
    tabBarHeight,
    onViewableItemsChanged,
    viewabilityConfig,
    onEndReached,
    hasMore,
    loadingMore,
  } = props;

  const canLoadMore = !!onEndReached && !!hasMore && !loadingMore;

  return (
    <FlatList
      data={rows}
      keyExtractor={(it) => it.uri}
      renderItem={renderItem}
      contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#fff"
        />
      }
      ListEmptyComponent={
        <Text
          style={{
            color: 'white',
            opacity: 0.7,
            textAlign: 'center',
            marginTop: 40,
          }}
        >
          No recordings yet. Record a match, then come back.
        </Text>
      }
      ListFooterComponent={
        hasMore ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}>
            <Pressable
              disabled={!canLoadMore}
              onPress={onEndReached}
              style={{
                paddingVertical: 14,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: 'white',
                alignItems: 'center',
                opacity: canLoadMore ? 1 : 0.45,
              }}
            >
              <Text style={{ color: 'white', fontWeight: '900' }}>
                {loadingMore ? 'Loading more clips...' : 'Load more clips'}
              </Text>
            </Pressable>
          </View>
        ) : null
      }
      initialNumToRender={10}
      windowSize={7}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      removeClippedSubviews
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.2}
    />
  );
}
// components/library/AllVideosList.tsx
import { FlatList, RefreshControl, Text } from 'react-native';
import type { LibraryRow } from './LibraryVideoRow';

type Props = {
  rows: LibraryRow[];
  renderItem: any;
  refreshing: boolean;
  onRefresh: () => void;
  tabBarHeight: number;
  onViewableItemsChanged: any;
  viewabilityConfig: any;
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
  } = props;

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
      // performance tuning
      initialNumToRender={10}
      windowSize={7}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      removeClippedSubviews
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
    />
  );
}

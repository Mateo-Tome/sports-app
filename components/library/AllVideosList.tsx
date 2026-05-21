import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import {
  groupRowsByDate,
  type DateGroupedLibraryItem,
} from '../../lib/library/groupRowsByDate';
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

function MonthHeader({ title }: { title: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 26,
        paddingBottom: 6,
      }}
    >
      <Text
        style={{
          color: 'rgba(255,255,255,0.38)',
          fontWeight: '900',
          fontSize: 12,
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </Text>

      <View
        style={{
          marginTop: 8,
          height: 1,
          backgroundColor: 'rgba(255,255,255,0.12)',
        }}
      />
    </View>
  );
}

function DayHeader({
  title,
  subtitle,
  clipCount,
}: {
  title: string;
  subtitle: string;
  clipCount: number;
}) {
  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 4,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 4,
          height: 34,
          borderRadius: 999,
          backgroundColor:
            title === 'TODAY'
              ? 'rgba(220,38,38,0.95)'
              : 'rgba(255,255,255,0.22)',
          marginRight: 10,
        }}
      />

      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: 'white',
            fontWeight: '900',
            fontSize: 16,
            letterSpacing: 0.4,
          }}
        >
          {title}
        </Text>

        <Text
          style={{
            color: 'rgba(255,255,255,0.45)',
            fontWeight: '700',
            fontSize: 12,
            marginTop: 1,
          }}
        >
          {subtitle}
        </Text>
      </View>

      <Text
        style={{
          color: 'rgba(255,255,255,0.42)',
          fontWeight: '900',
          fontSize: 11,
          letterSpacing: 0.8,
        }}
      >
        {clipCount} {clipCount === 1 ? 'CLIP' : 'CLIPS'}
      </Text>
    </View>
  );
}

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
  const groupedRows = groupRowsByDate(rows);

  return (
    <FlatList
      data={groupedRows}
      keyExtractor={(it) => it.id}
      renderItem={({ item }: { item: DateGroupedLibraryItem }) => {
        if (item.type === 'month') {
          return <MonthHeader title={item.title} />;
        }

        if (item.type === 'day') {
          return (
            <DayHeader
              title={item.title}
              subtitle={item.subtitle}
              clipCount={item.clipCount}
            />
          );
        }

        return renderItem({ item: item.row });
      }}
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
      initialNumToRender={14}
      windowSize={7}
      maxToRenderPerBatch={12}
      updateCellsBatchingPeriod={50}
      removeClippedSubviews
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.2}
    />
  );
}
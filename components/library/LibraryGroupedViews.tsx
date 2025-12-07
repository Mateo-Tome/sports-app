// components/library/LibraryGroupedViews.tsx

import { Image } from 'expo-image';
import React from 'react';
import {
    FlatList,
    Pressable,
    Text,
    TouchableOpacity,
    View,
    ViewToken,
} from 'react-native';

import AllVideosList from './AllVideosList';
import type { LibraryRow } from './LibraryVideoRow';

type Row = LibraryRow;

type ViewKey = 'all' | 'athletes' | 'sports';

interface LibraryGroupedViewsProps {
  view: ViewKey;
  setView: (v: ViewKey) => void;

  selectedAthlete: string | null;
  setSelectedAthlete: (v: string | null) => void;

  selectedSport: string | null;
  setSelectedSport: (v: string | null) => void;

  allRows: Row[];
  rowsByAthlete: Record<string, Row[]>;
  rowsBySport: Record<string, Row[]>;
  athleteSportsMap: Record<string, Record<string, Row[]>>;

  tabBarHeight: number;
  topInset: number;

  // Fixed type: use React.ReactElement instead of JSX.Element
  renderVideoRow: ({ item }: { item: Row }) => React.ReactElement | null;

  refreshing: boolean;
  onRefresh: () => void;

  onViewableItemsChanged: (info: { changed: ViewToken[] }) => void;
  viewabilityConfig: { itemVisiblePercentThreshold: number };

  photoFor: (name: string) => string | null;
}

const LibraryGroupedViews: React.FC<LibraryGroupedViewsProps> = ({
  view,
  setView,
  selectedAthlete,
  setSelectedAthlete,
  selectedSport,
  setSelectedSport,
  allRows,
  rowsByAthlete,
  rowsBySport,
  athleteSportsMap,
  tabBarHeight,
  topInset,
  renderVideoRow,
  refreshing,
  onRefresh,
  onViewableItemsChanged,
  viewabilityConfig,
  photoFor,
}) => {
  // ---- header ----
  const renderHeader = () => (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: topInset,
        paddingBottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text style={{ color: 'white', fontSize: 20, fontWeight: '900' }}>
        Library
      </Text>
      <TouchableOpacity
        onPress={onRefresh}
        style={{
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: 'white',
        }}
      >
        <Text style={{ color: 'white', fontWeight: '800' }}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  // ---- segmented tabs ----
  const renderSegmentedTabs = () => (
    <View
      style={{
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingBottom: 8,
      }}
    >
      {(['all', 'athletes', 'sports'] as const).map((k) => (
        <TouchableOpacity
          key={k}
          onPress={() => {
            setView(k);
            setSelectedAthlete(null);
            setSelectedSport(null);
          }}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor:
              view === k ? 'white' : 'rgba(255,255,255,0.12)',
            borderWidth: 1,
            borderColor: 'white',
          }}
        >
          <Text
            style={{
              color: view === k ? 'black' : 'white',
              fontWeight: '800',
            }}
          >
            {k === 'all' ? 'All' : k[0].toUpperCase() + k.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ---- Athletes root ----
  const renderAthletesRoot = () => (
    <FlatList
      data={Object.keys(rowsByAthlete).sort((a, b) => {
        if (a === 'Unassigned') return 1;
        if (b === 'Unassigned') return -1;
        return a.localeCompare(b);
      })}
      keyExtractor={(k) => k}
      renderItem={({ item: name }) => {
        const photoUri = photoFor(name);
        const videos = rowsByAthlete[name];
        const count = videos.length;
        const last = videos?.[0]?.mtime
          ? new Date(videos[0].mtime!).toLocaleString()
          : '—';

        return (
          <Pressable
            onPress={() => {
              setSelectedAthlete(name);
              setSelectedSport(null);
            }}
            style={{
              padding: 12,
              marginHorizontal: 16,
              marginVertical: 8,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
              backgroundColor: 'rgba(255,255,255,0.06)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              justifyContent: 'space-between',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                flex: 1,
              }}
            >
              {photoUri ? (
                <Image
                  source={{ uri: photoUri }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                  }}
                  contentFit="cover"
                  transition={100}
                />
              ) : (
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: 'white',
                      opacity: 0.7,
                      fontSize: 20,
                    }}
                  >
                    👤
                  </Text>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: 'white', fontWeight: '800' }}
                  numberOfLines={1}
                >
                  {name}
                </Text>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.7)',
                    marginTop: 4,
                  }}
                  numberOfLines={1}
                >
                  {count} {count === 1 ? 'video' : 'videos'} • last {last}
                </Text>
              </View>
            </View>

            <Text
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: 20,
                marginLeft: 8,
              }}
            >
              ›
            </Text>
          </Pressable>
        );
      }}
      contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
      ListEmptyComponent={
        <Text
          style={{
            color: 'white',
            opacity: 0.7,
            textAlign: 'center',
            marginTop: 40,
          }}
        >
          No groups yet.
        </Text>
      }
    />
  );

  // ---- Athlete ➜ sports list ----
  const renderAthleteSports = () => {
    if (selectedAthlete == null) return null;

    return (
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => setSelectedAthlete(null)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderWidth: 1,
              borderColor: 'white',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '800' }}>Back</Text>
          </TouchableOpacity>
          <Text
            style={{
              color: 'white',
              fontWeight: '900',
              marginLeft: 6,
            }}
          >
            {selectedAthlete}
          </Text>
        </View>

        <FlatList
          data={Object.keys(athleteSportsMap[selectedAthlete] || {}).sort(
            (a, b) => a.localeCompare(b),
          )}
          keyExtractor={(s) => s}
          renderItem={({ item: sport }) => {
            const list = athleteSportsMap[selectedAthlete]?.[sport] ?? [];
            const count = list.length;
            const last = list[0]?.mtime
              ? new Date(list[0].mtime!).toLocaleString()
              : '—';
            const preview = list[0]?.thumbUri ?? null;

            return (
              <Pressable
                onPress={() => setSelectedSport(sport)}
                style={{
                  padding: 12,
                  marginHorizontal: 16,
                  marginVertical: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.12)',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  justifyContent: 'space-between',
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    flex: 1,
                  }}
                >
                  {preview ? (
                    <Image
                      source={{ uri: preview }}
                      style={{
                        width: 72,
                        height: 40,
                        borderRadius: 8,
                        backgroundColor: 'rgba(255,255,255,0.1)',
                      }}
                      contentFit="cover"
                      transition={100}
                    />
                  ) : (
                    <View
                      style={{
                        width: 72,
                        height: 40,
                        borderRadius: 8,
                        backgroundColor: 'rgba(255,255,255,0.12)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: 'white',
                          opacity: 0.6,
                          fontSize: 12,
                        }}
                      >
                        No preview
                      </Text>
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: 'white',
                        fontWeight: '800',
                      }}
                      numberOfLines={1}
                    >
                      {sport}
                    </Text>
                    <Text
                      style={{
                        color: 'rgba(255,255,255,0.7)',
                        marginTop: 4,
                      }}
                      numberOfLines={1}
                    >
                      {count} {count === 1 ? 'video' : 'videos'} • last {last}
                    </Text>
                  </View>
                </View>

                <Text
                  style={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 20,
                    marginLeft: 8,
                  }}
                >
                  ›
                </Text>
              </Pressable>
            );
          }}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
        />
      </View>
    );
  };

  // ---- Athlete ➜ sport ➜ videos ----
  const renderAthleteSportVideos = () => {
    if (selectedAthlete == null || selectedSport == null) return null;

    return (
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => setSelectedSport(null)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderWidth: 1,
              borderColor: 'white',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '800' }}>Back</Text>
          </TouchableOpacity>
          <Text
            style={{
              color: 'white',
              fontWeight: '900',
              marginLeft: 6,
            }}
          >
            {selectedAthlete} • {selectedSport}
          </Text>
        </View>

        <FlatList
          data={athleteSportsMap[selectedAthlete]?.[selectedSport] ?? []}
          keyExtractor={(it) => it.uri}
          renderItem={renderVideoRow}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
          initialNumToRender={8}
          windowSize={7}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      </View>
    );
  };

  // ---- Sports root ----
  const renderSportsRoot = () => (
    <FlatList
      data={Object.keys(rowsBySport).sort((a, b) => a.localeCompare(b))}
      keyExtractor={(k) => k}
      renderItem={({ item: s }) => (
        <Pressable
          onPress={() => setSelectedSport(s)}
          style={{
            padding: 12,
            marginHorizontal: 16,
            marginVertical: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.12)',
            backgroundColor: 'rgba(255,255,255,0.06)',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '800' }}>{s}</Text>
          <Text style={{ color: 'white', opacity: 0.7 }}>
            {rowsBySport[s].length} videos
          </Text>
        </Pressable>
      )}
      contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
    />
  );

  // ---- Sports ➜ videos ----
  const renderSportsVideos = () => {
    if (selectedSport == null) return null;

    return (
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => setSelectedSport(null)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderWidth: 1,
              borderColor: 'white',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '800' }}>Back</Text>
          </TouchableOpacity>
          <Text
            style={{
              color: 'white',
              fontWeight: '900',
              marginLeft: 6,
            }}
          >
            {selectedSport}
          </Text>
        </View>
        <FlatList
          data={rowsBySport[selectedSport] ?? []}
          keyExtractor={(it) => it.uri}
          renderItem={renderVideoRow}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
          initialNumToRender={8}
          windowSize={7}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {renderHeader()}
      {renderSegmentedTabs()}

      {view === 'all' && (
        <AllVideosList
          rows={allRows}
          renderItem={renderVideoRow}
          refreshing={refreshing}
          onRefresh={onRefresh}
          tabBarHeight={tabBarHeight}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      )}

      {view === 'athletes' && selectedAthlete == null && renderAthletesRoot()}
      {view === 'athletes' &&
        selectedAthlete != null &&
        selectedSport == null &&
        renderAthleteSports()}
      {view === 'athletes' &&
        selectedAthlete != null &&
        selectedSport != null &&
        renderAthleteSportVideos()}

      {view === 'sports' && selectedSport == null && renderSportsRoot()}
      {view === 'sports' && selectedSport != null && renderSportsVideos()}
    </View>
  );
};

export default LibraryGroupedViews;

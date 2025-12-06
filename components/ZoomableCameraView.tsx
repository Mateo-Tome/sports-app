// components/ZoomableCameraView.tsx
import { CameraView } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import {
    PinchGestureHandler,
    PinchGestureHandlerGestureEvent,
    PinchGestureHandlerStateChangeEvent,
    State,
} from 'react-native-gesture-handler';

type CameraViewProps = React.ComponentProps<typeof CameraView>;

type Props = CameraViewProps & {
  style?: StyleProp<ViewStyle>;
};

const MIN_ZOOM = 0;
const MAX_ZOOM = 1;
// Tune this for how fast zoom feels
const ZOOM_SENSITIVITY = 0.35;

// How long after you stop pinching before the indicator hides (faster now)
const INDICATOR_HIDE_DELAY_MS = 500;

const ZoomableCameraView = React.forwardRef<CameraView, Props>((props, ref) => {
  const { style, ...rest } = props;

  const [zoom, setZoom] = useState(0);
  const baseZoomRef = useRef(0);

  const [showIndicator, setShowIndicator] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const clearHideTimeout = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const scheduleHideIndicator = () => {
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      setShowIndicator(false);
    }, INDICATOR_HIDE_DELAY_MS);
  };

  const handleGestureEvent = (event: PinchGestureHandlerGestureEvent) => {
    const { scale } = event.nativeEvent;

    // Show indicator while pinching
    setShowIndicator(true);
    clearHideTimeout();

    // scale ~ 1 at rest, >1 zoom in, <1 zoom out
    const delta = (scale - 1) * ZOOM_SENSITIVITY;
    const next = clampZoom(baseZoomRef.current + delta);
    setZoom(next);
  };

  const handleStateChange = (event: PinchGestureHandlerStateChangeEvent) => {
    const { state, scale } = event.nativeEvent;

    if (state === State.BEGAN) {
      // Start of pinch: remember current zoom and show indicator
      baseZoomRef.current = zoom;
      setShowIndicator(true);
      clearHideTimeout();
    } else if (
      state === State.END ||
      state === State.CANCELLED ||
      state === State.FAILED
    ) {
      // Gesture finished: commit final zoom and schedule hide
      const delta = (scale - 1) * ZOOM_SENSITIVITY;
      const next = clampZoom(baseZoomRef.current + delta);
      baseZoomRef.current = next;
      setZoom(next);
      scheduleHideIndicator();
    }
  };

  useEffect(() => {
    return () => {
      clearHideTimeout();
    };
  }, []);

  // Convert zoom (0–1) into a friendlier “X.x×” label
  const zoomFactor = 1 + zoom * 3; // 1.0× to 4.0×
  const zoomLabel = `${zoomFactor.toFixed(1)}×`;

  return (
    <PinchGestureHandler
      onGestureEvent={handleGestureEvent}
      onHandlerStateChange={handleStateChange}
    >
      <View style={style}>
        <CameraView
          ref={ref}
          {...rest}
          style={{ flex: 1 }}
          zoom={zoom}
        />

        {showIndicator && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              // Middle-ish of the screen so it's not behind bottom buttons
              top: '40%',
              left: 0,
              right: 0,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.35)',
              }}
            >
              <Text
                style={{
                  color: 'white',
                  fontSize: 12,
                  fontWeight: '800',
                  textAlign: 'center',
                }}
              >
                {zoomLabel}
              </Text>
            </View>
          </View>
        )}
      </View>
    </PinchGestureHandler>
  );
});

ZoomableCameraView.displayName = 'ZoomableCameraView';

export default ZoomableCameraView;

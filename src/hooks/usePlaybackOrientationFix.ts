import { useCallback, useEffect, useMemo, useState } from 'react';

type OrientationOverride = 0 | 90 | 180 | 270;

function normalizeOrientation(value: number): OrientationOverride {
  const v = ((value % 360) + 360) % 360;
  if (v === 90 || v === 180 || v === 270) return v;
  return 0;
}

type Params = {
  persistedOrientation: OrientationOverride;
  viewportWidth: number;
  viewportHeight: number;
  shareId?: string;
  persistOrientationOverride: (next: OrientationOverride) => Promise<void>;
};

export function usePlaybackOrientationFix({
  persistedOrientation,
  viewportWidth,
  viewportHeight,
  shareId,
  persistOrientationOverride,
}: Params) {
  const [previewOrientation, setPreviewOrientation] =
    useState<OrientationOverride>(persistedOrientation);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPreviewOrientation(persistedOrientation);
  }, [persistedOrientation]);

  const canEditOrientation = !shareId;

  const isQuarterTurn =
    previewOrientation === 90 || previewOrientation === 270;

  const rotateLeft = useCallback(() => {
    if (!canEditOrientation) return;
    setPreviewOrientation((prev) =>
      normalizeOrientation(prev - 90) as OrientationOverride
    );
  }, [canEditOrientation]);

  const rotateRight = useCallback(() => {
    if (!canEditOrientation) return;
    setPreviewOrientation((prev) =>
      normalizeOrientation(prev + 90) as OrientationOverride
    );
  }, [canEditOrientation]);

  const reset = useCallback(() => {
    if (!canEditOrientation) return;
    setPreviewOrientation(0);
  }, [canEditOrientation]);

  const revert = useCallback(() => {
    setPreviewOrientation(persistedOrientation);
  }, [persistedOrientation]);

  const dirty = previewOrientation !== persistedOrientation;

  const save = useCallback(async () => {
    if (!canEditOrientation || !dirty || isSaving) return;
    try {
      setIsSaving(true);
      await persistOrientationOverride(previewOrientation);
    } finally {
      setIsSaving(false);
    }
  }, [
    canEditOrientation,
    dirty,
    isSaving,
    persistOrientationOverride,
    previewOrientation,
  ]);

  const videoStageStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      overflow: 'hidden' as const,
      backgroundColor: 'black',
    }),
    []
  );

  const videoSurfaceStyle = useMemo(() => {
    const baseWidth = isQuarterTurn ? viewportHeight : viewportWidth;
    const baseHeight = isQuarterTurn ? viewportWidth : viewportHeight;

    return {
      width: Math.max(1, baseWidth),
      height: Math.max(1, baseHeight),
      backgroundColor: 'black',
      transform: [{ rotate: `${previewOrientation}deg` }],
    };
  }, [isQuarterTurn, previewOrientation, viewportHeight, viewportWidth]);

  const rotationLabel = `${previewOrientation}°`;

  return {
    canEditOrientation,
    previewOrientation,
    rotationLabel,
    dirty,
    isSaving,
    rotateLeft,
    rotateRight,
    reset,
    revert,
    save,
    videoStageStyle,
    videoSurfaceStyle,
  };
}
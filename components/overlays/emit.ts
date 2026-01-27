import type { OverlayEvent } from './types';

export function makeUiMeta(pillColor?: string) {
  return pillColor ? { ui: { pillColor } } : {};
}

export function mergeMeta(...parts: Array<Record<string, any> | undefined>) {
  return Object.assign({}, ...parts.filter(Boolean));
}

export function makeEvent(
  base: Omit<OverlayEvent, 'meta'> & { meta?: Record<string, any> },
): OverlayEvent {
  return {
    ...base,
    meta: base.meta ?? {},
  } as OverlayEvent;
}

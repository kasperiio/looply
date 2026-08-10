import { useRef } from 'react';

// Horizontal travel that counts as a deliberate swipe rather than a stray tap.
const TRIGGER_PX = 40;
// Beyond this much vertical drift the gesture is a scroll/pan, not a swipe.
const MAX_DRIFT_PX = 40;

/**
 * Touch handlers for a left-edge strip that opens the drawer on a
 * left-to-right swipe. Meant for an element that sits above the map so the
 * gesture never reaches Leaflet's drag handler.
 */
export function useEdgeSwipe(onSwipeRight) {
  const startRef = useRef(null);

  const onTouchStart = (e) => {
    const touch = e.touches[0];
    startRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const onTouchMove = (e) => {
    const start = startRef.current;
    const touch = e.touches[0];
    if (!start || !touch) return;
    if (Math.abs(touch.clientY - start.y) > MAX_DRIFT_PX) {
      startRef.current = null;
      return;
    }
    if (touch.clientX - start.x > TRIGGER_PX) {
      startRef.current = null;
      onSwipeRight();
    }
  };

  const onTouchEnd = () => {
    startRef.current = null;
  };

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd };
}

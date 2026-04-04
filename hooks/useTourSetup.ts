import { useState, useRef, useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { useTour } from '../contexts/TourContext';
import type { CoachMarkStep } from '../components/CoachMark';

type TourStepContent = {
  id: string;
  title: string;
  description: string;
  position: 'above' | 'below';
};

export function useTourSetup(tourId: string, stepContents: TourStepContent[]) {
  const { hasSeenTour, markTourSeen, loaded } = useTour();
  const [tourSteps, setTourSteps] = useState<CoachMarkStep[]>([]);
  const [showTour, setShowTour] = useState(false);
  const mountedRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refs = useRef<Map<string, View>>(new Map());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const setRef = useCallback((id: string) => (el: View | null) => {
    if (el) {
      refs.current.set(id, el);
    } else {
      refs.current.delete(id);
    }
  }, []);

  const startTour = useCallback(() => {
    if (hasSeenTour(tourId) || !loaded) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;

      const steps: (CoachMarkStep & { id: string })[] = [];
      let measured = 0;
      const total = stepContents.length;

      const finalize = () => {
        if (!mountedRef.current || steps.length === 0) return;
        const ordered = stepContents
          .map(sc => steps.find(s => s.id === sc.id))
          .filter(Boolean) as CoachMarkStep[];
        if (ordered.length > 0) {
          setTourSteps(ordered);
          setShowTour(true);
        }
      };

      stepContents.forEach((content) => {
        const ref = refs.current.get(content.id);
        if (ref) {
          ref.measureInWindow((x, y, w, h) => {
            if (!mountedRef.current) return;
            if (w > 0 && h > 0) {
              steps.push({
                id: content.id,
                target: { x, y, width: w, height: Math.min(h, 220) },
                title: content.title,
                description: content.description,
                position: content.position,
              });
            }
            measured++;
            if (measured === total) finalize();
          });
        } else {
          measured++;
          if (measured === total) finalize();
        }
      });
    }, 800);
  }, [tourId, hasSeenTour, loaded, stepContents]);

  const completeTour = useCallback(() => {
    setShowTour(false);
    markTourSeen(tourId);
  }, [tourId, markTourSeen]);

  const shouldShow = loaded && !hasSeenTour(tourId);

  return {
    setRef,
    startTour,
    tourSteps,
    showTour,
    completeTour,
    shouldShowTour: shouldShow,
  };
}

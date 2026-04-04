import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOUR_KEY = '@rhome/completed_tours';

interface TourContextType {
  hasSeenTour: (tourId: string) => boolean;
  markTourSeen: (tourId: string) => void;
  resetTours: () => void;
  loaded: boolean;
}

const TourContext = createContext<TourContextType>({
  hasSeenTour: () => true,
  markTourSeen: () => {},
  resetTours: () => {},
  loaded: false,
});

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [seenTours, setSeenTours] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(TOUR_KEY).then(stored => {
      if (stored) setSeenTours(new Set(JSON.parse(stored)));
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const hasSeenTour = (tourId: string) => !loaded || seenTours.has(tourId);

  const markTourSeen = (tourId: string) => {
    setSeenTours(prev => {
      const next = new Set(prev);
      next.add(tourId);
      AsyncStorage.setItem(TOUR_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const resetTours = () => {
    setSeenTours(new Set());
    AsyncStorage.removeItem(TOUR_KEY);
  };

  return (
    <TourContext.Provider value={{ hasSeenTour, markTourSeen, resetTours, loaded }}>
      {children}
    </TourContext.Provider>
  );
};

export const useTour = () => useContext(TourContext);

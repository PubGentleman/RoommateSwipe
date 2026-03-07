import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const SELECTED_CITY_KEY = 'roomdr_selected_city';
const RECENT_CITIES_KEY = 'roomdr_recent_cities';
const MAX_RECENT_CITIES = 3;

interface CityContextType {
  activeCity: string | null;
  recentCities: string[];
  initialized: boolean;
  setActiveCity: (city: string | null) => void;
  addRecentCity: (city: string) => void;
}

const CityContext = createContext<CityContextType>({
  activeCity: null,
  recentCities: [],
  initialized: false,
  setActiveCity: () => {},
  addRecentCity: () => {},
});

export const useCityContext = () => useContext(CityContext);

export const CityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeCity, setActiveCityState] = useState<string | null>(null);
  const [recentCities, setRecentCitiesState] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const hasUserSetCity = useRef(false);

  useEffect(() => {
    const loadSavedCity = async () => {
      try {
        const [savedCity, savedRecent] = await Promise.all([
          AsyncStorage.getItem(SELECTED_CITY_KEY),
          AsyncStorage.getItem(RECENT_CITIES_KEY),
        ]);
        if (savedCity) {
          setActiveCityState(savedCity);
          hasUserSetCity.current = true;
        } else if (user?.profileData?.city) {
          setActiveCityState(user.profileData.city);
        }
        if (savedRecent) {
          setRecentCitiesState(JSON.parse(savedRecent));
        }
      } catch (e) {
      }
      setInitialized(true);
    };
    loadSavedCity();
  }, []);

  useEffect(() => {
    if (initialized && !hasUserSetCity.current && !activeCity && user?.profileData?.city) {
      setActiveCityState(user.profileData.city);
    }
  }, [user?.profileData?.city, initialized]);

  const addRecentCity = useCallback((city: string) => {
    setRecentCitiesState(prev => {
      const updated = [city, ...prev.filter(c => c !== city)].slice(0, MAX_RECENT_CITIES);
      AsyncStorage.setItem(RECENT_CITIES_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const setActiveCity = useCallback((city: string | null) => {
    setActiveCityState(city);
    hasUserSetCity.current = true;
    if (city) {
      AsyncStorage.setItem(SELECTED_CITY_KEY, city).catch(() => {});
      addRecentCity(city);
    } else {
      AsyncStorage.removeItem(SELECTED_CITY_KEY).catch(() => {});
    }
  }, [addRecentCity]);

  return (
    <CityContext.Provider value={{ activeCity, recentCities, initialized, setActiveCity, addRecentCity }}>
      {children}
    </CityContext.Provider>
  );
};

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { createErrorHandler } from '../utils/errorLogger';

const SELECTED_CITY_KEY = 'rhome_selected_city';
const SELECTED_SUB_AREA_KEY = 'rhome_selected_sub_area';
const RECENT_CITIES_KEY = 'rhome_recent_cities';
const MAX_RECENT_CITIES = 3;

interface CityContextType {
  activeCity: string | null;
  activeSubArea: string | null;
  recentCities: string[];
  initialized: boolean;
  setActiveCity: (city: string | null) => void;
  setActiveSubArea: (subArea: string | null) => void;
  addRecentCity: (city: string) => void;
}

const CityContext = createContext<CityContextType>({
  activeCity: null,
  activeSubArea: null,
  recentCities: [],
  initialized: false,
  setActiveCity: () => {},
  setActiveSubArea: () => {},
  addRecentCity: () => {},
});

export const useCityContext = () => useContext(CityContext);

export const CityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeCity, setActiveCityState] = useState<string | null>(null);
  const [activeSubArea, setActiveSubAreaState] = useState<string | null>(null);
  const [recentCities, setRecentCitiesState] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const hasUserSetCity = useRef(false);

  useEffect(() => {
    const loadSavedCity = async () => {
      try {
        const [savedCity, savedSubArea, savedRecent] = await Promise.all([
          AsyncStorage.getItem(SELECTED_CITY_KEY),
          AsyncStorage.getItem(SELECTED_SUB_AREA_KEY),
          AsyncStorage.getItem(RECENT_CITIES_KEY),
        ]);
        if (savedCity) {
          setActiveCityState(savedCity);
          hasUserSetCity.current = true;
        } else if (user?.profileData?.city) {
          setActiveCityState(user.profileData.city);
        }
        if (savedSubArea) {
          setActiveSubAreaState(savedSubArea);
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
      AsyncStorage.setItem(RECENT_CITIES_KEY, JSON.stringify(updated)).catch(createErrorHandler('CityContext', 'setItem'));
      return updated;
    });
  }, []);

  const setActiveSubArea = useCallback((subArea: string | null) => {
    setActiveSubAreaState(subArea);
    if (subArea) {
      AsyncStorage.setItem(SELECTED_SUB_AREA_KEY, subArea).catch(createErrorHandler('CityContext', 'setItem'));
    } else {
      AsyncStorage.removeItem(SELECTED_SUB_AREA_KEY).catch(createErrorHandler('CityContext', 'removeItem'));
    }
  }, []);

  const setActiveCity = useCallback((city: string | null) => {
    setActiveCityState(city);
    setActiveSubArea(null);
    hasUserSetCity.current = true;
    if (city) {
      AsyncStorage.setItem(SELECTED_CITY_KEY, city).catch(createErrorHandler('CityContext', 'setItem'));
      addRecentCity(city);
    } else {
      AsyncStorage.removeItem(SELECTED_CITY_KEY).catch(createErrorHandler('CityContext', 'removeItem'));
    }
  }, [addRecentCity, setActiveSubArea]);

  return (
    <CityContext.Provider value={{ activeCity, activeSubArea, recentCities, initialized, setActiveCity, setActiveSubArea, addRecentCity }}>
      {children}
    </CityContext.Provider>
  );
};

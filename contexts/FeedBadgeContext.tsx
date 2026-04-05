import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getUnreadFeedCount, subscribeToFeed } from '../services/activityFeedService';

interface FeedBadgeContextType {
  unreadFeedCount: number;
  refreshFeedCount: () => void;
}

const FeedBadgeContext = createContext<FeedBadgeContextType>({
  unreadFeedCount: 0,
  refreshFeedCount: () => {},
});

export const useFeedBadge = () => useContext(FeedBadgeContext);

export const FeedBadgeProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [unreadFeedCount, setUnreadFeedCount] = useState(0);

  const refreshFeedCount = useCallback(() => {
    if (!user?.id) return;
    getUnreadFeedCount(user.id).then(setUnreadFeedCount).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setUnreadFeedCount(0);
      return;
    }
    refreshFeedCount();
    const unsub = subscribeToFeed(user.id, () => {
      refreshFeedCount();
    });
    return unsub;
  }, [user?.id, refreshFeedCount]);

  return (
    <FeedBadgeContext.Provider value={{ unreadFeedCount, refreshFeedCount }}>
      {children}
    </FeedBadgeContext.Provider>
  );
};

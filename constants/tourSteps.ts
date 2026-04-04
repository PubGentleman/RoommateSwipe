export const TOUR_CONTENT = {
  explore: [
    {
      id: 'filter',
      title: 'Filter Listings',
      description: 'Narrow down by price, neighborhoods, amenities, and more.',
      position: 'below' as const,
    },
    {
      id: 'mapToggle',
      title: 'Map View',
      description: 'See listings on a map. Tap pins to explore neighborhoods.',
      position: 'below' as const,
    },
    {
      id: 'listingCard',
      title: 'Browse & Save',
      description: 'Tap to see details. Save listings to share with your group.',
      position: 'above' as const,
    },
  ],
  roommates: [
    {
      id: 'swipeCard',
      title: 'Swipe to Match',
      description: 'Swipe right to like someone, left to pass. Mutual likes become matches!',
      position: 'above' as const,
    },
    {
      id: 'superLike',
      title: 'Super Like',
      description: 'Use Super Likes to stand out. The other person will know you really like them.',
      position: 'above' as const,
    },
    {
      id: 'matchInsights',
      title: 'Match Insights',
      description: 'See your compatibility breakdown -- budget, lifestyle, and location fit.',
      position: 'above' as const,
    },
  ],
  messages: [
    {
      id: 'search',
      title: 'Search Messages',
      description: 'Find any message across all your conversations.',
      position: 'below' as const,
    },
    {
      id: 'filters',
      title: 'Filter Chats',
      description: 'Switch between all chats, direct messages, and group threads.',
      position: 'below' as const,
    },
  ],
  hostDashboard: [
    {
      id: 'createListing',
      title: 'Create Your First Listing',
      description: 'Add photos, set your price, and start receiving inquiries from renters.',
      position: 'below' as const,
    },
    {
      id: 'stats',
      title: 'Track Performance',
      description: 'Monitor views, inquiry rates, and how your listings compare.',
      position: 'below' as const,
    },
    {
      id: 'team',
      title: 'Build Your Team',
      description: 'Invite agents and staff to help manage listings and respond to inquiries.',
      position: 'below' as const,
    },
  ],
};

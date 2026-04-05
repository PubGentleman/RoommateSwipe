export function navigateToFeedAction(navigation: any, actionUrl: string | undefined) {
  if (!actionUrl) return;

  try {
    if (actionUrl.startsWith('/match/')) {
      const matchId = actionUrl.replace('/match/', '');
      navigation.navigate('Messages', { screen: 'Chat', params: { conversationId: matchId } });
    } else if (actionUrl.startsWith('/listing/')) {
      const listingId = actionUrl.replace('/listing/', '');
      navigation.navigate('Explore', { screen: 'ExploreMain', params: { viewListingId: listingId } });
    } else if (actionUrl.startsWith('/group/')) {
      const groupId = actionUrl.replace('/group/', '');
      navigation.navigate('Messages', { screen: 'Chat', params: { conversationId: `inquiry_${groupId}` } });
    } else if (actionUrl === '/profile-views') {
      navigation.navigate('Profile', { screen: 'ProfileViews' });
    } else if (actionUrl === '/roommates') {
      navigation.navigate('Roommates');
    }
  } catch {
    try {
      navigation.goBack();
    } catch {}
  }
}

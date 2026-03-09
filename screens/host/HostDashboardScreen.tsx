import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import { Property, Application, InterestCard } from '../../types/models';

interface StatCard {
  icon: keyof typeof Feather.glyphMap;
  value: number;
  label: string;
  color: string;
}

export const HostDashboardScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [listings, setListings] = useState<Property[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [inquiries, setInquiries] = useState<InterestCard[]>([]);
  const [messageCount, setMessageCount] = useState(0);

  const loadData = useCallback(async () => {
    if (!user) return;
    await StorageService.initializeWithMockData();
    await StorageService.assignPropertiesToHost(user.id, user.name);

    const allProperties = await StorageService.getProperties();
    const myListings = allProperties.filter(p => p.hostId === user.id);
    setListings(myListings);

    const myPropertyIds = new Set(myListings.map(p => p.id));
    const allApps = await StorageService.getApplications();
    const myApps = allApps.filter(a => myPropertyIds.has(a.propertyId));
    setApplications(myApps);

    const allConvos = await StorageService.getConversations();
    const unreadMessages = allConvos.reduce((sum, c) => sum + (c.unread || 0), 0);
    setMessageCount(unreadMessages);

    const interestCards = await StorageService.getInterestCardsForHost(user.id);
    setInquiries(interestCards);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const activeCount = listings.filter(p => p.available && !p.rentedDate).length;
  const pausedCount = listings.filter(p => !p.available && !p.rentedDate).length;
  const rentedCount = listings.filter(p => !!p.rentedDate).length;
  const pendingApps = applications.filter(a => a.status === 'pending').length;
  const pendingInquiries = inquiries.filter(c => c.status === 'pending').length;

  const stats: StatCard[] = [
    { icon: 'home', value: listings.length, label: 'Total Listings', color: theme.info },
    { icon: 'check-circle', value: activeCount, label: 'Active', color: theme.success },
    { icon: 'pause-circle', value: pausedCount, label: 'Paused', color: theme.warning },
    { icon: 'lock', value: rentedCount, label: 'Rented', color: theme.primary },
    { icon: 'heart', value: inquiries.length, label: 'Inquiries', color: '#ff6b5b' },
    { icon: 'clock', value: pendingInquiries, label: 'Pending Inquiries', color: '#FFA500' },
    { icon: 'file-text', value: applications.length, label: 'Applications', color: theme.secondary },
    { icon: 'message-circle', value: messageCount, label: 'Unread Messages', color: '#4ECDC4' },
  ];

  const recentApps = [...applications]
    .sort((a, b) => new Date(b.submittedDate).getTime() - new Date(a.submittedDate).getTime())
    .slice(0, 3);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return theme.warning;
      case 'approved': return theme.success;
      case 'rejected': return theme.error;
      default: return theme.textSecondary;
    }
  };

  const quickActions = [
    {
      icon: 'plus-circle' as keyof typeof Feather.glyphMap,
      label: 'Add Listing',
      onPress: () => {
        navigation.navigate('CreateEditListing');
      },
    },
    {
      icon: 'heart' as keyof typeof Feather.glyphMap,
      label: 'View Inquiries',
      onPress: () => {
        navigation.navigate('Inquiries');
      },
    },
    {
      icon: 'file-text' as keyof typeof Feather.glyphMap,
      label: 'View All Applications',
      onPress: () => {
        const parent = navigation.getParent();
        if (parent) {
          parent.navigate('Applications');
        }
      },
    },
    {
      icon: 'bar-chart-2' as keyof typeof Feather.glyphMap,
      label: 'View Analytics',
      onPress: () => {
        navigation.navigate('Analytics');
      },
    },
  ];

  return (
    <ScreenScrollView>
      <View style={styles.container}>
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <View
              key={index}
              style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: stat.color + '20' }]}>
                <Feather name={stat.icon} size={20} color={stat.color} />
              </View>
              <ThemedText style={[Typography.h2, { marginTop: Spacing.sm }]}>
                {stat.value}
              </ThemedText>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
                {stat.label}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>
            Recent Applications
          </ThemedText>
          {recentApps.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.backgroundDefault }]}>
              <Feather name="inbox" size={32} color={theme.textSecondary} />
              <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.md }]}>
                No applications yet
              </ThemedText>
            </View>
          ) : (
            recentApps.map((app) => (
              <View
                key={app.id}
                style={[styles.applicationCard, { backgroundColor: theme.backgroundDefault }]}
              >
                <Image
                  source={{ uri: app.applicantPhoto || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' }}
                  style={styles.applicantPhoto}
                />
                <View style={styles.applicationInfo}>
                  <ThemedText style={[Typography.body, { fontWeight: '600' }]} numberOfLines={1}>
                    {app.applicantName}
                  </ThemedText>
                  <ThemedText style={[Typography.caption, { color: theme.textSecondary }]} numberOfLines={1}>
                    {app.propertyTitle}
                  </ThemedText>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(app.status) + '20' }]}>
                  <ThemedText style={[Typography.small, { color: getStatusColor(app.status), fontWeight: '600' }]}>
                    {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                  </ThemedText>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>
            Quick Actions
          </ThemedText>
          {quickActions.map((action, index) => (
            <Pressable
              key={index}
              style={[styles.quickActionButton, { backgroundColor: theme.backgroundDefault }]}
              onPress={action.onPress}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: theme.primary + '20' }]}>
                <Feather name={action.icon} size={20} color={theme.primary} />
              </View>
              <ThemedText style={[Typography.body, { flex: 1, fontWeight: '500' }]}>
                {action.label}
              </ThemedText>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
          ))}
        </View>
      </View>
    </ScreenScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  statCard: {
    width: '47%',
    borderRadius: BorderRadius.medium,
    padding: Spacing.lg,
    alignItems: 'flex-start',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginTop: Spacing.xl,
  },
  emptyState: {
    borderRadius: BorderRadius.medium,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applicationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.medium,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  applicantPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  applicationInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.small,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.medium,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
});

import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { mockApplications } from '../../utils/mockData';

export const ApplicationsScreen = () => {
  const theme = useTheme();
  const [applications, setApplications] = useState(mockApplications);

  const formatDate = (date: Date) => {
    const days = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const renderApplication = (app: any) => (
    <Pressable
      key={app.id}
      style={[styles.applicationCard, { backgroundColor: Colors[theme].backgroundDefault }]}
      onPress={() => {}}
    >
      <View style={styles.header}>
        <Image source={{ uri: app.applicantPhoto }} style={styles.avatar} />
        <View style={styles.applicantInfo}>
          <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{app.applicantName}</ThemedText>
          <ThemedText style={[Typography.caption, { color: Colors[theme].textSecondary }]}>
            {app.propertyTitle}
          </ThemedText>
          <ThemedText style={[Typography.small, { color: Colors[theme].textSecondary, marginTop: Spacing.xs }]}>
            Applied {formatDate(app.submittedDate)}
          </ThemedText>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: Colors[theme].warning }]}>
          <ThemedText style={[Typography.small, { color: '#FFFFFF' }]}>Pending</ThemedText>
        </View>
      </View>
      <ThemedText style={[Typography.body, { marginTop: Spacing.lg }]} numberOfLines={3}>
        {app.message}
      </ThemedText>
      <View style={styles.actions}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: Colors[theme].success, flex: 1 }]}
          onPress={() => {}}
        >
          <Feather name="check" size={20} color="#FFFFFF" />
          <ThemedText style={[Typography.body, { color: '#FFFFFF', marginLeft: Spacing.sm, fontWeight: '600' }]}>
            Approve
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: Colors[theme].backgroundSecondary, flex: 1 }]}
          onPress={() => {}}
        >
          <Feather name="x" size={20} color={Colors[theme].text} />
          <ThemedText style={[Typography.body, { marginLeft: Spacing.sm, fontWeight: '600' }]}>
            Reject
          </ThemedText>
        </Pressable>
      </View>
    </Pressable>
  );

  return (
    <ScreenScrollView>
      <View style={styles.container}>
        {applications.map(app => renderApplication(app))}
      </View>
    </ScreenScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  applicationCard: {
    borderRadius: BorderRadius.medium,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: Spacing.md,
  },
  applicantInfo: {
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.medium,
  },
});

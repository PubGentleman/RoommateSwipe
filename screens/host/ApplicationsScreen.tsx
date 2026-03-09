import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Image, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import { Application, Property } from '../../types/models';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export const ApplicationsScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});

  const loadApplications = useCallback(async () => {
    if (!user) return;
    await StorageService.initializeWithMockData();
    await StorageService.assignPropertiesToHost(user.id, user.name);
    const allProperties = await StorageService.getProperties();
    const myPropertyIds = allProperties
      .filter((p: Property) => p.hostId === user.id)
      .map((p: Property) => p.id);
    const allApps = await StorageService.getApplications();
    const myApps = allApps.filter((a: Application) => myPropertyIds.includes(a.propertyId));
    setApplications(myApps);
    const notesMap: Record<string, string> = {};
    myApps.forEach((a: Application) => {
      if (a.notes) notesMap[a.id] = a.notes;
    });
    setEditingNotes(notesMap);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadApplications();
    }, [loadApplications])
  );

  const filteredApps = applications.filter(app => {
    if (filter === 'all') return true;
    return app.status === filter;
  });

  const updateApplicationStatus = async (appId: string, status: 'approved' | 'rejected') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const app = applications.find(a => a.id === appId);
    if (!app) return;
    const updated = { ...app, status };
    await StorageService.addOrUpdateApplication(updated);
    setApplications(prev => prev.map(a => a.id === appId ? updated : a));
  };

  const saveNote = async (appId: string) => {
    const app = applications.find(a => a.id === appId);
    if (!app) return;
    const updated = { ...app, notes: editingNotes[appId] || '' };
    await StorageService.addOrUpdateApplication(updated);
    setApplications(prev => prev.map(a => a.id === appId ? updated : a));
  };

  const formatDate = (date: Date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return 'Unknown';
    const days = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const getStatusColor = (status: string) => {
    if (status === 'approved') return theme.success;
    if (status === 'rejected') return theme.error;
    return theme.warning;
  };

  const filterTabs: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <ScreenScrollView>
      <View style={styles.container}>
        <View style={styles.filterRow}>
          {filterTabs.map(tab => (
            <Pressable
              key={tab.key}
              style={[
                styles.filterPill,
                {
                  backgroundColor: filter === tab.key ? theme.primary : theme.backgroundSecondary,
                },
              ]}
              onPress={() => setFilter(tab.key)}
            >
              <ThemedText
                style={[
                  Typography.caption,
                  { color: filter === tab.key ? '#FFFFFF' : theme.text, fontWeight: filter === tab.key ? '600' : '400' },
                ]}
              >
                {tab.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {filteredApps.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="file-text" size={48} color={theme.textSecondary} />
            <ThemedText style={[Typography.h3, { color: theme.textSecondary, marginTop: Spacing.lg, textAlign: 'center' }]}>
              No applications
            </ThemedText>
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
              {filter === 'all' ? 'No applications received yet' : `No ${filter} applications`}
            </ThemedText>
          </View>
        ) : (
          filteredApps.map(app => (
            <View
              key={app.id}
              style={[styles.applicationCard, { backgroundColor: theme.backgroundDefault }]}
            >
              <View style={styles.header}>
                <Image source={{ uri: app.applicantPhoto }} style={styles.avatar} />
                <View style={styles.applicantInfo}>
                  <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{app.applicantName}</ThemedText>
                  <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                    {app.propertyTitle}
                  </ThemedText>
                  <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
                    Applied {formatDate(app.submittedDate)}
                  </ThemedText>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(app.status) }]}>
                  <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>
                    {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                  </ThemedText>
                </View>
              </View>
              {app.message ? (
                <ThemedText style={[Typography.body, { marginTop: Spacing.lg }]} numberOfLines={3}>
                  {app.message}
                </ThemedText>
              ) : null}
              <View style={styles.notesContainer}>
                <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
                  Notes
                </ThemedText>
                <TextInput
                  style={[
                    styles.notesInput,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="Add a note about this applicant..."
                  placeholderTextColor={theme.textSecondary}
                  value={editingNotes[app.id] || ''}
                  onChangeText={(text) => setEditingNotes(prev => ({ ...prev, [app.id]: text }))}
                  onBlur={() => saveNote(app.id)}
                  multiline
                />
              </View>
              {app.status === 'pending' ? (
                <View style={styles.actions}>
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: theme.success, flex: 1 }]}
                    onPress={() => updateApplicationStatus(app.id, 'approved')}
                  >
                    <Feather name="check" size={20} color="#FFFFFF" />
                    <ThemedText style={[Typography.body, { color: '#FFFFFF', marginLeft: Spacing.sm, fontWeight: '600' }]}>
                      Approve
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary, flex: 1 }]}
                    onPress={() => updateApplicationStatus(app.id, 'rejected')}
                  >
                    <Feather name="x" size={20} color={theme.text} />
                    <ThemedText style={[Typography.body, { marginLeft: Spacing.sm, fontWeight: '600' }]}>
                      Reject
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>
    </ScreenScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  filterPill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
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
  notesContainer: {
    marginTop: Spacing.lg,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.small,
    padding: Spacing.md,
    minHeight: 60,
    fontSize: 14,
    textAlignVertical: 'top',
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
});

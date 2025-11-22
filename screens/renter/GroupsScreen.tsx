import React, { useState } from 'react';
import { View, StyleSheet, Pressable, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { useTheme } from '../../hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { mockGroups } from '../../utils/mockData';
import { Group } from '../../types/models';

export const GroupsScreen = () => {
  const theme = useTheme();
  const [groups, setGroups] = useState<Group[]>(mockGroups);

  const renderGroup = (group: Group) => (
    <Pressable
      key={group.id}
      style={[styles.groupCard, { backgroundColor: Colors[theme].backgroundDefault }]}
      onPress={() => {}}
    >
      <View style={styles.groupHeader}>
        <View style={[styles.groupIcon, { backgroundColor: Colors[theme].primary }]}>
          <Feather name="users" size={24} color="#FFFFFF" />
        </View>
        <View style={styles.groupInfo}>
          <ThemedText style={[Typography.h3]}>{group.name}</ThemedText>
          <ThemedText style={[Typography.caption, { color: Colors[theme].textSecondary }]}>
            {group.members.length} member{group.members.length !== 1 ? 's' : ''} • Looking for {group.lookingFor} more
          </ThemedText>
        </View>
        {group.compatibility ? (
          <View style={[styles.compatibilityBadge, { backgroundColor: Colors[theme].success }]}>
            <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>
              {group.compatibility}%
            </ThemedText>
          </View>
        ) : null}
      </View>
      <View style={styles.groupDetails}>
        <View style={styles.groupDetail}>
          <Feather name="dollar-sign" size={16} color={Colors[theme].textSecondary} />
          <ThemedText style={[Typography.body, { color: Colors[theme].text, marginLeft: Spacing.xs }]}>
            ${group.budget}/mo budget
          </ThemedText>
        </View>
        <View style={styles.groupDetail}>
          <Feather name="map-pin" size={16} color={Colors[theme].textSecondary} />
          <ThemedText style={[Typography.body, { color: Colors[theme].text, marginLeft: Spacing.xs }]}>
            {group.location}
          </ThemedText>
        </View>
        <View style={styles.groupDetail}>
          <Feather name="home" size={16} color={Colors[theme].textSecondary} />
          <ThemedText style={[Typography.body, { color: Colors[theme].text, marginLeft: Spacing.xs }]}>
            {group.targetBedrooms} bedrooms
          </ThemedText>
        </View>
      </View>
      <Pressable
        style={[styles.joinButton, { backgroundColor: Colors[theme].primary }]}
        onPress={() => {}}
      >
        <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
          Request to Join
        </ThemedText>
      </Pressable>
    </Pressable>
  );

  return (
    <ScreenScrollView>
      <View style={styles.container}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[Typography.h2]}>My Groups</ThemedText>
            <Pressable onPress={() => {}}>
              <Feather name="plus-circle" size={24} color={Colors[theme].primary} />
            </Pressable>
          </View>
          <ThemedText style={[Typography.body, { color: Colors[theme].textSecondary }]}>
            You haven't joined any groups yet
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={[Typography.h2, styles.sectionTitle]}>Browse All Groups</ThemedText>
          {groups.map(group => renderGroup(group))}
        </View>
      </View>
    </ScreenScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  groupCard: {
    borderRadius: BorderRadius.medium,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  compatibilityBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
  },
  groupDetails: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  groupDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

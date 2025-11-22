import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { Group } from '../../types/models';
import { StorageService } from '../../utils/storage';
import { useAuth } from '../../contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';

export const GroupsScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      loadGroups();
    }, [user])
  );

  const loadGroups = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const groups = await StorageService.getGroups();
      const userGroups = groups.filter(g => g.members.includes(user.id));
      const otherGroups = groups.filter(g => !g.members.includes(user.id));
      setMyGroups(userGroups);
      setAllGroups(otherGroups);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderGroup = (group: Group, isMyGroup: boolean) => {
    const spotsLeft = group.maxMembers - group.members.length;
    
    return (
      <Pressable
        key={group.id}
        style={[styles.groupCard, { backgroundColor: theme.backgroundDefault }]}
        onPress={() => {}}
      >
        <View style={styles.groupHeader}>
          <View style={[styles.groupIcon, { backgroundColor: theme.primary }]}>
            <Feather name="users" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.groupInfo}>
            <ThemedText style={[Typography.h3]}>{group.name}</ThemedText>
            <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
              {group.members.length}/{group.maxMembers} members{spotsLeft > 0 ? ` • ${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left` : ''}
            </ThemedText>
          </View>
          {isMyGroup ? (
            <View style={[styles.myGroupBadge, { backgroundColor: theme.success }]}>
              <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>
                My Group
              </ThemedText>
            </View>
          ) : null}
        </View>
        {group.description ? (
          <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.md }]}>
            {group.description}
          </ThemedText>
        ) : null}
        <View style={styles.groupDetails}>
          <View style={styles.groupDetail}>
            <Feather name="dollar-sign" size={16} color={theme.textSecondary} />
            <ThemedText style={[Typography.body, { color: theme.text, marginLeft: Spacing.xs }]}>
              ${group.budget}/mo budget
            </ThemedText>
          </View>
          <View style={styles.groupDetail}>
            <Feather name="map-pin" size={16} color={theme.textSecondary} />
            <ThemedText style={[Typography.body, { color: theme.text, marginLeft: Spacing.xs }]}>
              {group.preferredLocation}
            </ThemedText>
          </View>
        </View>
        {!isMyGroup && spotsLeft > 0 ? (
          <Pressable
            style={[styles.joinButton, { backgroundColor: theme.primary }]}
            onPress={() => {}}
          >
            <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
              Request to Join
            </ThemedText>
          </Pressable>
        ) : null}
      </Pressable>
    );
  };

  return (
    <ScreenScrollView>
      <View style={styles.container}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[Typography.h2]}>My Groups</ThemedText>
          </View>
          {myGroups.length > 0 ? (
            myGroups.map(group => renderGroup(group, true))
          ) : (
            <View style={styles.emptyState}>
              <Feather name="users" size={48} color={theme.textSecondary} />
              <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.md, textAlign: 'center' }]}>
                You haven't joined any groups yet{'\n'}
                Match with roommates to create a group together
              </ThemedText>
            </View>
          )}
        </View>

        {allGroups.length > 0 ? (
          <View style={styles.section}>
            <ThemedText style={[Typography.h2, styles.sectionTitle]}>Browse All Groups</ThemedText>
            {allGroups.map(group => renderGroup(group, false))}
          </View>
        ) : null}
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
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.medium,
  },
  myGroupBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
  },
});

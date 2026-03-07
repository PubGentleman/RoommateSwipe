import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, FlatList, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BlockedUserInfo {
  id: string;
  name: string;
  photo?: string;
}

export const BlockedUsersScreen = () => {
  const { theme } = useTheme();
  const { user, updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadBlockedUsers();
    }, [user?.blockedUsers])
  );

  const loadBlockedUsers = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const blockedIds = user.blockedUsers || [];
      const allUsers = await StorageService.getUsers();
      const profiles = await StorageService.getRoommateProfiles();

      const users: BlockedUserInfo[] = blockedIds.map(id => {
        const u = allUsers.find(u => u.id === id);
        const p = profiles.find(p => p.id === id);
        return {
          id,
          name: u?.name || p?.name || 'Unknown User',
          photo: u?.profilePicture || (p?.photos?.[0]),
        };
      });
      setBlockedUsers(users);
    } catch (error) {
      console.error('Error loading blocked users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblock = (blockedUser: BlockedUserInfo) => {
    Alert.alert(
      `Unblock ${blockedUser.name}?`,
      `${blockedUser.name} will be able to see your profile and contact you again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            if (!user) return;
            await StorageService.unblockUser(user.id, blockedUser.id);
            const updatedBlockedUsers = (user.blockedUsers || []).filter(id => id !== blockedUser.id);
            await updateUser({ blockedUsers: updatedBlockedUsers });
            setBlockedUsers(prev => prev.filter(u => u.id !== blockedUser.id));
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: BlockedUserInfo }) => (
    <View style={[styles.userRow, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
      <View style={styles.userInfo}>
        {item.photo ? (
          <Image source={{ uri: item.photo }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="user" size={20} color={theme.textSecondary} />
          </View>
        )}
        <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
          {item.name}
        </ThemedText>
      </View>
      <Pressable
        style={[styles.unblockButton, { borderColor: theme.primary }]}
        onPress={() => handleUnblock(item)}
      >
        <ThemedText style={[Typography.caption, { color: theme.primary, fontWeight: '600' }]}>
          Unblock
        </ThemedText>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {blockedUsers.length === 0 && !isLoading ? (
        <View style={styles.emptyState}>
          <Feather name="shield" size={64} color={theme.textSecondary} />
          <ThemedText style={[Typography.h3, { marginTop: Spacing.xl, textAlign: 'center' }]}>
            No Blocked Users
          </ThemedText>
          <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.sm }]}>
            Users you block will appear here. You can unblock them at any time.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.xl }]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unblockButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
});

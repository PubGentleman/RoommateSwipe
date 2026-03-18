import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Pressable, FlatList, RefreshControl, Alert } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import { Notification } from '../../types/models';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotificationContext } from '../../contexts/NotificationContext';
import { getNotifications, markNotificationRead, markAllNotificationsRead, subscribeToNotifications } from '../../services/notificationService';

const mapSupabaseNotification = (row: any): Notification => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  title: row.title,
  body: row.body,
  isRead: row.read ?? row.isRead ?? false,
  createdAt: new Date(row.created_at || row.createdAt),
  data: row.data || undefined,
});

export const NotificationsScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { refreshUnreadCount } = useNotificationContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const loadNotifications = async () => {
    if (!user?.id) return;
    try {
      const supabaseNotifications = await getNotifications();
      const mapped = supabaseNotifications.map(mapSupabaseNotification);
      const blockedIds = user.blockedUsers || [];
      const filtered = mapped.filter(
        n => !n.data?.fromUserId || !blockedIds.includes(n.data.fromUserId)
      );
      setNotifications(filtered);
    } catch (error) {
      console.error('Error loading notifications from Supabase, falling back to StorageService:', error);
      try {
        const userNotifications = await StorageService.getNotifications(user.id);
        const blockedIds = user.blockedUsers || [];
        const filtered = userNotifications.filter(
          n => !n.data?.fromUserId || !blockedIds.includes(n.data.fromUserId)
        );
        setNotifications(filtered);
      } catch (fallbackError) {
        console.error('Error loading notifications from StorageService:', fallbackError);
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    unsubscribeRef.current = subscribeToNotifications(user.id, (newNotification) => {
      const mapped = mapSupabaseNotification(newNotification);
      const blockedIds = user.blockedUsers || [];
      if (mapped.data?.fromUserId && blockedIds.includes(mapped.data.fromUserId)) return;
      setNotifications(prev => [mapped, ...prev]);
      refreshUnreadCount();
    });
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [user?.id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await markNotificationRead(notification.id);
      } catch (error) {
        console.error('Error marking notification read via Supabase, falling back:', error);
        await StorageService.markNotificationAsRead(notification.id);
      }
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
      await refreshUnreadCount();
    }

    switch (notification.type) {
      case 'match':
      case 'super_like':
        if (notification.data?.fromUserId && user?.id) {
          const conversations = await StorageService.getConversations();
          const fromId = notification.data.fromUserId;
          const existingConversation = conversations.find(
            c => c.participants.includes(user.id) && c.participants.includes(fromId)
          );
          if (existingConversation) {
            (navigation as any).navigate('Messages', {
              screen: 'Chat',
              params: { conversationId: existingConversation.id },
            });
          } else {
            (navigation as any).navigate('Messages');
          }
        }
        break;
      case 'message':
        if (notification.data?.conversationId) {
          (navigation as any).navigate('Messages', {
            screen: 'Chat',
            params: { conversationId: notification.data.conversationId },
          });
        }
        break;
      case 'group_invite':
      case 'group_accepted':
        (navigation as any).navigate('Groups');
        break;
      case 'property_update':
      case 'property_rented':
        (navigation as any).navigate('Explore');
        break;
      default:
        break;
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await StorageService.deleteNotification(notificationId);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    await refreshUnreadCount();
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    try {
      await markAllNotificationsRead();
    } catch (error) {
      console.error('Error marking all read via Supabase, falling back:', error);
      await StorageService.markAllNotificationsAsRead(user.id);
    }
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    await refreshUnreadCount();
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'match':
        return 'heart';
      case 'super_like':
        return 'star';
      case 'message':
        return 'message-circle';
      case 'group_invite':
      case 'group_accepted':
        return 'users';
      case 'property_update':
      case 'property_rented':
        return 'home';
      case 'application_status':
        return 'file-text';
      default:
        return 'bell';
    }
  };

  const getTimeSince = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <Pressable
      style={[
        styles.notificationCard,
        {
          backgroundColor: item.isRead ? '#1a1a1a' : '#222222',
          borderColor: theme.border,
        },
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationContent}>
        <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
          <Feather name={getNotificationIcon(item.type)} size={20} color={theme.primary} />
        </View>
        
        <View style={styles.textContainer}>
          <ThemedText style={[Typography.body, { fontWeight: item.isRead ? '400' : '600' }]}>
            {item.title}
          </ThemedText>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: 4 }]}>
            {item.body}
          </ThemedText>
          <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: 4, opacity: 0.7 }]}>
            {getTimeSince(item.createdAt)}
          </ThemedText>
        </View>

        <View style={styles.actionContainer}>
          <Feather name="chevron-right" size={16} color={theme.textSecondary} style={{ opacity: 0.5 }} />
          <Pressable
            style={styles.deleteButton}
            onPress={() => handleDelete(item.id)}
            hitSlop={8}
          >
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>

      {!item.isRead ? (
        <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
      ) : null}
    </Pressable>
  );

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <ThemedView style={[styles.container, { backgroundColor: '#111111' }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color={theme.primary} />
        </Pressable>
        <ThemedText style={Typography.h2}>Notifications</ThemedText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {unreadCount > 0 ? (
            <Pressable onPress={handleMarkAllAsRead} hitSlop={8}>
              <ThemedText style={[Typography.caption, { color: theme.primary, fontWeight: '600' }]}>
                Mark all read
              </ThemedText>
            </Pressable>
          ) : null}
          <Pressable onPress={() => (navigation as any).navigate('NotificationPreferences')} hitSlop={8}>
            <Feather name="sliders" size={20} color="rgba(255,255,255,0.5)" />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
            Loading notifications...
          </ThemedText>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <Feather name="bell-off" size={64} color={theme.textSecondary} style={{ marginBottom: Spacing.lg, opacity: 0.5 }} />
          <ThemedText style={[Typography.h3, { marginBottom: Spacing.sm }]}>
            No notifications yet
          </ThemedText>
          <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center' }]}>
            You'll see notifications here when you have new matches, messages, or updates
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
        />
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 32,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  notificationCard: {
    borderRadius: BorderRadius.large,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  actionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deleteButton: {
    padding: Spacing.xs,
  },
  unreadDot: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

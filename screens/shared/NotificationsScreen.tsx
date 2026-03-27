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
import { respondToInvite, getAgentInvitesForRenter } from '../../services/agentMatchmakerService';
import { AgentGroupInvite } from '../../types/models';
import * as Haptics from 'expo-haptics';

const mapSupabaseNotification = (row: any): Notification => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  title: row.title,
  body: row.body,
  isRead: row.read ?? row.isRead ?? false,
  createdAt: new Date(row.created_at || row.createdAt),
  data: typeof row.data === 'string' ? (() => { try { return JSON.parse(row.data); } catch { return undefined; } })() : (row.data || undefined),
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
    let mapped: Notification[] = [];
    try {
      const supabaseNotifications = await getNotifications();
      mapped = supabaseNotifications.map(mapSupabaseNotification);
    } catch (error) {
      console.error('Error loading notifications from Supabase, falling back to StorageService:', error);
      try {
        const userNotifications = await StorageService.getNotifications(user.id);
        mapped = userNotifications;
      } catch (fallbackError) {
        console.error('Error loading notifications from StorageService:', fallbackError);
      }
    }

    try {
      const agentInvites = await getAgentInvitesForRenter(user.id);
      const pendingInvites = agentInvites.filter(inv => inv.status === 'pending');

      const inviteNotifs: Notification[] = pendingInvites.map(inv => ({
        id: `agent_invite_${inv.id}`,
        userId: user.id,
        type: 'agent_invite' as any,
        title: `${inv.agentName} wants you in their group!`,
        body: `"${inv.listingTitle}" - ${inv.listingBedrooms}BR at $${inv.listingRent?.toLocaleString()}/mo`,
        isRead: false,
        createdAt: new Date(inv.sentAt),
        data: {
          agentInviteId: inv.id,
          listingTitle: inv.listingTitle,
          listingRent: inv.listingRent,
          groupMembers: inv.groupMembers,
        },
      }));

      const existingInviteIds = new Set(
        mapped
          .filter(n => n.type === 'agent_invite')
          .map(n => n.data?.agentInviteId)
      );
      const newInviteNotifs = inviteNotifs.filter(n => !existingInviteIds.has(n.data?.agentInviteId));
      mapped = [...newInviteNotifs, ...mapped];
    } catch (e) {
      console.warn('[Notifications] Could not load agent invites:', e);
    }

    const blockedIds = user.blockedUsers || [];
    const filtered = mapped.filter(
      n => !n.data?.fromUserId || !blockedIds.includes(n.data.fromUserId)
    );
    setNotifications(filtered);
    setIsLoading(false);
    setRefreshing(false);
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
      case 'agent_invite':
        break;
      case 'ai_group_suggestion':
        (navigation as any).navigate('Roommates');
        break;
      case 'group_invite':
        if (notification.data?.group_id) {
          (navigation as any).navigate('Groups', {
            screen: 'AIGroupInvite',
            params: { groupId: notification.data.group_id },
          });
        } else {
          (navigation as any).navigate('Groups');
        }
        break;
      case 'group_accepted':
        (navigation as any).navigate('Groups');
        break;
      case 'group_complete':
        if (notification.data?.group_id) {
          (navigation as any).navigate('Groups', {
            screen: 'GroupApartmentSuggestions',
            params: { groupId: notification.data.group_id, isNewlyComplete: true },
          });
        } else {
          (navigation as any).navigate('Groups');
        }
        break;
      case 'group_match':
        if (notification.data?.listing_id) {
          (navigation as any).navigate('Dashboard', {
            screen: 'GroupMatches',
            params: { listingId: notification.data.listing_id },
          });
        }
        break;
      case 'company_group_invite':
        if (notification.data?.listingId && notification.data?.groupId) {
          (navigation as any).navigate('Groups', {
            screen: 'CompanyGroupInvite',
            params: {
              listingId: notification.data.listingId,
              groupId: notification.data.groupId,
            },
          });
        } else {
          (navigation as any).navigate('Groups');
        }
        break;
      case 'meetup_suggestion':
        if (notification.data?.conversationId) {
          (navigation as any).navigate('Messages', {
            screen: 'Chat',
            params: { conversationId: notification.data.conversationId },
          });
        }
        break;
      case 'background_check':
        (navigation as any).navigate('Profile', {
          screen: 'BackgroundCheck',
        });
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
      case 'agent_invite':
        return 'briefcase';
      case 'group_invite':
      case 'group_accepted':
      case 'company_group_invite':
        return 'users';
      case 'property_update':
      case 'property_rented':
        return 'home';
      case 'application_status':
        return 'file-text';
      case 'background_check':
        return 'shield';
      case 'ai_group_suggestion':
        return 'cpu';
      case 'meetup_suggestion':
        return 'coffee';
      case 'group_complete':
      case 'group_match':
        return 'check-circle';
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

  const handleAgentInviteResponse = async (notification: Notification, accept: boolean) => {
    const inviteId = notification.data?.agentInviteId;
    if (!inviteId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await respondToInvite(inviteId, accept);
    setNotifications(prev =>
      prev.map(n =>
        n.id === notification.id
          ? { ...n, isRead: true, body: accept ? 'You accepted this group invite' : 'You declined this group invite' }
          : n
      )
    );
    await refreshUnreadCount();
  };

  const renderAgentInviteCard = (item: Notification) => {
    const members = item.data?.groupMembers ?? [];
    const alreadyResponded = item.body?.includes('accepted') || item.body?.includes('declined');

    return (
      <View
        style={[styles.notificationCard, { backgroundColor: '#1a1a2e', borderColor: 'rgba(255,107,91,0.2)', borderWidth: 1 }]}
      >
        <View style={styles.notificationContent}>
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,107,91,0.2)' }]}>
            <Feather name="briefcase" size={20} color="#ff6b5b" />
          </View>
          <View style={styles.textContainer}>
            <ThemedText style={[Typography.body, { fontWeight: '700' }]}>
              {item.title}
            </ThemedText>
            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: 4 }]}>
              {item.body}
            </ThemedText>
            {item.data?.listingTitle ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
                <Feather name="home" size={14} color="#888" />
                <ThemedText style={[Typography.caption, { color: '#ccc' }]}>
                  {item.data.listingTitle}
                  {item.data.listingRent ? ` - $${item.data.listingRent.toLocaleString()}/mo` : ''}
                </ThemedText>
              </View>
            ) : null}
            {members.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {members.slice(0, 4).map(m => (
                  <View key={m.id} style={{ backgroundColor: '#333', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <ThemedText style={{ fontSize: 11, color: '#ccc' }}>{m.name.split(' ')[0]}</ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: 6, opacity: 0.7 }]}>
              {getTimeSince(item.createdAt)}
            </ThemedText>
          </View>
        </View>

        {!alreadyResponded ? (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, paddingLeft: 52 }}>
            <Pressable
              style={{ flex: 1, backgroundColor: '#ff6b5b', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}
              onPress={() => handleAgentInviteResponse(item, true)}
            >
              <ThemedText style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Accept</ThemedText>
            </Pressable>
            <Pressable
              style={{ flex: 1, backgroundColor: '#333', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}
              onPress={() => handleAgentInviteResponse(item, false)}
            >
              <ThemedText style={{ color: '#aaa', fontWeight: '600', fontSize: 14 }}>Decline</ThemedText>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    if (item.type === 'agent_invite') {
      return renderAgentInviteCard(item);
    }

    return (
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
  };

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

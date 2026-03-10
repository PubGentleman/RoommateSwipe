import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import type { Conversation, Message, Match, Group, Property, Notification } from '../../types/models';
import { supabase } from '../../lib/supabase';

export const DownloadDataScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchFromSupabase = async () => {
    const userId = user?.id;
    if (!userId) return null;

    const [
      { data: userData },
      { data: profileData },
      { data: matchesData },
      { data: messagesData },
      { data: groupsData },
      { data: notificationsData },
      { data: listingsData },
      { data: interestCardsData },
    ] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).single(),
      supabase.from('profiles').select('*').eq('user_id', userId).single(),
      supabase.from('matches').select('*').or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`),
      supabase.from('messages').select('*').eq('sender_id', userId),
      supabase.from('group_members').select('group_id').eq('user_id', userId).then(async ({ data: memberships }) => {
        if (!memberships || memberships.length === 0) return { data: [] };
        const ids = memberships.map(m => m.group_id);
        return supabase.from('groups').select('*').in('id', ids);
      }),
      supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
      supabase.from('listings').select('*').eq('host_id', userId),
      supabase.from('interest_cards').select('*').or(`sender_id.eq.${userId},recipient_id.eq.${userId}`),
    ]);

    return {
      user: userData,
      profile: profileData,
      matches: matchesData || [],
      messages: messagesData || [],
      groups: groupsData || [],
      notifications: notificationsData || [],
      listings: listingsData || [],
      interestCards: interestCardsData || [],
    };
  };

  const handleDownloadData = async () => {
    setIsGenerating(true);
    
    try {
      let exportData: any;

      try {
        const supabaseData = await fetchFromSupabase();
        if (supabaseData && supabaseData.user) {
          exportData = {
            exportDate: new Date().toISOString(),
            userData: {
              id: supabaseData.user.id,
              email: supabaseData.user.email,
              name: supabaseData.user.full_name,
              role: supabaseData.user.role,
            },
            profile: supabaseData.profile || {},
            matches: supabaseData.matches,
            messages: supabaseData.messages,
            groups: supabaseData.groups,
            notifications: supabaseData.notifications,
            listings: supabaseData.listings,
            interestCards: supabaseData.interestCards,
          };
        }
      } catch (supabaseError) {
        console.log('[DownloadData] Supabase fetch failed, falling back to StorageService:', supabaseError);
      }

      if (!exportData) {
        const [conversations, matches, groups, properties, notifications] = await Promise.all([
          StorageService.getConversations(),
          StorageService.getMatches(),
          StorageService.getGroups(),
          StorageService.getProperties(),
          StorageService.getNotifications(user?.id || ''),
        ]);

        exportData = {
          exportDate: new Date().toISOString(),
          userData: {
            id: user?.id,
            email: user?.email,
            name: user?.name,
            role: user?.role,
            subscription: user?.subscription,
            profileData: user?.profileData,
            boostData: user?.boostData,
            rewindData: user?.rewindData,
          },
          conversations: conversations || [],
          matches: matches?.filter((m: Match) => 
            m.userId1 === user?.id || m.userId2 === user?.id
          ) || [],
          groups: groups || [],
          properties: properties?.filter((p: Property) => 
            p.hostId === user?.id
          ) || [],
          notifications: notifications?.filter((n: Notification) => 
            n.userId === user?.id
          ) || [],
        };
      }

      const dataString = JSON.stringify(exportData, null, 2);
      const itemCounts = {
        conversations: exportData.conversations?.length || 0,
        matches: exportData.matches?.length || 0,
        groups: exportData.groups?.length || 0,
        properties: exportData.properties?.length || exportData.listings?.length || 0,
        notifications: exportData.notifications?.length || 0,
      };
      
      Alert.alert(
        'Data Export Ready',
        `Your data has been prepared (${Math.round(dataString.length / 1024)}KB). In a production app, this would be downloaded as a JSON file.\n\nIncludes:\n• Profile information\n• Matches (${itemCounts.matches})\n• Groups (${itemCounts.groups})\n• Properties (${itemCounts.properties})\n• Notifications (${itemCounts.notifications})`,
        [
          {
            text: 'OK',
            style: 'default',
          }
        ]
      );
      
      console.log('[DownloadData] Export prepared:', {
        size: dataString.length,
        ...itemCounts,
      });
      
    } catch (error) {
      console.error('[DownloadData] Error:', error);
      Alert.alert('Error', 'Failed to generate data export. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const DataItem = ({ icon, title, description }: { icon: string; title: string; description: string }) => (
    <View style={[styles.dataItem, { backgroundColor: '#1a1a1a', borderColor: '#333333' }]}>
      <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
        <Feather name={icon as any} size={20} color={theme.primary} />
      </View>
      <View style={styles.dataItemContent}>
        <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
          {title}
        </ThemedText>
        <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
          {description}
        </ThemedText>
      </View>
    </View>
  );

  return (
    <ScreenScrollView style={{ backgroundColor: '#111111' }} contentContainerStyle={{ paddingTop: Spacing.xl, backgroundColor: '#111111' }}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: theme.primary + '20' }]}>
          <Feather name="download" size={32} color={theme.primary} />
        </View>
        <ThemedText style={[Typography.h2, { textAlign: 'center', marginTop: Spacing.lg }]}>
          Download Your Data
        </ThemedText>
        <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginTop: Spacing.sm }]}>
          Get a copy of all your Roomdr data in JSON format
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>
          What's Included
        </ThemedText>
        
        <DataItem
          icon="user"
          title="Profile Information"
          description="Your personal details, bio, preferences, and profile settings"
        />
        
        <DataItem
          icon="message-circle"
          title="Conversations"
          description="Your conversation threads and chat history"
        />
        
        <DataItem
          icon="heart"
          title="Matches & Connections"
          description="Your roommate matches and connection history"
        />
        
        <DataItem
          icon="users"
          title="Groups"
          description="Groups you've created or joined"
        />
        
        <DataItem
          icon="home"
          title="Properties"
          description="Saved properties and listings you've created"
        />
        
        <DataItem
          icon="bell"
          title="Notifications"
          description="Your notification history and preferences"
        />
      </View>

      <View style={[styles.infoBox, { backgroundColor: theme.primary + '10', borderColor: theme.primary }]}>
        <Feather name="info" size={20} color={theme.primary} />
        <ThemedText style={[Typography.small, { marginLeft: Spacing.sm, flex: 1, color: theme.text }]}>
          Your data will be exported in JSON format, which can be viewed in any text editor or JSON viewer.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>
          Privacy & Security
        </ThemedText>
        
        <View style={[styles.privacyItem, { backgroundColor: '#1a1a1a' }]}>
          <Feather name="lock" size={16} color={theme.success} />
          <ThemedText style={[Typography.small, { marginLeft: Spacing.sm, flex: 1 }]}>
            Your data is securely packaged and never shared with third parties
          </ThemedText>
        </View>
        
        <View style={[styles.privacyItem, { backgroundColor: '#1a1a1a' }]}>
          <Feather name="shield" size={16} color={theme.success} />
          <ThemedText style={[Typography.small, { marginLeft: Spacing.sm, flex: 1 }]}>
            Exports are generated on-demand and not stored on our servers
          </ThemedText>
        </View>
        
        <View style={[styles.privacyItem, { backgroundColor: '#1a1a1a' }]}>
          <Feather name="file-text" size={16} color={theme.success} />
          <ThemedText style={[Typography.small, { marginLeft: Spacing.sm, flex: 1 }]}>
            All personal information is included as per GDPR requirements
          </ThemedText>
        </View>
      </View>

      <Pressable
        style={[styles.downloadButton, { 
          backgroundColor: isGenerating ? theme.backgroundSecondary : theme.primary,
          opacity: isGenerating ? 0.6 : 1,
        }]}
        onPress={handleDownloadData}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <>
            <Feather name="loader" size={20} color="#FFFFFF" />
            <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600', marginLeft: Spacing.sm }]}>
              Generating Export...
            </ThemedText>
          </>
        ) : (
          <>
            <Feather name="download" size={20} color="#FFFFFF" />
            <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600', marginLeft: Spacing.sm }]}>
              Download My Data
            </ThemedText>
          </>
        )}
      </Pressable>

      <ThemedText style={[Typography.small, { textAlign: 'center', color: theme.textSecondary, marginTop: Spacing.md }]}>
        Questions about your data? Contact support@roomdr.app
      </ThemedText>
    </ScreenScrollView>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: Spacing.xl,
  },
  dataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  dataItemContent: {
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  privacyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.small,
    marginBottom: Spacing.sm,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    marginTop: Spacing.lg,
  },
});

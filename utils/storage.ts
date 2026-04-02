import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, RoommateProfile, Property, Group, Conversation, Message, Match, Application, Notification, InterestCard, HostSubscriptionData, ListingBoost } from '../types/models';
import { getDefaultHostSubscription } from './hostPricing';
import { shouldLoadMockData } from './dataUtils';

let _mockDataInitialized = false;

const STORAGE_KEYS = {
  CURRENT_USER: '@rhome/current_user',
  USERS: '@rhome/users',
  ROOMMATE_PROFILES: '@rhome/roommate_profiles',
  PROPERTIES: '@rhome/properties',
  GROUPS: '@rhome/groups',
  CONVERSATIONS: '@rhome/conversations',
  MATCHES: '@rhome/matches',
  APPLICATIONS: '@rhome/applications',
  SWIPE_HISTORY: '@rhome/swipe_history',
  LIKES: '@rhome/likes',
  SAVED_PROPERTIES: '@rhome/saved_properties',
  NOTIFICATIONS: '@rhome/notifications',
  MOCK_DATA_VERSION: '@rhome/mock_data_version',
  ONBOARDING_COMPLETED: '@rhome/onboarding_completed',
  INTEREST_CARDS: '@rhome/interestCards',
  GROUP_LIKES: '@rhome/group_likes',
  HOST_SUBSCRIPTIONS: '@rhome/host_subscriptions',
  GROUP_INVITES: '@rhome/group_invites',
};

let notificationIdCounter = 0;
const generateNotificationId = (): string => {
  const timestamp = Date.now();
  const counter = notificationIdCounter++;
  const random = Math.floor(Math.random() * 1000);
  return `notif-${timestamp}-${counter}-${random}`;
};

export const StorageService = {
  async getCurrentUser(): Promise<User | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },

  async setCurrentUser(user: User | null): Promise<void> {
    try {
      if (user) {
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
    } catch (error) {
      console.error('Error setting current user:', error);
    }
  },

  async seedInitialMatches(currentUserId: string): Promise<void> {
    try {
      const existingMatches = await this.getMatches();
      const userMatches = existingMatches.filter(
        m => m.userId1 === currentUserId || m.userId2 === currentUserId
      );
      if (userMatches.length > 0) return;
      
      const newMatches: Match[] = [
        {
          id: `match_${currentUserId}_1`,
          userId1: currentUserId,
          userId2: '1',
          matchedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          id: `match_${currentUserId}_2`,
          userId1: currentUserId,
          userId2: '2',
          matchedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      ];
      
      const allMatches = [...existingMatches, ...newMatches];
      await this.setMatches(allMatches);
    } catch (error) {
      console.error('Error seeding initial matches:', error);
    }
  },

  async getUsers(): Promise<User[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USERS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting users:', error);
      return [];
    }
  },

  async addOrUpdateUser(user: User): Promise<void> {
    try {
      const users = await this.getUsers();
      const index = users.findIndex(u => u.id === user.id);
      if (index >= 0) {
        users[index] = user;
      } else {
        users.push(user);
      }
      console.log('[StorageService] Saving user:', user.id, 'has profileData:', !!user.profileData, 'has profilePicture:', !!user.profilePicture);
      const serialized = JSON.stringify(users);
      await AsyncStorage.setItem(STORAGE_KEYS.USERS, serialized);
      
      // Verify the data was saved correctly
      const retrieved = await AsyncStorage.getItem(STORAGE_KEYS.USERS);
      const parsed = retrieved ? JSON.parse(retrieved) : [];
      const savedUser = parsed.find((u: User) => u.id === user.id);
      console.log('[StorageService] Retrieved user after save:', user.id, 'has profileData:', !!savedUser?.profileData, 'has profilePicture:', !!savedUser?.profilePicture);
    } catch (error) {
      console.error('Error adding/updating user:', error);
    }
  },

  async getRoommateProfiles(): Promise<RoommateProfile[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ROOMMATE_PROFILES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting roommate profiles:', error);
      return [];
    }
  },

  async setRoommateProfiles(profiles: RoommateProfile[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ROOMMATE_PROFILES, JSON.stringify(profiles));
    } catch (error) {
      console.error('Error setting roommate profiles:', error);
    }
  },

  async getProperties(): Promise<Property[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PROPERTIES);
      if (!data) return [];
      const raw = JSON.parse(data);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let needsSave = false;
      const properties = raw.map((p: any) => {
        const parsed = {
          ...p,
          propertyType: p.propertyType || 'lease',
          roomType: p.roomType || 'entire',
          existingRoommates: p.existingRoommates || [],
          availableDate: p.availableDate ? new Date(p.availableDate) : undefined,
          rentedDate: p.rentedDate ? new Date(p.rentedDate) : undefined,
        };
        if (!parsed.available && parsed.availableDate && !parsed.is_rented) {
          const avail = new Date(parsed.availableDate);
          avail.setHours(0, 0, 0, 0);
          if (avail <= today) {
            parsed.available = true;
            needsSave = true;
          }
        }
        return parsed;
      });
      if (needsSave) {
        await AsyncStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(properties));
      }
      return properties;
    } catch (error) {
      console.error('Error getting properties:', error);
      return [];
    }
  },

  async setProperties(properties: Property[]): Promise<void> {
    try {
      const normalizedProperties = properties.map(p => ({
        ...p,
        propertyType: p.propertyType || 'lease',
        roomType: p.roomType || 'entire',
        existingRoommates: p.existingRoommates || [],
      }));
      await AsyncStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(normalizedProperties));
    } catch (error) {
      console.error('Error setting properties:', error);
    }
  },

  async addOrUpdateProperty(property: Property): Promise<void> {
    try {
      const normalizedProperty = {
        ...property,
        propertyType: property.propertyType || 'lease',
        roomType: property.roomType || 'entire',
        existingRoommates: property.existingRoommates || [],
      };
      const properties = await this.getProperties();
      const index = properties.findIndex(p => p.id === normalizedProperty.id);
      if (index >= 0) {
        properties[index] = normalizedProperty;
      } else {
        properties.push(normalizedProperty);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(properties));
    } catch (error) {
      console.error('Error adding/updating property:', error);
    }
  },

  async assignPropertiesToHost(userId: string, userName: string): Promise<void> {
    try {
      const properties = await this.getProperties();
      const myProperties = properties.filter(p => p.hostId === userId);
      if (myProperties.length > 0) return;
      const unassigned = properties.filter(p => !p.hostId || /^\d+$/.test(p.hostId));
      const toAssign = unassigned.slice(0, Math.min(6, unassigned.length));
      if (toAssign.length === 0) return;
      const updated = properties.map(p => {
        if (toAssign.find(t => t.id === p.id)) {
          return { ...p, hostId: userId, hostName: userName };
        }
        return p;
      });
      await this.setProperties(updated);
    } catch (error) {
      console.error('Error assigning properties to host:', error);
    }
  },

  async deleteProperty(propertyId: string): Promise<void> {
    try {
      const properties = await this.getProperties();
      const filtered = properties.filter(p => p.id !== propertyId);
      await AsyncStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting property:', error);
    }
  },

  async markPropertyAsRented(propertyId: string): Promise<void> {
    try {
      const properties = await this.getProperties();
      const property = properties.find(p => p.id === propertyId);
      if (!property) return;

      const rentedDate = new Date();
      property.available = false;
      property.rentedDate = rentedDate;
      await this.setProperties(properties);

      const users = await this.getUsers();
      for (const user of users) {
        const savedProperties = await this.getSavedProperties(user.id);
        if (savedProperties.includes(propertyId)) {
          await this.addNotification({
            id: generateNotificationId(),
            userId: user.id,
            type: 'property_rented',
            title: 'Property Rented',
            body: `${property.title} has been rented and is no longer available`,
            isRead: false,
            createdAt: new Date(),
            data: {
              propertyId: property.id,
            },
          });
        }
      }
    } catch (error) {
      console.error('Error marking property as rented:', error);
    }
  },

  async markPropertyAsAvailable(propertyId: string): Promise<void> {
    try {
      const properties = await this.getProperties();
      const property = properties.find(p => p.id === propertyId);
      if (!property) return;

      property.available = true;
      property.rentedDate = undefined;
      await this.setProperties(properties);
    } catch (error) {
      console.error('Error marking property as available:', error);
    }
  },

  async notifyPropertyEvent(
    propertyId: string,
    type: 'property_update' | 'property_rented',
    title: string,
    body: string,
  ): Promise<void> {
    try {
      const users = await this.getUsers();
      const cards = await this.getInterestCards();
      const inquirerIds = new Set(
        cards
          .filter(c => c.propertyId === propertyId && (c.status === 'pending' || c.status === 'accepted'))
          .map(c => c.renterId)
      );
      for (const user of users) {
        const saved = await this.getSavedProperties(user.id);
        if (saved.includes(propertyId) || inquirerIds.has(user.id)) {
          await this.addNotification({
            id: generateNotificationId(),
            userId: user.id,
            type,
            title,
            body,
            isRead: false,
            createdAt: new Date(),
            data: { propertyId },
          });
        }
      }
    } catch (error) {
      console.error('Error sending property event notification:', error);
    }
  },

  async getVisibleRenterGroups(): Promise<any[]> {
    try {
      const groups = await this.getGroups();
      const roommateGroups = groups.filter(g =>
        (g.type === 'roommate' || !g.type) &&
        g.is_visible_to_hosts !== false
      );
      const profiles = await this.getRoommateProfiles();
      return roommateGroups
        .filter(g => !g.isArchived)
        .map(g => {
          const memberIds: string[] = Array.isArray(g.members)
            ? g.members.map((m: any) => typeof m === 'string' ? m : m.userId || m.id)
            : [];
          const memberPhotos: string[] = memberIds
            .map(uid => {
              const gm = Array.isArray(g.members) ? g.members.find((m: any) => (typeof m === 'object' && (m.userId === uid || m.id === uid))) : null;
              if (typeof gm === 'object' && gm?.user?.avatar_url) return gm.user.avatar_url;
              const profile = profiles.find(p => p.userId === uid);
              if (profile?.photos?.[0]) return profile.photos[0];
              return '';
            })
            .filter(Boolean);
          return {
            groupId: g.id,
            name: g.name || 'Roommate Group',
            description: g.description || '',
            memberCount: g.members?.length || 2,
            maxMembers: g.maxMembers || 4,
            budgetMin: g.budgetMin ?? 1500,
            budgetMax: g.budgetMax ?? 2500,
            moveInDate: g.moveInDate ?? 'Flexible',
            location: g.preferredLocation || g.city || '',
            neighborhoods: [],
            lifestyleTags: [],
            occupationTypes: [],
            memberPhotos,
            createdAt: g.createdAt instanceof Date ? g.createdAt.toISOString() : g.createdAt,
          };
        });
    } catch (error) {
      console.error('Error getting visible renter groups:', error);
      return [];
    }
  },

  async getGroups(): Promise<Group[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.GROUPS);
      if (!data) return [];
      const groups = JSON.parse(data);
      return groups.map((group: any) => ({
        ...group,
        createdAt: new Date(group.createdAt),
      }));
    } catch (error) {
      console.error('Error getting groups:', error);
      return [];
    }
  },

  async setGroups(groups: Group[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    } catch (error) {
      console.error('Error setting groups:', error);
    }
  },

  async addOrUpdateGroup(group: Group): Promise<void> {
    try {
      const groups = await this.getGroups();
      const index = groups.findIndex(g => g.id === group.id);
      if (index >= 0) {
        groups[index] = group;
      } else {
        groups.push(group);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    } catch (error) {
      console.error('Error adding/updating group:', error);
    }
  },

  async likeGroup(groupId: string, userId: string): Promise<void> {
    try {
      const groups = await this.getGroups();
      const group = groups.find(g => g.id === groupId);
      if (group && !group.pendingMembers.includes(userId) && !group.members.includes(userId)) {
        group.pendingMembers.push(userId);
        await this.setGroups(groups);
      }
    } catch (error) {
      console.error('Error liking group:', error);
    }
  },

  async unlikeGroup(groupId: string, userId: string): Promise<void> {
    try {
      const groups = await this.getGroups();
      const group = groups.find(g => g.id === groupId);
      if (group) {
        group.pendingMembers = group.pendingMembers.filter(id => id !== userId);
        await this.setGroups(groups);
      }
    } catch (error) {
      console.error('Error unliking group:', error);
    }
  },

  async getGroupLikes(): Promise<any[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.GROUP_LIKES);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  },

  async setGroupLikes(likes: any[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.GROUP_LIKES, JSON.stringify(likes));
    } catch (error) {
      console.error('Error saving group likes:', error);
    }
  },

  async addGroupLike(groupId: string, userId: string): Promise<void> {
    const likes = await this.getGroupLikes();
    const existing = likes.find((l: any) => l.group_id === groupId && l.user_id === userId);
    if (!existing) {
      likes.push({
        id: `gl-${Date.now()}`,
        group_id: groupId,
        user_id: userId,
        admin_liked_back: false,
        dismissed: false,
        created_at: new Date().toISOString(),
      });
      await this.setGroupLikes(likes);
    }
  },

  async removeGroupLike(groupId: string, userId: string): Promise<void> {
    const likes = await this.getGroupLikes();
    await this.setGroupLikes(likes.filter((l: any) => !(l.group_id === groupId && l.user_id === userId)));
  },

  async getGroupLikesForUser(userId: string): Promise<any[]> {
    const likes = await this.getGroupLikes();
    return likes.filter((l: any) => l.user_id === userId && !l.dismissed);
  },

  async getGroupLikersForGroup(groupId: string): Promise<any[]> {
    const likes = await this.getGroupLikes();
    const groupLikes = likes.filter((l: any) => l.group_id === groupId && !l.dismissed);
    const profiles = await this.getRoommateProfiles();
    const users = await this.getUsers();
    return groupLikes.map((l: any) => {
      const profile = profiles.find(p => p.id === l.user_id);
      const u = users.find(u => u.id === l.user_id);
      return {
        likeId: l.id,
        userId: l.user_id,
        name: profile?.name || u?.fullName || 'Unknown',
        age: profile?.age || 0,
        bio: profile?.bio || '',
        avatarUrl: profile?.photos?.[0] || u?.profilePicture || null,
        zodiacSign: profile?.zodiacSign || '',
        gender: profile?.gender || '',
        verified: !!(profile?.verification && Object.values(profile.verification).some(Boolean)),
        occupation: profile?.occupation || '',
        likedAt: l.created_at,
        adminLikedBack: l.admin_liked_back,
      };
    });
  },

  async adminLikeBackLocal(groupId: string, userId: string): Promise<void> {
    const likes = await this.getGroupLikes();
    const like = likes.find((l: any) => l.group_id === groupId && l.user_id === userId);
    if (like) {
      like.admin_liked_back = true;
      like.liked_back_at = new Date().toISOString();
      await this.setGroupLikes(likes);
    }
  },

  async dismissGroupLikerLocal(groupId: string, userId: string): Promise<void> {
    const likes = await this.getGroupLikes();
    const like = likes.find((l: any) => l.group_id === groupId && l.user_id === userId);
    if (like) {
      like.dismissed = true;
      await this.setGroupLikes(likes);
    }
  },

  async getGroupLikeCount(groupId: string): Promise<number> {
    const likes = await this.getGroupLikes();
    return likes.filter((l: any) => l.group_id === groupId && !l.admin_liked_back && !l.dismissed).length;
  },

  async acceptGroupMember(groupId: string, userId: string): Promise<boolean> {
    try {
      const groups = await this.getGroups();
      const group = groups.find(g => g.id === groupId);
      if (group) {
        const joinedGroups = groups.filter(
          g => g.members.includes(userId) && g.createdBy !== userId
        );
        
        if (joinedGroups.length >= 1) {
          group.pendingMembers = group.pendingMembers.filter(id => id !== userId);
          await this.setGroups(groups);
          return false;
        }
        
        const users = await this.getUsers();
        const newMember = users.find(u => u.id === userId);
        const existingMembers = [...group.members];
        const interestedUsers = [...group.pendingMembers.filter(
          id => id !== userId && !group.members.includes(id)
        )];
        
        group.pendingMembers = group.pendingMembers.filter(id => id !== userId);
        if (!group.members.includes(userId) && group.members.length < group.maxMembers) {
          group.members.push(userId);
        }
        await this.setGroups(groups);
        
        const newMemberName = newMember?.name || 'A new member';
        
        for (const memberId of existingMembers) {
          if (memberId !== userId) {
            await this.addNotification({
              id: generateNotificationId(),
              userId: memberId,
              type: 'group_accepted',
              title: 'New Group Member',
              body: `${newMemberName} joined ${group.name}`,
              isRead: false,
              createdAt: new Date(),
              data: {
                groupId: group.id,
                fromUserId: userId,
                fromUserName: newMemberName,
              },
            });
          }
        }
        
        for (const interestedUserId of interestedUsers) {
          await this.addNotification({
            id: generateNotificationId(),
            userId: interestedUserId,
            type: 'group_accepted',
            title: 'Group Update',
            body: `${newMemberName} joined ${group.name} that you're interested in`,
            isRead: false,
            createdAt: new Date(),
            data: {
              groupId: group.id,
              fromUserId: userId,
              fromUserName: newMemberName,
            },
          });
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error accepting group member:', error);
      return false;
    }
  },

  async rejectGroupMember(groupId: string, userId: string): Promise<void> {
    try {
      const groups = await this.getGroups();
      const group = groups.find(g => g.id === groupId);
      if (group) {
        group.pendingMembers = group.pendingMembers.filter(id => id !== userId);
        await this.setGroups(groups);
      }
    } catch (error) {
      console.error('Error rejecting group member:', error);
    }
  },

  async leaveGroup(groupId: string, userId: string): Promise<void> {
    try {
      const groups = await this.getGroups();
      const group = groups.find(g => g.id === groupId);
      if (group) {
        group.members = group.members.filter(id => id !== userId);
        await this.setGroups(groups);
      }
    } catch (error) {
      console.error('Error leaving group:', error);
    }
  },

  async removeMemberFromGroup(groupId: string, userId: string): Promise<void> {
    try {
      const groups = await this.getGroups();
      const group = groups.find(g => g.id === groupId);
      if (group) {
        group.members = group.members.filter(id => id !== userId);
        await this.setGroups(groups);
      }
    } catch (error) {
      console.error('Error removing member from group:', error);
    }
  },

  async sendGroupInvite(invite: {
    groupId: string;
    groupName: string;
    invitedUserId: string;
    invitedByUserId: string;
    invitedByName: string;
    createdAt: string;
  }): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.GROUP_INVITES);
      const invites = data ? JSON.parse(data) : [];
      const existing = invites.find((i: any) =>
        i.groupId === invite.groupId && i.invitedUserId === invite.invitedUserId && i.status === 'pending'
      );
      if (existing) return;
      invites.push({ ...invite, id: `ginv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`, status: 'pending' });
      await AsyncStorage.setItem(STORAGE_KEYS.GROUP_INVITES, JSON.stringify(invites));

      await this.addNotification({
        id: generateNotificationId(),
        userId: invite.invitedUserId,
        type: 'group_invite',
        title: 'Group Invite',
        body: `${invite.invitedByName} invited you to join "${invite.groupName}"`,
        isRead: false,
        createdAt: new Date(),
        data: { groupId: invite.groupId, fromUserId: invite.invitedByUserId, fromUserName: invite.invitedByName },
      });
    } catch (error) {
      console.error('Error sending group invite:', error);
    }
  },

  async getPendingGroupInvites(userId: string): Promise<any[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.GROUP_INVITES);
      if (!data) return [];
      const invites = JSON.parse(data);
      return invites.filter((i: any) => i.invitedUserId === userId && i.status === 'pending');
    } catch (error) {
      console.error('Error getting pending group invites:', error);
      return [];
    }
  },

  async respondToGroupInvite(inviteId: string, accept: boolean): Promise<{ groupId: string } | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.GROUP_INVITES);
      if (!data) return null;
      const invites = JSON.parse(data);
      const invite = invites.find((i: any) => i.id === inviteId);
      if (!invite) return null;
      invite.status = accept ? 'accepted' : 'declined';
      await AsyncStorage.setItem(STORAGE_KEYS.GROUP_INVITES, JSON.stringify(invites));

      if (accept) {
        const groups = await this.getGroups();
        const group = groups.find((g: Group) => g.id === invite.groupId);
        if (group) {
          if (group.members.length >= group.maxMembers) {
            invite.status = 'pending';
            await AsyncStorage.setItem(STORAGE_KEYS.GROUP_INVITES, JSON.stringify(invites));
            return null;
          }
          if (!group.members.includes(invite.invitedUserId)) {
            group.members.push(invite.invitedUserId);
            await this.setGroups(groups);
          }
        }
      }
      return { groupId: invite.groupId };
    } catch (error) {
      console.error('Error responding to group invite:', error);
      return null;
    }
  },

  async getConversations(): Promise<Conversation[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      if (!data) return [];
      const conversations = JSON.parse(data);
      return conversations.map((conv: any) => ({
        ...conv,
        timestamp: new Date(conv.timestamp),
        messages: (conv.messages || []).map((msg: any) => ({
          ...msg,
          text: msg.text || msg.content || '',
          content: msg.content || msg.text || '',
          timestamp: new Date(msg.timestamp),
        })),
      }));
    } catch (error) {
      console.error('Error getting conversations:', error);
      return [];
    }
  },

  async setConversations(conversations: Conversation[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
    } catch (error) {
      console.error('Error setting conversations:', error);
    }
  },

  async addOrUpdateConversation(conversation: Conversation): Promise<void> {
    try {
      const conversations = await this.getConversations();
      const index = conversations.findIndex(c => c.id === conversation.id);
      if (index >= 0) {
        conversations[index] = conversation;
      } else {
        conversations.push(conversation);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
    } catch (error) {
      console.error('Error adding/updating conversation:', error);
    }
  },

  async updateConversation(conversationId: string, updates: Partial<Conversation>): Promise<void> {
    try {
      const conversations = await this.getConversations();
      const index = conversations.findIndex(c => c.id === conversationId);
      if (index >= 0) {
        conversations[index] = { ...conversations[index], ...updates };
        await AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
      }
    } catch (error) {
      console.error('Error updating conversation:', error);
    }
  },

  async getMatches(): Promise<Match[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.MATCHES);
      if (!data) return [];
      const matches = JSON.parse(data);
      return matches.map((match: any) => ({
        ...match,
        matchedAt: new Date(match.matchedAt),
      }));
    } catch (error) {
      console.error('Error getting matches:', error);
      return [];
    }
  },

  async setMatches(matches: Match[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.MATCHES, JSON.stringify(matches));
    } catch (error) {
      console.error('Error setting matches:', error);
    }
  },

  async addMatch(match: Match): Promise<void> {
    try {
      const matches = await this.getMatches();
      matches.push(match);
      await AsyncStorage.setItem(STORAGE_KEYS.MATCHES, JSON.stringify(matches));
    } catch (error) {
      console.error('Error adding match:', error);
    }
  },

  async removeMatch(userId1: string, userId2: string): Promise<void> {
    try {
      const matches = await this.getMatches();
      const filteredMatches = matches.filter(
        m => !((m.userId1 === userId1 && m.userId2 === userId2) || 
               (m.userId1 === userId2 && m.userId2 === userId1))
      );
      await AsyncStorage.setItem(STORAGE_KEYS.MATCHES, JSON.stringify(filteredMatches));
    } catch (error) {
      console.error('Error removing match:', error);
    }
  },

  async getApplications(): Promise<Application[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.APPLICATIONS);
      if (!data) return [];
      const applications = JSON.parse(data);
      return applications.map((app: any) => ({
        ...app,
        submittedDate: app.submittedDate ? new Date(app.submittedDate) : (app.submittedAt ? new Date(app.submittedAt) : new Date()),
      }));
    } catch (error) {
      console.error('Error getting applications:', error);
      return [];
    }
  },

  async setApplications(applications: Application[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(applications));
    } catch (error) {
      console.error('Error setting applications:', error);
    }
  },

  async addOrUpdateApplication(application: Application): Promise<void> {
    try {
      const applications = await this.getApplications();
      const index = applications.findIndex(a => a.id === application.id);
      if (index >= 0) {
        applications[index] = application;
      } else {
        applications.push(application);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(applications));
    } catch (error) {
      console.error('Error adding/updating application:', error);
    }
  },

  async consumeUndoPass(userId: string): Promise<void> {
    try {
      const users = await this.getUsers();
      const user = users.find(u => u.id === userId);
      if (user) {
        user.undoPassData = {
          hasUndoPass: false,
          undoPassExpiresAt: undefined,
        };
        await this.addOrUpdateUser(user);
      }
      
      const currentUser = await this.getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        currentUser.undoPassData = {
          hasUndoPass: false,
          undoPassExpiresAt: undefined,
        };
        await this.setCurrentUser(currentUser);
      }
    } catch (error) {
      console.error('Error consuming undo pass:', error);
    }
  },

  async getSwipeHistory(): Promise<Set<string>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SWIPE_HISTORY);
      return data ? new Set(JSON.parse(data)) : new Set();
    } catch (error) {
      console.error('Error getting swipe history:', error);
      return new Set();
    }
  },

  async addToSwipeHistory(profileId: string): Promise<void> {
    try {
      const history = await this.getSwipeHistory();
      history.add(profileId);
      await AsyncStorage.setItem(STORAGE_KEYS.SWIPE_HISTORY, JSON.stringify(Array.from(history)));
    } catch (error) {
      console.error('Error adding to swipe history:', error);
    }
  },

  async removeFromSwipeHistory(profileId: string): Promise<void> {
    try {
      const history = await this.getSwipeHistory();
      history.delete(profileId);
      await AsyncStorage.setItem(STORAGE_KEYS.SWIPE_HISTORY, JSON.stringify(Array.from(history)));
    } catch (error) {
      console.error('Error removing from swipe history:', error);
    }
  },

  async getLikes(): Promise<Record<string, string[]>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LIKES);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error getting likes:', error);
      return {};
    }
  },

  async addLike(userId: string, likedProfileId: string, isSuperLike: boolean = false): Promise<void> {
    try {
      const likes = await this.getLikes();
      if (!likes[userId]) {
        likes[userId] = [];
      }
      if (!likes[userId].includes(likedProfileId)) {
        likes[userId].push(likedProfileId);
        await AsyncStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(likes));
      }
      
      const allUsers = await this.getUsers();
      const likedUser = allUsers.find(u => u.id === likedProfileId);
      if (likedUser) {
        const currentUser = allUsers.find(u => u.id === userId);
        if (!likedUser.receivedLikes) {
          likedUser.receivedLikes = [];
        }
        if (!likedUser.receivedLikes.some((l: { likerId: string }) => l.likerId === userId)) {
          likedUser.receivedLikes.push({
            likerId: userId,
            likerName: currentUser?.name || 'Unknown',
            likerPhoto: currentUser?.profilePicture,
            likedAt: new Date(),
            isSuperLike,
          });
          await this.addOrUpdateUser(likedUser);
        }
      }
    } catch (error) {
      console.error('Error adding like:', error);
    }
  },

  async addSuperLike(userId: string, superLikerId: string, superLikerName?: string, superLikerPhoto?: string): Promise<void> {
    try {
      const allUsers = await this.getUsers();
      const targetUser = allUsers.find(u => u.id === userId);
      if (targetUser) {
        if (!targetUser.receivedSuperLikes) {
          targetUser.receivedSuperLikes = [];
        }
        if (!targetUser.receivedSuperLikes.some((sl: { superLikerId: string }) => sl.superLikerId === superLikerId)) {
          targetUser.receivedSuperLikes.push({
            superLikerId,
            superLikerName: superLikerName || 'Unknown',
            superLikerPhoto,
            superLikedAt: new Date(),
          });
          await this.addOrUpdateUser(targetUser);
        }
      }
    } catch (error) {
      console.error('Error adding super like:', error);
    }
  },

  async removeLike(userId: string, likedProfileId: string): Promise<void> {
    try {
      const likes = await this.getLikes();
      if (likes[userId]) {
        likes[userId] = likes[userId].filter(id => id !== likedProfileId);
        await AsyncStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(likes));
      }
    } catch (error) {
      console.error('Error removing like:', error);
    }
  },

  async checkReciprocalLike(userId1: string, userId2: string): Promise<boolean> {
    try {
      const likes = await this.getLikes();
      const user1Likes = likes[userId1] || [];
      const user2Likes = likes[userId2] || [];
      return user1Likes.includes(userId2) && user2Likes.includes(userId1);
    } catch (error) {
      console.error('Error checking reciprocal like:', error);
      return false;
    }
  },

  async clearUserData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.CURRENT_USER,
        STORAGE_KEYS.SWIPE_HISTORY,
        STORAGE_KEYS.MATCHES,
        STORAGE_KEYS.LIKES,
      ]);
    } catch (error) {
      console.error('Error clearing user data:', error);
    }
  },

  async clearAllData(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      if (allKeys.length > 0) {
        await AsyncStorage.multiRemove(allKeys as string[]);
      }
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  },

  async logoutAndReset(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.CURRENT_USER,
        STORAGE_KEYS.SWIPE_HISTORY,
        STORAGE_KEYS.MATCHES,
        STORAGE_KEYS.LIKES,
        STORAGE_KEYS.CONVERSATIONS,
        STORAGE_KEYS.NOTIFICATIONS,
        STORAGE_KEYS.SAVED_PROPERTIES,
        STORAGE_KEYS.APPLICATIONS,
      ]);
    } catch (error) {
      console.error('Error during logout reset:', error);
    }
  },

  async clearSwipeHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.SWIPE_HISTORY);
    } catch (error) {
      console.error('Error clearing swipe history:', error);
    }
  },

  async getSavedProperties(userId: string): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_PROPERTIES);
      const allSaved: Record<string, string[]> = data ? JSON.parse(data) : {};
      return allSaved[userId] || [];
    } catch (error) {
      console.error('Error getting saved properties:', error);
      return [];
    }
  },

  async saveProperty(userId: string, propertyId: string): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_PROPERTIES);
      const allSaved: Record<string, string[]> = data ? JSON.parse(data) : {};
      const userSaved = allSaved[userId] || [];
      if (!userSaved.includes(propertyId)) {
        userSaved.push(propertyId);
        allSaved[userId] = userSaved;
        await AsyncStorage.setItem(STORAGE_KEYS.SAVED_PROPERTIES, JSON.stringify(allSaved));
      }
    } catch (error) {
      console.error('Error saving property:', error);
    }
  },

  async unsaveProperty(userId: string, propertyId: string): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_PROPERTIES);
      const allSaved: Record<string, string[]> = data ? JSON.parse(data) : {};
      const userSaved = allSaved[userId] || [];
      allSaved[userId] = userSaved.filter(id => id !== propertyId);
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_PROPERTIES, JSON.stringify(allSaved));
    } catch (error) {
      console.error('Error unsaving property:', error);
    }
  },

  async initializeWithMockData(): Promise<void> {
    try {
      if (_mockDataInitialized) return;

      if (!shouldLoadMockData()) {
        _mockDataInitialized = true;
        return;
      }

      const { MOCK_DATA_VERSION, mockRoommateProfiles, mockProperties, mockGroups, mockProfileUsers, mockConversations, mockApplications } = await import('./mockData');
      
      const storedVersion = await AsyncStorage.getItem(STORAGE_KEYS.MOCK_DATA_VERSION);
      const versionChanged = storedVersion !== MOCK_DATA_VERSION;
      
      if (versionChanged) {
        console.log(`[StorageService] Mock data version changed (${storedVersion} → ${MOCK_DATA_VERSION}), reloading...`);
        await this.setRoommateProfiles(mockRoommateProfiles);
        await this.setProperties(mockProperties);
        await this.setGroups(mockGroups);
        await AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(mockConversations));
        await AsyncStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(mockApplications));
        
        await AsyncStorage.removeItem(STORAGE_KEYS.USERS);
        for (const profileUser of mockProfileUsers) {
          await this.addOrUpdateUser(profileUser);
        }

        const allKeys = await AsyncStorage.getAllKeys();
        const seedKeys = allKeys.filter(k => k.startsWith('@rhome/user_mock_seeded_'));
        if (seedKeys.length > 0) {
          await AsyncStorage.multiRemove(seedKeys);
        }
        
        await AsyncStorage.setItem(STORAGE_KEYS.MOCK_DATA_VERSION, MOCK_DATA_VERSION);
        _mockDataInitialized = true;
        console.log('[StorageService] ✓ Mock data reloaded due to version change');
        return;
      }
      
      const existingProperties = await this.getProperties();
      const existingProfiles = await this.getRoommateProfiles();
      const existingGroups = await this.getGroups();
      const existingUsers = await this.getUsers();
      
      const hasWalkScores = existingProperties.length > 0 && existingProperties.every(p => p.walkScore !== undefined);
      
      if (existingProperties.length > 0 && existingProfiles.length > 0 && existingGroups.length > 0 && existingUsers.length > 0 && hasWalkScores) {
        _mockDataInitialized = true;
        console.log('[StorageService] Data already initialized, skipping mock data load');
        return;
      }
      
      if (existingProperties.length > 0 && !hasWalkScores) {
        console.log('[StorageService] Detected missing walkScore data, reloading properties...');
      }
      
      console.log('[StorageService] Loading fresh mock data...');
      await this.setRoommateProfiles(mockRoommateProfiles);
      console.log(`[StorageService] ✓ Loaded ${mockRoommateProfiles.length} roommate profiles`);
      
      await this.setProperties(mockProperties);
      console.log(`[StorageService] ✓ Loaded ${mockProperties.length} properties with walk scores`);
      
      await this.setGroups(mockGroups);
      console.log(`[StorageService] ✓ Loaded ${mockGroups.length} groups`);
      
      // Only seed users if they don't exist yet
      if (existingUsers.length === 0) {
        console.log('[StorageService] No existing users found, seeding profile users...');
        for (const profileUser of mockProfileUsers) {
          await this.addOrUpdateUser(profileUser);
        }
        console.log(`[StorageService] ✓ Seeded ${mockProfileUsers.length} profile users`);
      } else {
        console.log('[StorageService] Users already exist, preserving user data');
      }
      
      await AsyncStorage.setItem(STORAGE_KEYS.MOCK_DATA_VERSION, MOCK_DATA_VERSION);
      _mockDataInitialized = true;
      console.log('[StorageService] Mock data initialization complete!');
    } catch (error) {
      console.error('Error initializing with mock data:', error);
    }
  },

  async forceReloadMockData(): Promise<void> {
    try {
      if (!shouldLoadMockData()) {
        console.log('[StorageService] Production mode — mock data reload blocked');
        return;
      }

      console.log('[StorageService] Force reloading all mock data...');
      const { mockRoommateProfiles, mockProperties, mockGroups, mockProfileUsers, mockConversations, mockApplications } = await import('./mockData');
      
      console.log(`[StorageService] Importing ${mockProperties.length} properties from mockData...`);
      
      await this.setRoommateProfiles(mockRoommateProfiles);
      console.log(`[StorageService] Loaded ${mockRoommateProfiles.length} roommate profiles`);
      
      await this.setProperties(mockProperties);
      console.log(`[StorageService] Loaded ${mockProperties.length} properties`);
      
      await this.setGroups(mockGroups);
      console.log(`[StorageService] Loaded ${mockGroups.length} groups`);

      await AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(mockConversations));
      console.log(`[StorageService] Loaded ${mockConversations.length} conversations`);

      await AsyncStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(mockApplications));
      console.log(`[StorageService] Loaded ${mockApplications.length} applications`);
      
      // Clear and reseed users
      await AsyncStorage.removeItem(STORAGE_KEYS.USERS);
      console.log('[StorageService] Cleared all users');
      for (const profileUser of mockProfileUsers) {
        await this.addOrUpdateUser(profileUser);
      }
      console.log(`[StorageService] ✓ Reseeded ${mockProfileUsers.length} profile users`);
      
      console.log('[StorageService] Mock data reload complete!');
    } catch (error) {
      console.error('Error force reloading mock data:', error);
    }
  },

  async seedUserSpecificMockData(userId: string, userName?: string, userRole?: string, hostType?: string): Promise<void> {
    if (!shouldLoadMockData()) return;
    const seedKey = `@rhome/user_mock_seeded_${userId}`;
    const alreadySeeded = await AsyncStorage.getItem(seedKey);
    if (alreadySeeded) return;

    try {
      console.log('[StorageService] Seeding user-specific mock data...');
      const now = Date.now();

      const isHost = userRole === 'host' || hostType === 'individual' || hostType === 'agent' || hostType === 'company';

      if (!isHost) {
        const groups = await this.getGroups();
        const groupsToJoin = ['1', '2', '14'];
        for (const gid of groupsToJoin) {
          const g = groups.find(gr => gr.id === gid);
          if (g && Array.isArray(g.members) && !g.members.includes(userId)) {
            (g.members as string[]).push(userId);
          }
        }
        await this.setGroups(groups);
        console.log('[StorageService] Added user to existing groups');
      }

      const existingMatches = await this.getMatches();
      if (!isHost) {
        const matchesToAdd: Match[] = [
          { id: `match-${userId.slice(0, 6)}-1`, userId1: userId, userId2: '1', matchedAt: new Date(now - 1000 * 60 * 60 * 24 * 2), matchType: 'mutual' },
          { id: `match-${userId.slice(0, 6)}-2`, userId1: userId, userId2: '2', matchedAt: new Date(now - 1000 * 60 * 60 * 24 * 3), matchType: 'mutual' },
          { id: `match-${userId.slice(0, 6)}-3`, userId1: '3', userId2: userId, matchedAt: new Date(now - 1000 * 60 * 60 * 12), matchType: 'super_interest', isSuperLike: true, superLiker: '3' },
          { id: `match-${userId.slice(0, 6)}-5`, userId1: userId, userId2: '5', matchedAt: new Date(now - 1000 * 60 * 60 * 24), matchType: 'mutual' },
          { id: `match-${userId.slice(0, 6)}-4`, userId1: '4', userId2: userId, matchedAt: new Date(now - 1000 * 60 * 60 * 6), matchType: 'mutual' },
          { id: `match-${userId.slice(0, 6)}-6`, userId1: userId, userId2: '6', matchedAt: new Date(now - 1000 * 60 * 60 * 48), matchType: 'cold' },
        ];
        for (const m of matchesToAdd) {
          if (!existingMatches.some(em => em.id === m.id)) {
            existingMatches.push(m);
          }
        }
        await this.setMatches(existingMatches);
        console.log('[StorageService] Seeded matches for conversations');
      }

      const conversations = await this.getConversations();
      if (!isHost) {
        const conversationSeeds: Conversation[] = [
          {
            id: '1', participant: { id: '1', name: 'Sarah Johnson', photo: 'https://picsum.photos/100/100?random=1', online: true },
            lastMessage: 'That sounds great! When can we schedule a viewing?', timestamp: new Date(now - 1000 * 60 * 5), unread: 2,
            messages: [
              { id: 'm1a', senderId: '1', text: 'Hey! I saw we matched. Are you still looking in Williamsburg?', content: 'Hey! I saw we matched. Are you still looking in Williamsburg?', timestamp: new Date(now - 1000 * 60 * 60 * 4) },
              { id: 'm1b', senderId: userId, text: 'Yes! I love the area. Have you lived there before?', content: 'Yes! I love the area. Have you lived there before?', timestamp: new Date(now - 1000 * 60 * 60 * 3.5) },
              { id: 'm1c', senderId: '1', text: 'I have been there for 2 years. The food scene is amazing. What is your budget range?', content: 'I have been there for 2 years. The food scene is amazing. What is your budget range?', timestamp: new Date(now - 1000 * 60 * 60 * 3) },
              { id: 'm1d', senderId: userId, text: 'Around $1,200 for my share. I work from home 3 days a week so a quiet space matters.', content: 'Around $1,200 for my share. I work from home 3 days a week so a quiet space matters.', timestamp: new Date(now - 1000 * 60 * 60 * 2.5) },
              { id: 'm1e', senderId: '1', text: 'That sounds great! When can we schedule a viewing?', content: 'That sounds great! When can we schedule a viewing?', timestamp: new Date(now - 1000 * 60 * 5) },
            ],
          },
          {
            id: '2', participant: { id: '2', name: 'Michael Chen', photo: 'https://picsum.photos/100/100?random=2', online: false },
            lastMessage: 'Thanks for reaching out!', timestamp: new Date(now - 1000 * 60 * 60 * 2), unread: 0,
            messages: [
              { id: 'm2a', senderId: '2', text: 'Hi there! I noticed we have similar interests. I am also a tech professional.', content: 'Hi there! I noticed we have similar interests. I am also a tech professional.', timestamp: new Date(now - 1000 * 60 * 60 * 24) },
              { id: 'm2b', senderId: userId, text: 'Nice to meet you! What area are you looking at?', content: 'Nice to meet you! What area are you looking at?', timestamp: new Date(now - 1000 * 60 * 60 * 20) },
              { id: 'm2c', senderId: '2', text: 'Financial District or Tribeca. Close to the subway is a must for me.', content: 'Financial District or Tribeca. Close to the subway is a must for me.', timestamp: new Date(now - 1000 * 60 * 60 * 18) },
              { id: 'm2d', senderId: userId, text: 'Thanks for reaching out!', content: 'Thanks for reaching out!', timestamp: new Date(now - 1000 * 60 * 60 * 2) },
            ],
          },
          {
            id: '3', participant: { id: '3', name: 'Emily Rodriguez', photo: 'https://picsum.photos/100/100?random=3', online: true },
            lastMessage: 'Same! Let me know when you want to check out some places.', timestamp: new Date(now - 1000 * 60 * 15), unread: 1,
            messages: [
              { id: 'm3a', senderId: userId, text: 'Hey Emily! I see you are also interested in Williamsburg.', content: 'Hey Emily! I see you are also interested in Williamsburg.', timestamp: new Date(now - 1000 * 60 * 60) },
              { id: 'm3b', senderId: '3', text: 'Yes! It is my favorite neighborhood. Do you have a move-in date in mind?', content: 'Yes! It is my favorite neighborhood. Do you have a move-in date in mind?', timestamp: new Date(now - 1000 * 60 * 30) },
              { id: 'm3c', senderId: userId, text: 'I am flexible but ideally by next month. How about you?', content: 'I am flexible but ideally by next month. How about you?', timestamp: new Date(now - 1000 * 60 * 20) },
              { id: 'm3d', senderId: '3', text: 'Same! Let me know when you want to check out some places.', content: 'Same! Let me know when you want to check out some places.', timestamp: new Date(now - 1000 * 60 * 15) },
            ],
          },
          {
            id: '5', participant: { id: '5', name: 'Jessica Park', photo: 'https://picsum.photos/100/100?random=5', online: true },
            lastMessage: 'The room is still available! Want to set up a video call?', timestamp: new Date(now - 1000 * 60 * 60), unread: 3,
            messages: [
              { id: 'm5a', senderId: '5', text: 'Hi! I have a room available in my apartment. Want to hear about it?', content: 'Hi! I have a room available in my apartment. Want to hear about it?', timestamp: new Date(now - 1000 * 60 * 60 * 5) },
              { id: 'm5b', senderId: userId, text: 'Absolutely! Where is it located and what is the rent?', content: 'Absolutely! Where is it located and what is the rent?', timestamp: new Date(now - 1000 * 60 * 60 * 4) },
              { id: 'm5c', senderId: '5', text: 'The room is still available! Want to set up a video call?', content: 'The room is still available! Want to set up a video call?', timestamp: new Date(now - 1000 * 60 * 60) },
            ],
          },
        ];

        for (const seed of conversationSeeds) {
          const idx = conversations.findIndex(c => c.id === seed.id);
          if (idx >= 0) {
            if (conversations[idx].messages.length === 0) {
              conversations[idx].messages = seed.messages;
            }
          } else {
            conversations.push(seed);
          }
        }
        await AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
        console.log('[StorageService] Populated conversations with messages');
      }

      if (hostType === 'agent' || userRole === 'host') {
        const agentGroupsKey = '@rhome/agent_groups';
        const existingAgentData = await AsyncStorage.getItem(agentGroupsKey);
        const existingAgentGroups = existingAgentData ? JSON.parse(existingAgentData) : [];
        const newAgentGroups = [
          {
            id: `ag-${userId.slice(0, 6)}-1`,
            name: 'Brooklyn Heights Trio',
            agentId: userId,
            targetListingId: '1',
            memberIds: ['1', '3', '5'],
            members: [
              { id: '1', name: 'Sarah Johnson', age: 28, occupation: 'Software Engineer', photos: ['https://picsum.photos/400/500?random=1'], budgetMin: 1000, budgetMax: 1400 },
              { id: '3', name: 'Emily Rodriguez', age: 26, occupation: 'UX Designer', photos: ['https://picsum.photos/400/500?random=3'], budgetMin: 900, budgetMax: 1300 },
              { id: '5', name: 'Jessica Park', age: 29, occupation: 'Marketing Manager', photos: ['https://picsum.photos/400/500?random=5'], budgetMin: 1100, budgetMax: 1500 },
            ],
            groupStatus: 'active',
            avgCompatibility: 87,
            combinedBudgetMin: 3000,
            combinedBudgetMax: 4200,
            coversRent: true,
            invites: [],
            createdAt: new Date(now - 1000 * 60 * 60 * 24 * 3).toISOString(),
          },
          {
            id: `ag-${userId.slice(0, 6)}-2`,
            name: 'FiDi Professionals',
            agentId: userId,
            targetListingId: '2',
            memberIds: ['2', '4'],
            members: [
              { id: '2', name: 'Michael Chen', age: 30, occupation: 'Data Scientist', photos: ['https://picsum.photos/400/500?random=2'], budgetMin: 1200, budgetMax: 1600 },
              { id: '4', name: 'Bob Anderson', age: 32, occupation: 'Financial Analyst', photos: ['https://picsum.photos/400/500?random=4'], budgetMin: 1300, budgetMax: 1700 },
            ],
            groupStatus: 'assembling',
            avgCompatibility: 79,
            combinedBudgetMin: 2500,
            combinedBudgetMax: 3300,
            coversRent: false,
            invites: [],
            createdAt: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
          },
          {
            id: `ag-${userId.slice(0, 6)}-3`,
            name: 'West Village Duo',
            agentId: userId,
            targetListingId: '5',
            memberIds: ['7', '9'],
            members: [
              { id: '7', name: 'Alex Kim', age: 27, occupation: 'Graphic Designer', photos: ['https://picsum.photos/400/500?random=7'], budgetMin: 1000, budgetMax: 1400 },
              { id: '9', name: 'Sophia Nguyen', age: 25, occupation: 'Content Writer', photos: ['https://picsum.photos/400/500?random=9'], budgetMin: 900, budgetMax: 1200 },
            ],
            groupStatus: 'placed',
            avgCompatibility: 92,
            combinedBudgetMin: 1900,
            combinedBudgetMax: 2600,
            coversRent: true,
            invites: [],
            createdAt: new Date(now - 1000 * 60 * 60 * 24 * 10).toISOString(),
          },
          {
            id: `ag-${userId.slice(0, 6)}-4`,
            name: 'SoHo Creatives',
            agentId: userId,
            targetListingId: '3',
            memberIds: ['6', '8', '10'],
            members: [
              { id: '6', name: 'David Martinez', age: 31, occupation: 'Photographer', photos: ['https://picsum.photos/400/500?random=6'], budgetMin: 1100, budgetMax: 1500 },
              { id: '8', name: 'Chris Wilson', age: 28, occupation: 'Film Editor', photos: ['https://picsum.photos/400/500?random=8'], budgetMin: 1000, budgetMax: 1300 },
              { id: '10', name: 'Taylor Reed', age: 26, occupation: 'Animator', photos: ['https://picsum.photos/400/500?random=10'], budgetMin: 900, budgetMax: 1200 },
            ],
            groupStatus: 'invited',
            avgCompatibility: 84,
            combinedBudgetMin: 3000,
            combinedBudgetMax: 4000,
            coversRent: true,
            invites: [
              { id: `inv-1`, groupId: `ag-${userId.slice(0, 6)}-4`, renterId: '6', renterName: 'David Martinez', status: 'pending', sentAt: new Date(now - 1000 * 60 * 60 * 12).toISOString(), agentMessage: 'Great fit for this SoHo space!' },
              { id: `inv-2`, groupId: `ag-${userId.slice(0, 6)}-4`, renterId: '8', renterName: 'Chris Wilson', status: 'accepted', sentAt: new Date(now - 1000 * 60 * 60 * 24).toISOString(), respondedAt: new Date(now - 1000 * 60 * 60 * 18).toISOString() },
              { id: `inv-3`, groupId: `ag-${userId.slice(0, 6)}-4`, renterId: '10', renterName: 'Taylor Reed', status: 'accepted', sentAt: new Date(now - 1000 * 60 * 60 * 24).toISOString(), respondedAt: new Date(now - 1000 * 60 * 60 * 20).toISOString() },
            ],
            createdAt: new Date(now - 1000 * 60 * 60 * 24 * 7).toISOString(),
          },
        ];
        for (const ag of newAgentGroups) {
          if (!existingAgentGroups.some((e: any) => e.id === ag.id)) {
            existingAgentGroups.push(ag);
          }
        }
        await AsyncStorage.setItem(agentGroupsKey, JSON.stringify(existingAgentGroups));
        console.log('[StorageService] Seeded agent groups (merged)');

        const shortlistKey = '@rhome/agent_shortlists';
        const existingShortlistData = await AsyncStorage.getItem(shortlistKey);
        const existingShortlists = existingShortlistData ? JSON.parse(existingShortlistData) : [];
        const newShortlists = [
          { id: `sl_${userId.slice(0,6)}_1`, agentId: userId, renterId: '1', createdAt: new Date(now - 1000 * 60 * 60 * 48).toISOString() },
          { id: `sl_${userId.slice(0,6)}_2`, agentId: userId, renterId: '2', createdAt: new Date(now - 1000 * 60 * 60 * 36).toISOString() },
          { id: `sl_${userId.slice(0,6)}_3`, agentId: userId, renterId: '3', createdAt: new Date(now - 1000 * 60 * 60 * 24).toISOString() },
          { id: `sl_${userId.slice(0,6)}_4`, agentId: userId, renterId: '5', createdAt: new Date(now - 1000 * 60 * 60 * 12).toISOString() },
          { id: `sl_${userId.slice(0,6)}_5`, agentId: userId, renterId: '7', createdAt: new Date(now - 1000 * 60 * 60 * 6).toISOString() },
        ];
        for (const sl of newShortlists) {
          if (!existingShortlists.some((e: any) => e.id === sl.id)) {
            existingShortlists.push(sl);
          }
        }
        await AsyncStorage.setItem(shortlistKey, JSON.stringify(existingShortlists));
        console.log('[StorageService] Seeded agent shortlists (merged)');
      }

      if (hostType === 'company') {
        const properties = await this.getProperties();
        const companyListingIds: string[] = [];
        for (let i = 0; i < Math.min(4, properties.length); i++) {
          if (!properties[i].hostId || properties[i].hostId === '1') {
            properties[i].hostId = userId;
            properties[i].hostType = 'company';
            companyListingIds.push(properties[i].id);
          }
        }
        if (companyListingIds.length > 0) {
          await this.setProperties(properties);
          console.log(`[StorageService] Assigned ${companyListingIds.length} listings to company host`);
        }

        const { createMockTeamMembers } = await import('./mockSeedData');
        const teamMembers = createMockTeamMembers(userId);
        await AsyncStorage.setItem(`@rhome/team_members_${userId}`, JSON.stringify(teamMembers));
        console.log('[StorageService] Seeded company team members');
      }

      const { createMockNotifications, createHostMockNotifications, createAgentMockNotifications, createCompanyMockNotifications, createMockInterestCards, createMockReceivedLikes, MOCK_SAVED_PROPERTY_IDS, createMockHostConversations, createMockPreformedGroup, createMockGroupMembers, createMockGroupShortlist, createMockGroupTours } = await import('./mockSeedData');
      let mockNotifs: Notification[];
      if (hostType === 'company') {
        mockNotifs = createCompanyMockNotifications(userId);
      } else if (hostType === 'agent') {
        mockNotifs = createAgentMockNotifications(userId);
      } else if (isHost) {
        mockNotifs = createHostMockNotifications(userId);
      } else {
        mockNotifs = createMockNotifications(userId);
      }
      const existingNotifs = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      const allNotifs: Notification[] = existingNotifs ? JSON.parse(existingNotifs) : [];
      const userNotifIds = new Set(allNotifs.filter(n => n.userId === userId).map(n => n.id));
      for (const n of mockNotifs) {
        if (!userNotifIds.has(n.id)) allNotifs.push(n);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(allNotifs));
      console.log(`[StorageService] Seeded ${mockNotifs.length} notifications`);

      if (isHost) {
        const allProperties = await this.getProperties();
        let hostProperties = allProperties.filter(p => p.hostId === userId);
        if (hostProperties.length === 0 && allProperties.length > 0) {
          const assignCount = Math.min(3, allProperties.length);
          for (let i = 0; i < assignCount; i++) {
            allProperties[i].hostId = userId;
          }
          await AsyncStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(allProperties));
          hostProperties = allProperties.slice(0, assignCount);
          console.log(`[StorageService] Assigned ${assignCount} listings to host ${userId}`);
        }
        const hostPropIds = hostProperties.map(p => p.id);
        if (hostPropIds.length > 0) {
          const interestCards = createMockInterestCards(userId, hostPropIds);
          for (const card of interestCards) {
            const prop = hostProperties.find(p => p.id === card.propertyId);
            if (prop) card.propertyTitle = prop.title;
          }
          const existingCards = await this.getInterestCards();
          const existingCardIds = new Set(existingCards.map(c => c.id));
          for (const card of interestCards) {
            if (!existingCardIds.has(card.id)) existingCards.push(card);
          }
          await this.setInterestCards(existingCards);
          console.log(`[StorageService] Seeded ${interestCards.length} interest cards for host`);
        }

        const hostConversations = createMockHostConversations(userId);
        for (const hc of hostConversations) {
          const idx = conversations.findIndex(c => c.id === hc.id);
          if (idx < 0) conversations.push(hc);
        }
        await AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
        console.log('[StorageService] Seeded host conversations');
      }

      if (!isHost) {
        const savedData = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_PROPERTIES);
        const allSaved: Record<string, string[]> = savedData ? JSON.parse(savedData) : {};
        if (!allSaved[userId] || allSaved[userId].length === 0) {
          allSaved[userId] = MOCK_SAVED_PROPERTY_IDS;
          await AsyncStorage.setItem(STORAGE_KEYS.SAVED_PROPERTIES, JSON.stringify(allSaved));
          console.log('[StorageService] Seeded saved properties');
        }
      }

      const receivedLikes = createMockReceivedLikes(userId);
      const users = await this.getUsers();
      const userIdx = users.findIndex(u => u.id === userId);
      if (userIdx >= 0) {
        users[userIdx].receivedLikes = receivedLikes.map(l => ({
          likerId: l.fromUserId,
          likerName: l.fromUserName,
          likerPhoto: l.fromUserPhoto,
          likedAt: new Date(l.timestamp),
          isSuperLike: l.isSuperLike,
        }));
        await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      }
      console.log('[StorageService] Seeded received likes / profile views');

      if (!isHost) {
        const mockGroup = createMockPreformedGroup(userId);
        const mockMembers = createMockGroupMembers(userId, mockGroup.id);
        const mockShortlist = createMockGroupShortlist(userId, mockGroup.id);
        const mockTours = createMockGroupTours(userId, mockGroup.id);
        await AsyncStorage.setItem(`@rhome/preformed_group_${userId}`, JSON.stringify(mockGroup));
        await AsyncStorage.setItem(`@rhome/preformed_members_${mockGroup.id}`, JSON.stringify(mockMembers));
        await AsyncStorage.setItem(`@rhome/group_shortlist_${mockGroup.id}`, JSON.stringify(mockShortlist));
        await AsyncStorage.setItem(`@rhome/group_tours_${mockGroup.id}`, JSON.stringify(mockTours));
        console.log('[StorageService] Seeded preformed group with shortlist and tours');
      }

      await AsyncStorage.setItem(seedKey, 'true');
      console.log('[StorageService] User-specific mock data seeding complete');
    } catch (error) {
      console.error('[StorageService] Error seeding user-specific mock data:', error);
    }
  },

  async getNotifications(userId: string): Promise<Notification[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      const allNotifications: Notification[] = data ? JSON.parse(data) : [];
      return allNotifications
        .filter(n => n.userId === userId)
        .map(n => ({ ...n, createdAt: new Date(n.createdAt) }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  },

  async addNotification(notification: Notification): Promise<void> {
    try {
      const typeToPreference: Record<string, string> = {
        match: 'matches',
        super_like: 'superLikes',
        message: 'messages',
        group_invite: 'groupInvites',
        group_accepted: 'groupUpdates',
        property_update: 'propertyUpdates',
        property_rented: 'propertyUpdates',
        application_status: 'systemAlerts',
        system: 'systemAlerts',
      };
      const prefKey = typeToPreference[notification.type];
      if (prefKey) {
        let recipientPrefs = null;
        const currentUserData = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        const currentUser = currentUserData ? JSON.parse(currentUserData) : null;
        if (currentUser && currentUser.id === notification.userId) {
          recipientPrefs = currentUser.notificationPreferences;
        } else {
          const usersData = await AsyncStorage.getItem(STORAGE_KEYS.USERS);
          if (usersData) {
            const users = JSON.parse(usersData);
            const recipient = users.find((u: any) => u.id === notification.userId);
            if (recipient) {
              recipientPrefs = recipient.notificationPreferences;
            }
          }
        }
        if (recipientPrefs) {
          const defaultPrefs = { matches: true, superLikes: true, messages: true, groupInvites: true, groupUpdates: true, propertyUpdates: true, boostReminders: true, systemAlerts: true };
          const merged = { ...defaultPrefs, ...recipientPrefs };
          if (merged[prefKey as keyof typeof merged] === false) {
            return;
          }
        }
      }
      const data = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      const notifications: Notification[] = data ? JSON.parse(data) : [];
      if (notifications.some(n => n.id === notification.id)) return;
      notifications.push(notification);
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    } catch (error) {
      console.error('Error adding notification:', error);
    }
  },

  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      const notifications: Notification[] = data ? JSON.parse(data) : [];
      const notification = notifications.find(n => n.id === notificationId);
      if (notification) {
        notification.isRead = true;
        await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  },

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      const notifications: Notification[] = data ? JSON.parse(data) : [];
      notifications.forEach(n => {
        if (n.userId === userId) {
          n.isRead = true;
        }
      });
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  },

  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      const notifications: Notification[] = data ? JSON.parse(data) : [];
      const filtered = notifications.filter(n => n.id !== notificationId);
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  },

  async getUnreadNotificationCount(userId: string): Promise<number> {
    try {
      const notifications = await this.getNotifications(userId);
      return notifications.filter(n => !n.isRead).length;
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      return 0;
    }
  },

  async addProfileView(viewedUserId: string, viewerId: string): Promise<void> {
    try {
      if (!viewedUserId || !viewerId || viewedUserId === viewerId) {
        return;
      }
      
      const users = await this.getUsers();
      const viewedUser = users.find(u => u.id === viewedUserId);
      const viewer = users.find(u => u.id === viewerId);
      
      if (!viewedUser || !viewer) {
        return;
      }
      
      if (!viewedUser.profileViews) {
        viewedUser.profileViews = [];
      }
      
      const existingView = viewedUser.profileViews.find(v => v.viewerId === viewerId);
      const now = new Date();
      
      if (existingView) {
        const lastViewedAt = new Date(existingView.viewedAt);
        const hoursSinceLastView = (now.getTime() - lastViewedAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastView < 24) {
          return;
        }
        
        existingView.viewedAt = now;
      } else {
        viewedUser.profileViews.push({
          viewerId: viewer.id,
          viewerName: viewer.name,
          viewerPhoto: viewer.profilePicture,
          viewedAt: now,
        });
      }
      
      await this.addOrUpdateUser(viewedUser);
      
      const currentUser = await this.getCurrentUser();
      if (currentUser && currentUser.id === viewedUserId) {
        await this.setCurrentUser(viewedUser);
      }
    } catch (error) {
      console.error('Error adding profile view:', error);
    }
  },

  async getProfileViews(userId: string): Promise<Array<{ viewerId: string; viewerName: string; viewerPhoto?: string; viewedAt: Date }>> {
    try {
      const users = await this.getUsers();
      const user = users.find(u => u.id === userId);
      if (!user || !user.profileViews) {
        return [];
      }
      
      type ProfileView = { viewerId: string; viewerName: string; viewerPhoto?: string; viewedAt: Date };
      
      return user.profileViews
        .map((v): ProfileView => ({ ...v, viewedAt: new Date(v.viewedAt) }))
        .sort((a: ProfileView, b: ProfileView) => b.viewedAt.getTime() - a.viewedAt.getTime());
    } catch (error) {
      console.error('Error getting profile views:', error);
      return [];
    }
  },

  async seedMockNotifications(userId: string): Promise<void> {
    try {
      const existingNotifications = await this.getNotifications(userId);
      if (existingNotifications.length > 0) {
        return;
      }

      const mockNotifications: Notification[] = [
        {
          id: 'notif-1',
          userId,
          type: 'match',
          title: 'New Match!',
          body: 'You matched with Sarah Chen. Start a conversation!',
          isRead: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 5),
        },
        {
          id: 'notif-2',
          userId,
          type: 'message',
          title: 'New Message',
          body: 'Alex Martinez sent you a message',
          isRead: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 30),
        },
        {
          id: 'notif-3',
          userId,
          type: 'group_invite',
          title: 'Group Invitation',
          body: 'Jordan Taylor invited you to join Williamsburg Roommates',
          isRead: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
        },
        {
          id: 'notif-4',
          userId,
          type: 'property_update',
          title: 'Property Update',
          body: 'Modern 2BR Apartment in Williamsburg is now available',
          isRead: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
        },
        {
          id: 'notif-5',
          userId,
          type: 'application_status',
          title: 'Application Update',
          body: 'Your application for Cozy Studio in East Village has been reviewed',
          isRead: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
        },
        {
          id: 'notif-6',
          userId,
          type: 'system',
          title: 'Welcome to Rhome!',
          body: 'Complete your profile to start finding compatible roommates',
          isRead: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
        },
      ];

      for (const notification of mockNotifications) {
        await this.addNotification(notification);
      }
      console.log(`[StorageService] ✓ Seeded ${mockNotifications.length} mock notifications for user ${userId}`);
    } catch (error) {
      console.error('Error seeding mock notifications:', error);
    }
  },

  async blockUser(currentUserId: string, blockedUserId: string): Promise<void> {
    try {
      const users = await this.getUsers();
      const currentUser = users.find(u => u.id === currentUserId);
      if (!currentUser) return;

      if (!currentUser.blockedUsers) {
        currentUser.blockedUsers = [];
      }
      if (!currentUser.blockedUsers.includes(blockedUserId)) {
        currentUser.blockedUsers.push(blockedUserId);
        await this.addOrUpdateUser(currentUser);

        const storedCurrentUser = await this.getCurrentUser();
        if (storedCurrentUser && storedCurrentUser.id === currentUserId) {
          storedCurrentUser.blockedUsers = currentUser.blockedUsers;
          await this.setCurrentUser(storedCurrentUser);
        }
      }
    } catch (error) {
      console.error('Error blocking user:', error);
    }
  },

  async unblockUser(currentUserId: string, blockedUserId: string): Promise<void> {
    try {
      const users = await this.getUsers();
      const currentUser = users.find(u => u.id === currentUserId);
      if (!currentUser || !currentUser.blockedUsers) return;

      currentUser.blockedUsers = currentUser.blockedUsers.filter(id => id !== blockedUserId);
      await this.addOrUpdateUser(currentUser);

      const storedCurrentUser = await this.getCurrentUser();
      if (storedCurrentUser && storedCurrentUser.id === currentUserId) {
        storedCurrentUser.blockedUsers = currentUser.blockedUsers;
        await this.setCurrentUser(storedCurrentUser);
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
    }
  },

  async getBlockedUsers(userId: string): Promise<string[]> {
    try {
      const users = await this.getUsers();
      const user = users.find(u => u.id === userId);
      return user?.blockedUsers || [];
    } catch (error) {
      console.error('Error getting blocked users:', error);
      return [];
    }
  },

  async reportUser(currentUserId: string, reportedUserId: string, reason: string): Promise<void> {
    try {
      const users = await this.getUsers();
      const currentUser = users.find(u => u.id === currentUserId);
      if (!currentUser) return;

      if (!currentUser.reportedUsers) {
        currentUser.reportedUsers = [];
      }
      if (!currentUser.reportedUsers.some(r => r.userId === reportedUserId)) {
        currentUser.reportedUsers.push({
          userId: reportedUserId,
          reason,
          reportedAt: new Date(),
        });
        await this.addOrUpdateUser(currentUser);

        const storedCurrentUser = await this.getCurrentUser();
        if (storedCurrentUser && storedCurrentUser.id === currentUserId) {
          storedCurrentUser.reportedUsers = currentUser.reportedUsers;
          await this.setCurrentUser(storedCurrentUser);
        }
      }
    } catch (error) {
      console.error('Error reporting user:', error);
    }
  },

  async isUserBlocked(currentUserId: string, otherUserId: string): Promise<boolean> {
    try {
      const blockedUsers = await this.getBlockedUsers(currentUserId);
      return blockedUsers.includes(otherUserId);
    } catch (error) {
      console.error('Error checking if user is blocked:', error);
      return false;
    }
  },

  async deleteUser(userId: string): Promise<void> {
    try {
      const users = await this.getUsers();
      const filteredUsers = users.filter(u => u.id !== userId);
      await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(filteredUsers));

      const profiles = await this.getRoommateProfiles();
      const filteredProfiles = profiles.filter(p => p.id !== userId);
      await this.setRoommateProfiles(filteredProfiles);

      const conversations = await this.getConversations();
      const filteredConversations = conversations.filter(c => c.participant.id !== userId);
      await this.setConversations(filteredConversations);

      const matches = await this.getMatches();
      const filteredMatches = matches.filter(m => m.userId1 !== userId && m.userId2 !== userId);
      await this.setMatches(filteredMatches);

      const applications = await this.getApplications();
      const filteredApplications = applications.filter(a => a.applicantId !== userId);
      await this.setApplications(filteredApplications);

      const groups = await this.getGroups();
      const updatedGroups = groups.map(g => ({
        ...g,
        members: g.members.filter(id => id !== userId),
        pendingMembers: g.pendingMembers.filter(id => id !== userId),
      })).filter(g => g.createdBy !== userId);
      await this.setGroups(updatedGroups);

      const swipeHistoryData = await AsyncStorage.getItem(STORAGE_KEYS.SWIPE_HISTORY);
      if (swipeHistoryData) {
        const swipeHistory = JSON.parse(swipeHistoryData);
        const filteredHistory = Array.isArray(swipeHistory)
          ? swipeHistory.filter((id: string) => id !== userId)
          : swipeHistory;
        await AsyncStorage.setItem(STORAGE_KEYS.SWIPE_HISTORY, JSON.stringify(filteredHistory));
      }

      const likesData = await AsyncStorage.getItem(STORAGE_KEYS.LIKES);
      if (likesData) {
        const likes: Record<string, string[]> = JSON.parse(likesData);
        delete likes[userId];
        Object.keys(likes).forEach(uid => {
          likes[uid] = likes[uid].filter(likedId => likedId !== userId);
        });
        await AsyncStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(likes));
      }

      const savedPropsData = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_PROPERTIES);
      if (savedPropsData) {
        const savedProperties: Record<string, string[]> = JSON.parse(savedPropsData);
        delete savedProperties[userId];
        await AsyncStorage.setItem(STORAGE_KEYS.SAVED_PROPERTIES, JSON.stringify(savedProperties));
      }

      const interestCards = await this.getInterestCards();
      const filteredCards = interestCards.filter(
        (c: InterestCard) => c.renterId !== userId && c.hostId !== userId
      );
      await AsyncStorage.setItem(STORAGE_KEYS.INTEREST_CARDS, JSON.stringify(filteredCards));

      const notificationsData = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (notificationsData) {
        const notifications = JSON.parse(notificationsData);
        const filteredNotifications = notifications.filter((n: any) => n.userId !== userId);
        await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(filteredNotifications));
      }

      const remainingUsers = await this.getUsers();
      const updatedRemainingUsers = remainingUsers.map(u => {
        if (u.profileViews) {
          u.profileViews = u.profileViews.filter(v => v.viewerId !== userId);
        }
        if (u.receivedLikes) {
          u.receivedLikes = u.receivedLikes.filter(l => l.likerId !== userId);
        }
        if (u.receivedSuperLikes) {
          u.receivedSuperLikes = u.receivedSuperLikes.filter(sl => sl.superLikerId !== userId);
        }
        return u;
      });
      await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedRemainingUsers));

      await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_USER);

      console.log('[StorageService] Successfully deleted user:', userId);
    } catch (error) {
      console.error('[StorageService] Error deleting user:', error);
      throw error;
    }
  },

  async getInterestCards(): Promise<InterestCard[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.INTEREST_CARDS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting interest cards:', error);
      return [];
    }
  },

  async setInterestCards(cards: InterestCard[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.INTEREST_CARDS, JSON.stringify(cards));
    } catch (error) {
      console.error('Error setting interest cards:', error);
    }
  },

  async addInterestCard(card: InterestCard): Promise<void> {
    try {
      const cards = await this.getInterestCards();
      cards.push(card);
      await this.setInterestCards(cards);
    } catch (error) {
      console.error('Error adding interest card:', error);
    }
  },

  async updateInterestCard(id: string, updates: Partial<InterestCard>): Promise<void> {
    try {
      const cards = await this.getInterestCards();
      const index = cards.findIndex(c => c.id === id);
      if (index >= 0) {
        cards[index] = { ...cards[index], ...updates };
        await this.setInterestCards(cards);
      }
    } catch (error) {
      console.error('Error updating interest card:', error);
    }
  },

  async getInterestCardsForHost(hostId: string): Promise<InterestCard[]> {
    await this.expireOldInterestCards();
    const cards = await this.getInterestCards();
    return cards.filter(c => c.hostId === hostId);
  },

  async getInterestCardsForRenter(renterId: string): Promise<InterestCard[]> {
    await this.expireOldInterestCards();
    const cards = await this.getInterestCards();
    return cards.filter(c => c.renterId === renterId);
  },

  async hasActiveInterest(renterId: string, propertyId: string): Promise<boolean> {
    const cards = await this.getInterestCards();
    return cards.some(c => c.renterId === renterId && c.propertyId === propertyId && (c.status === 'pending' || c.status === 'accepted'));
  },

  async expireOldInterestCards(): Promise<InterestCard[]> {
    try {
      const cards = await this.getInterestCards();
      const now = Date.now();
      const expiredCards: InterestCard[] = [];
      const updated = cards.map(card => {
        if (card.status === 'pending') {
          const createdTime = new Date(card.createdAt).getTime();
          if (now - createdTime > 24 * 60 * 60 * 1000) {
            const expired = { ...card, status: 'expired' as const, respondedAt: new Date().toISOString() };
            expiredCards.push(expired);
            return expired;
          }
        }
        return card;
      });
      if (expiredCards.length > 0) {
        await this.setInterestCards(updated);
      }
      return expiredCards;
    } catch (error) {
      console.error('Error expiring interest cards:', error);
      return [];
    }
  },

  async getInterestCardForProperty(renterId: string, propertyId: string): Promise<InterestCard | null> {
    const cards = await this.getInterestCards();
    return cards.find(c => c.renterId === renterId && c.propertyId === propertyId) || null;
  },

  async isOnboardingCompleted(userId?: string): Promise<boolean> {
    try {
      const key = userId
        ? `${STORAGE_KEYS.ONBOARDING_COMPLETED}_${userId}`
        : STORAGE_KEYS.ONBOARDING_COMPLETED;
      const value = await AsyncStorage.getItem(key);
      return value === 'true';
    } catch {
      return false;
    }
  },

  async setOnboardingCompleted(completed: boolean, userId?: string): Promise<void> {
    try {
      const key = userId
        ? `${STORAGE_KEYS.ONBOARDING_COMPLETED}_${userId}`
        : STORAGE_KEYS.ONBOARDING_COMPLETED;
      await AsyncStorage.setItem(key, completed ? 'true' : 'false');
    } catch (error) {
      console.error('[StorageService] Error saving onboarding status:', error);
    }
  },

  async getHostSubscription(userId: string): Promise<HostSubscriptionData> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.HOST_SUBSCRIPTIONS);
      const subs: Record<string, HostSubscriptionData> = data ? JSON.parse(data) : {};
      return subs[userId] || getDefaultHostSubscription();
    } catch {
      return getDefaultHostSubscription();
    }
  },

  async updateHostSubscription(userId: string, sub: Partial<HostSubscriptionData>): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.HOST_SUBSCRIPTIONS);
      const subs: Record<string, HostSubscriptionData> = data ? JSON.parse(data) : {};
      const existing = subs[userId] || getDefaultHostSubscription();
      subs[userId] = { ...existing, ...sub };
      await AsyncStorage.setItem(STORAGE_KEYS.HOST_SUBSCRIPTIONS, JSON.stringify(subs));
    } catch (error) {
      console.error('[StorageService] Error updating host subscription:', error);
    }
  },

  async applyListingBoost(listingId: string, boost: ListingBoost): Promise<void> {
    try {
      const properties = await this.getProperties();
      const index = properties.findIndex(p => p.id === listingId);
      if (index >= 0) {
        const property = properties[index];
        properties[index] = { ...property, listingBoost: boost };
        await AsyncStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(properties));
        if (property.hostId) {
          await this.addNotification({
            id: generateNotificationId(),
            userId: property.hostId,
            type: 'system',
            title: 'Listing Boosted',
            body: `${property.title} is now boosted and will appear at the top of search results`,
            isRead: false,
            createdAt: new Date(),
            data: { propertyId: listingId },
          });
        }
      }
    } catch (error) {
      console.error('[StorageService] Error applying listing boost:', error);
    }
  },

  async getActiveBoostForHost(hostId: string): Promise<ListingBoost | null> {
    try {
      const properties = await this.getProperties();
      const hostProperties = properties.filter(p => p.hostId === hostId);
      for (const prop of hostProperties) {
        if (prop.listingBoost?.isActive && new Date(prop.listingBoost.expiresAt) > new Date()) {
          return prop.listingBoost;
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  async getActiveBoostCountForHost(hostId: string): Promise<number> {
    try {
      const properties = await this.getProperties();
      const hostProperties = properties.filter(p => p.hostId === hostId);
      let count = 0;
      for (const prop of hostProperties) {
        if (prop.listingBoost?.isActive && new Date(prop.listingBoost.expiresAt) > new Date()) {
          count++;
        }
      }
      return count;
    } catch {
      return 0;
    }
  },

  async setApartmentPreferences(userId: string, prefs: any): Promise<void> {
    try {
      const key = `@rhome/apartment_prefs_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(prefs));

      const profiles = await this.getRoommateProfiles();
      const idx = profiles.findIndex((p: any) => p.id === userId);
      if (idx >= 0) {
        profiles[idx].apartmentPrefs = prefs;
        await AsyncStorage.setItem(STORAGE_KEYS.ROOMMATE_PROFILES, JSON.stringify(profiles));
      }
    } catch (error) {
      console.error('[StorageService] Error saving apartment prefs:', error);
    }
  },

  async getApartmentPreferences(userId: string): Promise<any | null> {
    try {
      const key = `@rhome/apartment_prefs_${userId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async getGroupApartmentVotes(groupId: string): Promise<any[]> {
    try {
      const key = `@rhome/group_votes_${groupId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async submitGroupApartmentVote(
    groupId: string, listingId: string, userId: string, vote: 'yes' | 'no' | 'maybe'
  ): Promise<void> {
    try {
      const key = `@rhome/group_votes_${groupId}`;
      const existing = await this.getGroupApartmentVotes(groupId);
      const idx = existing.findIndex(
        (v: any) => v.listingId === listingId && v.userId === userId
      );
      const record = {
        id: idx >= 0 ? existing[idx].id : `vote_${Date.now()}`,
        groupId, listingId, userId, vote,
        createdAt: new Date().toISOString(),
      };
      if (idx >= 0) {
        existing[idx] = record;
      } else {
        existing.push(record);
      }
      await AsyncStorage.setItem(key, JSON.stringify(existing));
    } catch (error) {
      console.error('[StorageService] Error saving vote:', error);
    }
  },
};

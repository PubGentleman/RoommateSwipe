import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, RoommateProfile, Property, Group, Conversation, Message, Match, Application } from '../types/models';

const STORAGE_KEYS = {
  CURRENT_USER: '@roommate_finder/current_user',
  USERS: '@roommate_finder/users',
  ROOMMATE_PROFILES: '@roommate_finder/roommate_profiles',
  PROPERTIES: '@roommate_finder/properties',
  GROUPS: '@roommate_finder/groups',
  CONVERSATIONS: '@roommate_finder/conversations',
  MATCHES: '@roommate_finder/matches',
  APPLICATIONS: '@roommate_finder/applications',
  SWIPE_HISTORY: '@roommate_finder/swipe_history',
  LIKES: '@roommate_finder/likes',
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
      await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
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
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting properties:', error);
      return [];
    }
  },

  async setProperties(properties: Property[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(properties));
    } catch (error) {
      console.error('Error setting properties:', error);
    }
  },

  async addOrUpdateProperty(property: Property): Promise<void> {
    try {
      const properties = await this.getProperties();
      const index = properties.findIndex(p => p.id === property.id);
      if (index >= 0) {
        properties[index] = property;
      } else {
        properties.push(property);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(properties));
    } catch (error) {
      console.error('Error adding/updating property:', error);
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
        
        group.pendingMembers = group.pendingMembers.filter(id => id !== userId);
        if (!group.members.includes(userId) && group.members.length < group.maxMembers) {
          group.members.push(userId);
        }
        await this.setGroups(groups);
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

  async getConversations(): Promise<Conversation[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      if (!data) return [];
      const conversations = JSON.parse(data);
      return conversations.map((conv: any) => ({
        ...conv,
        timestamp: new Date(conv.timestamp),
        messages: conv.messages.map((msg: any) => ({
          ...msg,
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

  async getApplications(): Promise<Application[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.APPLICATIONS);
      if (!data) return [];
      const applications = JSON.parse(data);
      return applications.map((app: any) => ({
        ...app,
        submittedAt: new Date(app.submittedAt),
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

  async getLikes(): Promise<Record<string, string[]>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LIKES);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error getting likes:', error);
      return {};
    }
  },

  async addLike(userId: string, likedProfileId: string): Promise<void> {
    try {
      const likes = await this.getLikes();
      if (!likes[userId]) {
        likes[userId] = [];
      }
      if (!likes[userId].includes(likedProfileId)) {
        likes[userId].push(likedProfileId);
        await AsyncStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(likes));
      }
    } catch (error) {
      console.error('Error adding like:', error);
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
      await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  },

  async clearSwipeHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.SWIPE_HISTORY);
    } catch (error) {
      console.error('Error clearing swipe history:', error);
    }
  },

  async initializeWithMockData(): Promise<void> {
    try {
      const { mockRoommateProfiles, mockProperties, mockGroups } = await import('./mockData');
      
      const existingProfiles = await this.getRoommateProfiles();
      if (existingProfiles.length === 0) {
        await this.setRoommateProfiles(mockRoommateProfiles);
      }
      
      const existingProperties = await this.getProperties();
      if (existingProperties.length === 0) {
        await this.setProperties(mockProperties);
      }
      
      const existingGroups = await this.getGroups();
      if (existingGroups.length === 0) {
        await this.setGroups(mockGroups);
      }
    } catch (error) {
      console.error('Error initializing with mock data:', error);
    }
  },
};

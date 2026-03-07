import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, RoommateProfile, Property, Group, Conversation, Message, Match, Application, Notification } from '../types/models';

const STORAGE_KEYS = {
  CURRENT_USER: '@roomdr/current_user',
  USERS: '@roomdr/users',
  ROOMMATE_PROFILES: '@roomdr/roommate_profiles',
  PROPERTIES: '@roomdr/properties',
  GROUPS: '@roomdr/groups',
  CONVERSATIONS: '@roomdr/conversations',
  MATCHES: '@roomdr/matches',
  APPLICATIONS: '@roomdr/applications',
  SWIPE_HISTORY: '@roomdr/swipe_history',
  LIKES: '@roomdr/likes',
  SAVED_PROPERTIES: '@roomdr/saved_properties',
  NOTIFICATIONS: '@roomdr/notifications',
  MOCK_DATA_VERSION: '@roomdr/mock_data_version',
  ONBOARDING_COMPLETED: '@roomdr/onboarding_completed',
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
      const properties = JSON.parse(data);
      return properties.map((p: any) => ({
        ...p,
        propertyType: p.propertyType || 'lease',
        roomType: p.roomType || 'entire',
        existingRoommates: p.existingRoommates || [],
        availableDate: p.availableDate ? new Date(p.availableDate) : undefined,
        rentedDate: p.rentedDate ? new Date(p.rentedDate) : undefined,
      }));
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

  async consumeUndoPass(userId: string): Promise<void> {
    try {
      const users = await this.getUsers();
      const user = users.find(u => u.id === userId);
      if (user) {
        user.undoPassData = {
          hasUndoPass: false,
          undoPassExpiresAt: null as any,
        };
        await this.addOrUpdateUser(user);
      }
      
      const currentUser = await this.getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        currentUser.undoPassData = {
          hasUndoPass: false,
          undoPassExpiresAt: null as any,
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
      const { MOCK_DATA_VERSION, mockRoommateProfiles, mockProperties, mockGroups, mockProfileUsers } = await import('./mockData');
      
      const storedVersion = await AsyncStorage.getItem(STORAGE_KEYS.MOCK_DATA_VERSION);
      const versionChanged = storedVersion !== MOCK_DATA_VERSION;
      
      if (versionChanged) {
        console.log(`[StorageService] Mock data version changed (${storedVersion} → ${MOCK_DATA_VERSION}), reloading...`);
        await this.setRoommateProfiles(mockRoommateProfiles);
        await this.setProperties(mockProperties);
        await this.setGroups(mockGroups);
        
        await AsyncStorage.removeItem(STORAGE_KEYS.USERS);
        for (const profileUser of mockProfileUsers) {
          await this.addOrUpdateUser(profileUser);
        }
        
        await AsyncStorage.setItem(STORAGE_KEYS.MOCK_DATA_VERSION, MOCK_DATA_VERSION);
        console.log('[StorageService] ✓ Mock data reloaded due to version change');
        return;
      }
      
      const existingProperties = await this.getProperties();
      const existingProfiles = await this.getRoommateProfiles();
      const existingGroups = await this.getGroups();
      const existingUsers = await this.getUsers();
      
      const hasWalkScores = existingProperties.length > 0 && existingProperties.every(p => p.walkScore !== undefined);
      
      if (existingProperties.length > 0 && existingProfiles.length > 0 && existingGroups.length > 0 && existingUsers.length > 0 && hasWalkScores) {
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
      console.log('[StorageService] Mock data initialization complete!');
    } catch (error) {
      console.error('Error initializing with mock data:', error);
    }
  },

  async forceReloadMockData(): Promise<void> {
    try {
      console.log('[StorageService] Force reloading all mock data...');
      const { mockRoommateProfiles, mockProperties, mockGroups, mockProfileUsers } = await import('./mockData');
      
      console.log(`[StorageService] Importing ${mockProperties.length} properties from mockData...`);
      
      await this.setRoommateProfiles(mockRoommateProfiles);
      console.log(`[StorageService] Loaded ${mockRoommateProfiles.length} roommate profiles`);
      
      await this.setProperties(mockProperties);
      console.log(`[StorageService] Loaded ${mockProperties.length} properties`);
      
      await this.setGroups(mockGroups);
      console.log(`[StorageService] Loaded ${mockGroups.length} groups`);
      
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
          title: 'Welcome to Roomdr!',
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
};

import React, { useState } from 'react';
import { View, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { Group } from '../../types/models';
import { StorageService } from '../../utils/storage';
import { createGroup as createGroupSupabase } from '../../services/groupService';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenKeyboardAwareScrollView } from '../../components/ScreenKeyboardAwareScrollView';
import { Image } from 'expo-image';

type CreateGroupScreenProps = {
  route: {
    params: {
      matchedUserId: string;
      matchedUserName: string;
    };
  };
  navigation: any;
};

export const CreateGroupScreen = ({ route, navigation }: CreateGroupScreenProps) => {
  const { matchedUserId, matchedUserName } = route.params;
  const { theme } = useTheme();
  const { user } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [maxMembers, setMaxMembers] = useState('4');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateGroup = async () => {
    if (!user) return;
    
    if (!groupName.trim()) {
      Alert.alert('Group Name Required', 'Please enter a name for your group');
      return;
    }

    const membersCount = parseInt(maxMembers);
    if (isNaN(membersCount) || membersCount < 2 || membersCount > 10) {
      Alert.alert('Invalid Number', 'Max members must be between 2 and 10');
      return;
    }

    try {
      setIsCreating(true);
      
      const userBudget = user?.profileData?.budget || 2000;
      const userLocation = user?.profileData?.city || user?.profileData?.neighborhood || 'Your City';

      const newGroup: Group = {
        id: `group_${Date.now()}`,
        name: groupName.trim(),
        description: description.trim() || `A group looking for roommates`,
        members: [user.id, matchedUserId],
        pendingMembers: [],
        maxMembers: membersCount,
        budget: userBudget,
        preferredLocation: userLocation,
        createdAt: new Date(),
        createdBy: user.id,
      };

      try {
        await createGroupSupabase({
          name: groupName.trim(),
          description: description.trim() || `A group looking for roommates`,
          max_members: membersCount,
          budget_min: userBudget,
          city: userLocation,
        });
      } catch (supabaseError) {
        console.warn('[CreateGroupScreen] Supabase createGroup failed, falling back to StorageService:', supabaseError);
        await StorageService.addOrUpdateGroup(newGroup);
      }
      
      Alert.alert(
        'Group Created!',
        `${groupName} has been created with you and ${matchedUserName}`,
        [
          {
            text: 'View Groups',
            onPress: () => {
              navigation.navigate('Groups');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ScreenKeyboardAwareScrollView
      style={{ backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText style={Typography.h2}>Create Group</ThemedText>
        <View style={styles.backButton} />
      </View>

      <View style={[styles.card, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name="users" size={48} color={theme.primary} />
        <ThemedText style={[Typography.h3, { marginTop: Spacing.md }]}>
          Start a Roommate Group
        </ThemedText>
        <ThemedText
          style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.sm }]}
        >
          Create a group with {matchedUserName} to find more roommates together
        </ThemedText>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <ThemedText style={[Typography.body, { fontWeight: '600', marginBottom: Spacing.sm }]}>
            Group Name *
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="e.g., Downtown SF Roommates"
            placeholderTextColor={theme.textSecondary}
            value={groupName}
            onChangeText={setGroupName}
            maxLength={50}
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[Typography.body, { fontWeight: '600', marginBottom: Spacing.sm }]}>
            Description (Optional)
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="Tell others what your group is looking for..."
            placeholderTextColor={theme.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={200}
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[Typography.body, { fontWeight: '600', marginBottom: Spacing.sm }]}>
            Max Members
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="4"
            placeholderTextColor={theme.textSecondary}
            value={maxMembers}
            onChangeText={setMaxMembers}
            keyboardType="number-pad"
            maxLength={2}
          />
          <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
            Total number of roommates (2-10)
          </ThemedText>
        </View>
      </View>

      <Pressable
        style={[
          styles.createButton,
          {
            backgroundColor: groupName.trim() ? theme.primary : theme.backgroundSecondary,
          },
        ]}
        onPress={handleCreateGroup}
        disabled={!groupName.trim() || isCreating}
      >
        <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
          {isCreating ? 'Creating...' : 'Create Group'}
        </ThemedText>
      </Pressable>
    </ScreenKeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  card: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.large,
    marginBottom: Spacing.xl,
  },
  form: {
    gap: Spacing.lg,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.medium,
    fontSize: 16,
    borderWidth: 1,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  createButton: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
});

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, TextInput, Switch, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackNavigator';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';

type PrivacySecurityScreenNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'PrivacySecurity'>;

export const PrivacySecurityScreen = () => {
  const { theme } = useTheme();
  const { user, logout, updateUser } = useAuth();
  const navigation = useNavigation<PrivacySecurityScreenNavigationProp>();
  
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [profileVisible, setProfileVisible] = useState(true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [showLastActive, setShowLastActive] = useState(false);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPasswordSuccessModal, setShowPasswordSuccessModal] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (user?.privacySettings) {
      setProfileVisible(user.privacySettings.profileVisible ?? true);
      setShowOnlineStatus(user.privacySettings.showOnlineStatus ?? true);
      setShowLastActive(user.privacySettings.showLastActive ?? false);
      setTwoFactorAuth(user.privacySettings.twoFactorEnabled ?? false);
    }
  }, [user]);

  const updatePrivacySettings = async (settings: Partial<NonNullable<typeof user.privacySettings>>) => {
    if (!user) return;

    const updatedSettings = {
      profileVisible: settings.profileVisible ?? profileVisible,
      showOnlineStatus: settings.showOnlineStatus ?? showOnlineStatus,
      showLastActive: settings.showLastActive ?? showLastActive,
      twoFactorEnabled: settings.twoFactorEnabled ?? twoFactorAuth,
    };

    await updateUser({
      privacySettings: updatedSettings,
    });
  };

  const handleChangePassword = async () => {
    if (!user) return;

    if (!newPassword || !confirmPassword) {
      setPasswordError('Please fill in all password fields');
      return;
    }

    if (user.password) {
      if (!currentPassword) {
        setPasswordError('Please enter your current password');
        return;
      }
      if (currentPassword !== user.password) {
        setPasswordError('Current password is incorrect');
        return;
      }
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    await updateUser({
      password: newPassword,
    });

    setPasswordError('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordSection(false);
    setShowPasswordSuccessModal(true);
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteAccount = async () => {
    if (!user) return;

    setShowDeleteModal(false);

    await StorageService.deleteUser(user.id);

    logout();
  };

  const MenuItem = ({ icon, label, onPress, showArrow = true, rightElement }: any) => (
    <Pressable
      style={[styles.menuItem, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
      onPress={onPress}
    >
      <View style={styles.menuItemLeft}>
        <Feather name={icon} size={20} color={theme.textSecondary} />
        <ThemedText style={[Typography.body, { marginLeft: Spacing.md }]}>
          {label}
        </ThemedText>
      </View>
      {rightElement || (showArrow ? (
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      ) : null)}
    </Pressable>
  );

  const SwitchItem = ({ icon, label, value, onValueChange }: any) => (
    <View style={[styles.menuItem, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
      <View style={styles.menuItemLeft}>
        <Feather name={icon} size={20} color={theme.textSecondary} />
        <ThemedText style={[Typography.body, { marginLeft: Spacing.md }]}>
          {label}
        </ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.primary }}
        thumbColor={theme.backgroundSecondary}
      />
    </View>
  );

  return (
    <ScreenScrollView contentContainerStyle={{ paddingTop: Spacing.lg }}>
      <View style={styles.section}>
        <ThemedText style={[Typography.h3, { marginBottom: Spacing.md, color: theme.textSecondary }]}>
          Account Security
        </ThemedText>
        
        <MenuItem
          icon="lock"
          label="Change Password"
          onPress={() => setShowPasswordSection(!showPasswordSection)}
        />

        {showPasswordSection && (
          <View style={[styles.passwordSection, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
            {passwordError ? (
              <View style={[styles.errorBox, { backgroundColor: '#FEE2E2', borderColor: '#DC2626' }]}>
                <Feather name="alert-circle" size={16} color="#DC2626" />
                <ThemedText style={[Typography.small, { color: '#DC2626', marginLeft: Spacing.sm }]}>
                  {passwordError}
                </ThemedText>
              </View>
            ) : null}
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
              placeholder="Current Password"
              placeholderTextColor={theme.textSecondary}
              value={currentPassword}
              onChangeText={(text) => {
                setCurrentPassword(text);
                setPasswordError('');
              }}
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
              placeholder="New Password"
              placeholderTextColor={theme.textSecondary}
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                setPasswordError('');
              }}
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
              placeholder="Confirm New Password"
              placeholderTextColor={theme.textSecondary}
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setPasswordError('');
              }}
              secureTextEntry
              autoCapitalize="none"
            />
            <Pressable
              style={[styles.changePasswordButton, { backgroundColor: theme.primary }]}
              onPress={handleChangePassword}
            >
              <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                Update Password
              </ThemedText>
            </Pressable>
          </View>
        )}

        <SwitchItem
          icon="shield"
          label="Two-Factor Authentication"
          value={twoFactorAuth}
          onValueChange={async (value: boolean) => {
            setTwoFactorAuth(value);
            await updatePrivacySettings({ twoFactorEnabled: value });
          }}
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={[Typography.h3, { marginBottom: Spacing.md, color: theme.textSecondary }]}>
          Privacy Settings
        </ThemedText>
        
        <SwitchItem
          icon="eye"
          label="Profile Visible to Others"
          value={profileVisible}
          onValueChange={async (value: boolean) => {
            setProfileVisible(value);
            await updatePrivacySettings({ profileVisible: value });
          }}
        />

        <SwitchItem
          icon="circle"
          label="Show Online Status"
          value={showOnlineStatus}
          onValueChange={async (value: boolean) => {
            setShowOnlineStatus(value);
            await updatePrivacySettings({ showOnlineStatus: value });
          }}
        />

        <SwitchItem
          icon="clock"
          label="Show Last Active Time"
          value={showLastActive}
          onValueChange={async (value: boolean) => {
            setShowLastActive(value);
            await updatePrivacySettings({ showLastActive: value });
          }}
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={[Typography.h3, { marginBottom: Spacing.md, color: theme.textSecondary }]}>
          Data & Privacy
        </ThemedText>
        
        <MenuItem
          icon="download"
          label="Download My Data"
          onPress={() => navigation.navigate('DownloadData')}
        />

        <MenuItem
          icon="file-text"
          label="Privacy Policy"
          onPress={() => navigation.navigate('PrivacyPolicy')}
        />

        <MenuItem
          icon="shield"
          label="Terms of Service"
          onPress={() => navigation.navigate('TermsOfService')}
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={[Typography.h3, { marginBottom: Spacing.md, color: theme.textSecondary }]}>
          Danger Zone
        </ThemedText>
        
        <Pressable
          style={[styles.deleteButton, { backgroundColor: theme.backgroundSecondary, borderColor: '#DC2626' }]}
          onPress={handleDeleteAccount}
        >
          <Feather name="trash-2" size={20} color="#DC2626" />
          <ThemedText style={[Typography.body, { marginLeft: Spacing.md, color: '#DC2626', fontWeight: '600' }]}>
            Delete Account
          </ThemedText>
        </Pressable>
      </View>

      <Modal
        visible={showDeleteModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.modalHeader}>
              <Feather name="alert-triangle" size={32} color="#DC2626" />
            </View>
            
            <View style={styles.modalContent}>
              <ThemedText style={[Typography.h2, { textAlign: 'center', marginBottom: Spacing.sm }]}>
                Delete Account
              </ThemedText>
              <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginBottom: Spacing.xl }]}>
                Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.
              </ThemedText>
              
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalButton, { backgroundColor: theme.backgroundSecondary }]}
                  onPress={() => setShowDeleteModal(false)}
                >
                  <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
                    Cancel
                  </ThemedText>
                </Pressable>
                
                <Pressable
                  style={[styles.modalButton, styles.deleteModalButton]}
                  onPress={confirmDeleteAccount}
                >
                  <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                    Delete
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPasswordSuccessModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowPasswordSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.modalHeader}>
              <Feather name="check-circle" size={32} color="#10B981" />
            </View>
            
            <View style={styles.modalContent}>
              <ThemedText style={[Typography.h2, { textAlign: 'center', marginBottom: Spacing.sm }]}>
                Password Updated
              </ThemedText>
              <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginBottom: Spacing.xl }]}>
                Your password has been successfully changed.
              </ThemedText>
              
              <Pressable
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={() => setShowPasswordSuccessModal(false)}
              >
                <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                  OK
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenScrollView>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.xl,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  passwordSection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    fontSize: 16,
  },
  changePasswordButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContainer: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalContent: {
    alignItems: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  deleteModalButton: {
    backgroundColor: '#DC2626',
  },
});

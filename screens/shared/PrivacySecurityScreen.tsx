import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, TextInput, Switch, Modal, Alert } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackNavigator';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import { supabase } from '../../lib/supabase';
import { ModeSwitchToggle } from '../../components/ModeSwitchToggle';

type PrivacySecurityScreenNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'PrivacySecurity'>;

export const PrivacySecurityScreen = () => {
  const { theme } = useTheme();
  const { user, logout, updateUser, softDeleteAccount, activeMode, canSwitchMode, isFirstTimeHost } = useAuth();
  const navigation = useNavigation<PrivacySecurityScreenNavigationProp>();
  
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [profileVisible, setProfileVisible] = useState(true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [showLastActive, setShowLastActive] = useState(false);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  
  const [acceptAgentOffers, setAcceptAgentOffers] = useState(true);
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
    setAcceptAgentOffers(user?.acceptAgentOffers ?? true);
  }, [user]);

  const handleToggleAgentOffers = async (value: boolean) => {
    if (!user?.id) return;
    setAcceptAgentOffers(value);

    const { error } = await supabase
      .from('users')
      .update({ accept_agent_offers: value })
      .eq('id', user.id);

    if (error) {
      setAcceptAgentOffers(!value);
      Alert.alert('Error', 'Could not update preference. Please try again.');
      return;
    }

    await updateUser({ acceptAgentOffers: value });

    if (!value) {
      supabase
        .from('agent_shortlists')
        .delete()
        .eq('renter_id', user.id)
        .then(() => {});

      supabase
        .from('company_shortlisted_renters')
        .delete()
        .eq('renter_id', user.id)
        .then(() => {});

      supabase
        .from('agent_group_invites')
        .update({ status: 'cancelled' })
        .eq('renter_id', user.id)
        .eq('status', 'pending')
        .then(() => {});
    }
  };

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
    await softDeleteAccount();
  };

  const MenuItem = ({ icon, label, onPress, showArrow = true, rightElement }: any) => (
    <Pressable
      style={[styles.menuItem, { backgroundColor: '#1a1a1a', borderColor: '#333333' }]}
      onPress={onPress}
    >
      <View style={styles.menuItemLeft}>
        <Feather name={icon} size={20} color="#A0A0A0" />
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
    <View style={[styles.menuItem, { backgroundColor: '#1a1a1a', borderColor: '#333333' }]}>
      <View style={styles.menuItemLeft}>
        <Feather name={icon} size={20} color="#A0A0A0" />
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
    <ScreenScrollView style={{ backgroundColor: '#111111' }} contentContainerStyle={{ paddingTop: Spacing.lg, backgroundColor: '#111111' }}>
      {canSwitchMode ? (
        <View style={[styles.section, { alignItems: 'center' }]}>
          <ThemedText style={[Typography.h3, { marginBottom: Spacing.sm, color: theme.textSecondary }]}>
            Your Mode
          </ThemedText>
          <ModeSwitchToggle />
          <ThemedText style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: Spacing.sm, textAlign: 'center' }}>
            {activeMode === 'host'
              ? 'Switch to Renter to find your next place'
              : 'Switch to Host to manage your listings'}
          </ThemedText>
        </View>
      ) : isFirstTimeHost ? (
        <View style={[styles.section, { alignItems: 'center' }]}>
          <Pressable
            style={styles.becomeHostBtn}
            onPress={() => navigation.navigate('HostTypeSelect' as any)}
          >
            <View style={styles.becomeHostIcon}>
              <Feather name="home" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.becomeHostTitle}>Become a Host</ThemedText>
              <ThemedText style={styles.becomeHostSub}>List a room and find great renters</ThemedText>
            </View>
            <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.35)" />
          </Pressable>
        </View>
      ) : (user?.hostType === 'agent' || user?.hostType === 'company') ? (
        <View style={[styles.section]}>
          <View style={styles.agentLockNotice}>
            <Feather name="lock" size={16} color="rgba(255,255,255,0.35)" />
            <View style={styles.agentLockTextWrap}>
              <ThemedText style={styles.agentLockTitle}>
                {user?.hostType === 'agent' ? 'Agent Account' : 'Company Account'}
              </ThemedText>
              <ThemedText style={styles.agentLockSub}>
                To browse Rhome as a renter, sign up with a separate renter account.
              </ThemedText>
            </View>
          </View>
        </View>
      ) : null}

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
          <View style={[styles.passwordSection, { backgroundColor: '#1a1a1a', borderColor: '#333333' }]}>
            {passwordError ? (
              <View style={[styles.errorBox, { backgroundColor: '#FEE2E2', borderColor: '#DC2626' }]}>
                <Feather name="alert-circle" size={16} color="#DC2626" />
                <ThemedText style={[Typography.small, { color: '#DC2626', marginLeft: Spacing.sm }]}>
                  {passwordError}
                </ThemedText>
              </View>
            ) : null}
            <TextInput
              style={[styles.input, { backgroundColor: '#222222', color: '#FFFFFF', borderColor: '#333333' }]}
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
              style={[styles.input, { backgroundColor: '#222222', color: '#FFFFFF', borderColor: '#333333' }]}
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
              style={[styles.input, { backgroundColor: '#222222', color: '#FFFFFF', borderColor: '#333333' }]}
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

        {user?.role === 'renter' ? (
          <View style={[styles.agentOffersRow, { backgroundColor: '#1a1a1a', borderColor: '#333333' }]}>
            <View style={styles.agentOffersInfo}>
              <View style={styles.agentOffersLabelRow}>
                <Feather name="briefcase" size={20} color="#A0A0A0" />
                <ThemedText style={[Typography.body, { marginLeft: Spacing.md, fontWeight: '600' }]}>
                  Receive agent & company offers
                </ThemedText>
              </View>
              <ThemedText style={{ fontSize: 13, lineHeight: 18, color: theme.textSecondary, marginTop: 4, marginLeft: 32 }}>
                Allow licensed agents and property management companies to send you group invites and listing recommendations
              </ThemedText>
            </View>
            <Switch
              value={acceptAgentOffers}
              onValueChange={handleToggleAgentOffers}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={theme.backgroundSecondary}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <ThemedText style={[Typography.h3, { marginBottom: Spacing.md, color: theme.textSecondary }]}>
          Safety
        </ThemedText>
        
        <MenuItem
          icon="slash"
          label="Blocked Users"
          onPress={() => navigation.navigate('BlockedUsers' as any)}
        />

        <MenuItem
          icon="flag"
          label="My Reports"
          onPress={() => navigation.navigate('MyReports' as any)}
        />

        {user?.role === 'admin' ? (
          <MenuItem
            icon="shield"
            label="Moderation Queue"
            onPress={() => navigation.navigate('ModerationQueue' as any)}
          />
        ) : null}
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
      </View>

      <View style={styles.section}>
        <ThemedText style={[Typography.h3, { marginBottom: Spacing.md, color: theme.textSecondary }]}>
          Danger Zone
        </ThemedText>
        
        <Pressable
          style={[styles.deleteButton, { backgroundColor: '#1a1a1a', borderColor: '#DC2626' }]}
          onPress={handleDeleteAccount}
        >
          <Feather name="trash-2" size={20} color="#DC2626" />
          <ThemedText style={[Typography.body, { marginLeft: Spacing.md, color: '#DC2626', fontWeight: '600' }]}>
            Deactivate Account
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
          <View style={[styles.modalContainer, { backgroundColor: '#1a1a1a' }]}>
            <View style={styles.modalHeader}>
              <Feather name="alert-triangle" size={32} color="#DC2626" />
            </View>
            
            <View style={styles.modalContent}>
              <ThemedText style={[Typography.h2, { textAlign: 'center', marginBottom: Spacing.sm }]}>
                Deactivate Account
              </ThemedText>
              <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginBottom: Spacing.xl }]}>
                Your account will be deactivated and hidden from other users. You can recover it by logging back in within 30 days. After 30 days, your data will be permanently deleted.
              </ThemedText>
              
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalButton, { backgroundColor: '#222222' }]}
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
                    Deactivate
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
          <View style={[styles.modalContainer, { backgroundColor: '#1a1a1a' }]}>
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
  becomeHostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: '100%',
  },
  becomeHostIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ff6b5b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  becomeHostTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  becomeHostSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
  },
  agentLockNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  agentLockTextWrap: {
    flex: 1,
  },
  agentLockTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 3,
  },
  agentOffersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  agentOffersInfo: {
    flex: 1,
    marginRight: 16,
  },
  agentOffersLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  agentLockSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    lineHeight: 17,
  },
});

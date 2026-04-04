import React, { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from './VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { RhomeLogo } from './RhomeLogo';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  mode?: 'tab' | 'back' | 'none';
  rightActions?: ReactNode;
  onBack?: () => void;
  onLogoPress?: () => void;
  role?: 'host' | 'renter';
  hideSeparator?: boolean;
  bottomContent?: ReactNode;
}

export function AppHeader({
  title,
  subtitle,
  mode = 'tab',
  rightActions,
  onBack,
  onLogoPress,
  role = 'host',
  hideSeparator = false,
  bottomContent,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigation.goBack();
    }
  };

  const handleLogoPress = () => {
    if (onLogoPress) {
      onLogoPress();
    } else {
      const parent = navigation.getParent?.();
      if (role === 'renter') {
        if (parent) parent.navigate('Explore');
        else { try { navigation.navigate('Explore'); } catch {} }
      } else {
        if (parent) parent.navigate('Dashboard', { screen: 'DashboardMain' });
        else { try { navigation.navigate('DashboardMain'); } catch {} }
      }
    }
  };

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + 10 }]}>
      <View style={styles.row}>
        {mode === 'tab' ? (
          <Pressable onPress={handleLogoPress} hitSlop={8} style={styles.logoWrap}>
            <RhomeLogo variant="icon-only" size="sm" />
          </Pressable>
        ) : mode === 'back' ? (
          <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="rgba(255,255,255,0.8)" />
          </Pressable>
        ) : null}

        <View style={styles.titleWrap}>
          {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          {rightActions}
        </View>
      </View>

      {bottomContent ? (
        <View style={styles.bottomContent}>
          {bottomContent}
        </View>
      ) : null}

      {!hideSeparator ? <View style={styles.separator} /> : null}
    </View>
  );
}

interface HeaderIconButtonProps {
  icon: string;
  onPress: () => void;
  badge?: boolean;
  color?: string;
  activeColor?: string;
  active?: boolean;
}

export function HeaderIconButton({ icon, onPress, badge, color, activeColor, active }: HeaderIconButtonProps) {
  const defaultColor = 'rgba(255,255,255,0.55)';
  const iconColor = active ? (activeColor || '#ff6b5b') : (color || defaultColor);

  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.iconBtn}>
      <Feather name={icon as any} size={18} color={iconColor} />
      {badge ? <View style={styles.badge} /> : null}
    </Pressable>
  );
}

interface HeaderActionButtonProps {
  label: string;
  icon?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}

export function HeaderActionButton({ label, icon, onPress, variant = 'primary', disabled }: HeaderActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionBtn,
        variant === 'primary' && styles.actionBtnPrimary,
        variant === 'secondary' && styles.actionBtnSecondary,
        variant === 'ghost' && styles.actionBtnGhost,
        disabled ? { opacity: 0.4 } : null,
      ]}
    >
      {icon ? <Feather name={icon as any} size={14} color="#fff" /> : null}
      <Text style={[
        styles.actionBtnText,
        variant === 'ghost' && { color: '#ff6b5b' },
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#111',
    zIndex: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  logoWrap: {
    marginRight: 2,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  titleWrap: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  bottomContent: {
    paddingBottom: 6,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#ff6b5b',
    borderWidth: 1.5,
    borderColor: '#111',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionBtnPrimary: {
    backgroundColor: '#ff6b5b',
  },
  actionBtnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionBtnGhost: {
    backgroundColor: 'transparent',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

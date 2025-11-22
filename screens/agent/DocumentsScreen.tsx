import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';

export const DocumentsScreen = () => {
  const { theme } = useTheme();

  const DocumentItem = ({ icon, title, description }: any) => (
    <Pressable
      style={[styles.documentCard, { backgroundColor: Colors[theme].backgroundDefault }]}
      onPress={() => {}}
    >
      <View style={[styles.iconContainer, { backgroundColor: Colors[theme].primary }]}>
        <Feather name={icon} size={24} color="#FFFFFF" />
      </View>
      <View style={styles.documentInfo}>
        <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{title}</ThemedText>
        <ThemedText style={[Typography.caption, { color: Colors[theme].textSecondary, marginTop: Spacing.xs }]}>
          {description}
        </ThemedText>
      </View>
      <Feather name="chevron-right" size={20} color={Colors[theme].textSecondary} />
    </Pressable>
  );

  return (
    <ScreenScrollView>
      <View style={styles.container}>
        <ThemedText style={[Typography.h2, styles.sectionTitle]}>Templates</ThemedText>
        <DocumentItem
          icon="file-text"
          title="Lease Agreement"
          description="Standard residential lease template"
        />
        <DocumentItem
          icon="file-text"
          title="Property Disclosure"
          description="Required property disclosures"
        />
        <DocumentItem
          icon="file-text"
          title="Tenant Application"
          description="Application form template"
        />
        <DocumentItem
          icon="file-text"
          title="Move-In Checklist"
          description="Property condition checklist"
        />

        <ThemedText style={[Typography.h2, styles.sectionTitle, { marginTop: Spacing.xxl }]}>
          My Documents
        </ThemedText>
        <DocumentItem
          icon="folder"
          title="Signed Contracts"
          description="3 documents"
        />
        <DocumentItem
          icon="folder"
          title="Property Photos"
          description="24 images"
        />
        <DocumentItem
          icon="folder"
          title="Inspection Reports"
          description="5 documents"
        />
      </View>
    </ScreenScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  documentInfo: {
    flex: 1,
  },
});

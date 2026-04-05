import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, FlatList, TextInput, Alert, Platform, Linking } from 'react-native';
import * as Contacts from 'expo-contacts';
import * as Haptics from 'expo-haptics';
import { Feather } from './VectorIcons';
import { trackInvite, getReferralLink } from '../services/referralService';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  referralCode: string;
  onInvitesSent: (count: number) => void;
}

interface ContactItem {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  selected: boolean;
}

export function ContactInviteSheet({ visible, onClose, referralCode, onInvitesSent }: Props) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ContactItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (!visible) return;
    loadContacts();
  }, [visible]);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredContacts(contacts);
    } else {
      const q = search.toLowerCase();
      setFilteredContacts(contacts.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      ));
    }
  }, [search, contacts]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
        sort: Contacts.SortTypes.FirstName,
      });

      const mapped: ContactItem[] = (data || [])
        .filter(c => c.name && (c.phoneNumbers?.length || c.emails?.length))
        .map(c => ({
          id: c.id || c.name || '',
          name: c.name || '',
          phone: c.phoneNumbers?.[0]?.number,
          email: c.emails?.[0]?.email,
          selected: false,
        }))
        .slice(0, 200);

      setContacts(mapped);
      setFilteredContacts(mapped);
    } catch {
      setPermissionDenied(true);
    } finally {
      setLoading(false);
    }
  };

  const toggleContact = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setContacts(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  };

  const selectAll = () => {
    const allSelected = filteredContacts.every(c => c.selected);
    const ids = new Set(filteredContacts.map(c => c.id));
    setContacts(prev => prev.map(c => ids.has(c.id) ? { ...c, selected: !allSelected } : c));
  };

  const selectedCount = contacts.filter(c => c.selected).length;

  const handleSendInvites = async () => {
    const selected = contacts.filter(c => c.selected);
    if (!selected.length || !user?.id) return;

    const link = getReferralLink(referralCode);
    const message = `Hey! I've been using Rhome to find roommates and it's been great. Join me: ${link}`;

    for (const contact of selected) {
      await trackInvite(user.id, 'contacts', contact.email, contact.phone);
    }

    if (selected.length === 1 && selected[0].phone) {
      const url = Platform.OS === 'ios'
        ? `sms:${selected[0].phone}&body=${encodeURIComponent(message)}`
        : `sms:${selected[0].phone}?body=${encodeURIComponent(message)}`;
      try {
        await Linking.openURL(url);
      } catch {}
    } else {
      const url = Platform.OS === 'ios'
        ? `sms:&body=${encodeURIComponent(message)}`
        : `sms:?body=${encodeURIComponent(message)}`;
      try {
        await Linking.openURL(url);
      } catch {}
    }

    onInvitesSent(selected.length);
  };

  const getInitialColor = (name: string): string => {
    const colors = ['#ff6b5b', '#3b82f6', '#22C55E', '#6C5CE7', '#f59e0b', '#ec4899'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const renderContact = ({ item }: { item: ContactItem }) => {
    const initial = item.name.charAt(0).toUpperCase();
    const color = getInitialColor(item.name);
    return (
      <Pressable style={styles.contactRow} onPress={() => toggleContact(item.id)}>
        <View style={[styles.contactAvatar, { backgroundColor: `${color}20` }]}>
          <Text style={[styles.contactInitial, { color }]}>{initial}</Text>
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactDetail}>{item.phone || item.email || ''}</Text>
        </View>
        <View style={[styles.checkbox, item.selected ? styles.checkboxSelected : null]}>
          {item.selected ? <Feather name="check" size={12} color="#fff" /> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Invite from Contacts</Text>
            <Pressable onPress={selectAll}>
              <Text style={styles.selectAllText}>
                {filteredContacts.every(c => c.selected) ? 'Deselect All' : 'Select All'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <Feather name="search" size={16} color="#555" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search contacts..."
              placeholderTextColor="#555"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {permissionDenied ? (
            <View style={styles.emptyState}>
              <Feather name="lock" size={32} color="#333" />
              <Text style={styles.emptyTitle}>Contacts access needed</Text>
              <Text style={styles.emptyDesc}>
                Allow access to your contacts to invite friends directly.
              </Text>
            </View>
          ) : loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Loading contacts...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={item => item.id}
              renderItem={renderContact}
              style={styles.list}
              contentContainerStyle={styles.listContent}
            />
          )}

          {selectedCount > 0 ? (
            <View style={styles.footer}>
              <Pressable style={styles.sendBtn} onPress={handleSendInvites}>
                <Feather name="send" size={16} color="#fff" />
                <Text style={styles.sendBtnText}>Send {selectedCount} Invite{selectedCount > 1 ? 's' : ''}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '80%', minHeight: 400,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginTop: 10, marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  selectAllText: { fontSize: 13, fontWeight: '600', color: '#ff6b5b' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, backgroundColor: '#1a1a1a', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#fff' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  contactAvatar: {
    width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center',
  },
  contactInitial: { fontSize: 16, fontWeight: '700' },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 14, fontWeight: '600', color: '#fff' },
  contactDetail: { fontSize: 12, color: '#555', marginTop: 1 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#333',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxSelected: { backgroundColor: '#ff6b5b', borderColor: '#ff6b5b' },
  emptyState: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  emptyDesc: { fontSize: 13, color: '#A0A0A0', textAlign: 'center', lineHeight: 18 },
  footer: { padding: 20, paddingBottom: 36 },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#ff6b5b', borderRadius: 14, padding: 16,
  },
  sendBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

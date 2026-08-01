import { useEffect, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ContactsStackParamList } from '../../navigation/types';
import { useContact, useDeleteContact, useUpdateContact } from '../../api/hooks/useContacts';
import { useCollection } from '../../api/hooks/useCollection';
import { SelectField } from '../../components/SelectField';
import { MultiSelectChips } from '../../components/MultiSelectChips';
import { Spinner } from '../../components/Spinner';
import { Account, Contact } from '../../types';
import { formatDateTime, initials } from '../../utils';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<ContactsStackParamList, 'contactsDetail'>;

const TAG_OPTIONS = ['vip', 'newsletter', 'partner', 'decision-maker', 'follow-up', 'imported'].map((t) => ({
  value: t,
  label: t,
}));

type Tab = 'overview' | 'activity' | 'notes' | 'files';

export function ContactDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { data: contact, isLoading } = useContact(id);
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const accountsQ = useCollection<Account>('accounts');
  const accounts = accountsQ.data?.data ?? [];

  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    if (contact) navigation.setOptions({ title: contact.name });
  }, [contact, navigation]);

  if (isLoading || !contact) return <Spinner label="Loading contact…" />;

  const accountName = accounts.find((a) => a.id === contact.accountId)?.name;

  const persist = (next: Contact) => updateContact.mutateAsync(next);

  const startEdit = () => {
    setDraft({ ...contact });
    setEditing(true);
  };

  const save = async () => {
    if (!draft) return;
    await persist(draft);
    setEditing(false);
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    await persist({
      ...contact,
      notes: [{ id: `note-${Date.now()}`, text: noteText.trim(), createdAt: new Date().toISOString() }, ...contact.notes],
    });
    setNoteText('');
  };

  const removeNote = (noteId: string) => persist({ ...contact, notes: contact.notes.filter((n) => n.id !== noteId) });

  const attachFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: false });
    if (result.canceled) return;
    const asset = result.assets[0];
    await persist({
      ...contact,
      files: [...contact.files, { id: `file-${Date.now()}`, name: asset.name, size: asset.size ?? 0 }],
    });
  };

  const removeFile = (fileId: string) => persist({ ...contact, files: contact.files.filter((f) => f.id !== fileId) });

  const confirmDelete = async () => {
    await deleteContact.mutateAsync(id);
    navigation.navigate('contactsList');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} {...locatorProps(testIds.page('contact-detail'))}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(contact.name)}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{contact.name}</Text>
          <Text style={styles.headerSub}>
            {contact.title || 'No title'} {accountName ? `· ${accountName}` : ''}
          </Text>
        </View>
        <Pressable
          style={[styles.btn, styles.btnDanger]}
          onPress={() => setDeleting(true)}
          {...locatorProps(testIds.action('delete', 'contact'))}
        >
          <Text style={styles.btnDangerText}>🗑</Text>
        </Pressable>
      </View>

      <View style={styles.tabBar} {...locatorProps(testIds.raw('contact-tabs'))}>
        {(
          [
            ['overview', 'Overview'],
            ['activity', 'Activity'],
            ['notes', `Notes (${contact.notes.length})`],
            ['files', `Files (${contact.files.length})`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <Pressable key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'overview' && (
        <View style={styles.card}>
          {!editing ? (
            <>
              <Field label="Email" value={contact.email} />
              <Field label="Phone" value={contact.phone} />
              <Field label="Title" value={contact.title || '—'} />
              <Field label="Account" value={accountName ?? '—'} />
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Tags</Text>
                {contact.tags.length === 0 ? (
                  <Text style={styles.fieldValue}>—</Text>
                ) : (
                  <View style={styles.tagsRow}>
                    {contact.tags.map((t) => (
                      <Text key={t} style={styles.tagChip}>
                        {t}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
              <Pressable style={styles.btn} onPress={startEdit} {...locatorProps(testIds.action('edit', 'contact'))}>
                <Text>✏️ Edit</Text>
              </Pressable>
            </>
          ) : (
            draft && (
              <>
                <Text style={styles.label}>Email</Text>
                <TextInput style={styles.input} value={draft.email} onChangeText={(v) => setDraft({ ...draft, email: v })} />
                <Text style={styles.label}>Phone</Text>
                <TextInput style={styles.input} value={draft.phone} onChangeText={(v) => setDraft({ ...draft, phone: v })} />
                <Text style={styles.label}>Title</Text>
                <TextInput style={styles.input} value={draft.title} onChangeText={(v) => setDraft({ ...draft, title: v })} />
                <Text style={styles.label}>Account</Text>
                <SelectField
                  value={draft.accountId ?? ''}
                  options={[{ value: '', label: 'No account' }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
                  onChange={(v) => setDraft({ ...draft, accountId: v || null })}
                />
                <Text style={styles.label}>Tags</Text>
                <MultiSelectChips values={draft.tags} options={TAG_OPTIONS} onChange={(tags) => setDraft({ ...draft, tags })} />
                <View style={styles.formActions}>
                  <Pressable
                    style={[styles.btn, styles.btnPrimary]}
                    onPress={save}
                    disabled={updateContact.isPending}
                    {...locatorProps(testIds.action('save', 'contact'))}
                  >
                    <Text style={styles.btnPrimaryText}>{updateContact.isPending ? 'Saving…' : 'Save'}</Text>
                  </Pressable>
                  <Pressable style={styles.btn} onPress={() => setEditing(false)}>
                    <Text>Cancel</Text>
                  </Pressable>
                </View>
              </>
            )
          )}
        </View>
      )}

      {tab === 'activity' && (
        <View style={styles.card}>
          <View style={styles.activityRow}>
            <Text style={styles.activityIcon}>📅</Text>
            <Text style={styles.activityText}>Contact created</Text>
            <Text style={styles.activityTime}>{formatDateTime(contact.createdAt)}</Text>
          </View>
          {contact.notes.map((n) => (
            <View key={n.id} style={styles.activityRow}>
              <Text style={styles.activityIcon}>📝</Text>
              <Text style={styles.activityText}>Note added: "{n.text.slice(0, 60)}"</Text>
              <Text style={styles.activityTime}>{formatDateTime(n.createdAt)}</Text>
            </View>
          ))}
        </View>
      )}

      {tab === 'notes' && (
        <View style={styles.card}>
          <TextInput
            style={[styles.input, styles.textarea]}
            multiline
            numberOfLines={3}
            placeholder="Write a note…"
            value={noteText}
            onChangeText={setNoteText}
            {...locatorProps(testIds.raw('note-input'))}
          />
          <Pressable style={[styles.btn, styles.btnPrimary, styles.addNoteBtn]} onPress={addNote} {...locatorProps(testIds.raw('add-note-btn'))}>
            <Text style={styles.btnPrimaryText}>Add note</Text>
          </Pressable>
          {contact.notes.map((note) => (
            <View key={note.id} style={styles.noteItem}>
              <Text>{note.text}</Text>
              <View style={styles.noteFoot}>
                <Text style={styles.muted}>{formatDateTime(note.createdAt)}</Text>
                <Text style={styles.link} onPress={() => removeNote(note.id)}>
                  Delete
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {tab === 'files' && (
        <View style={styles.card}>
          <Pressable style={styles.btn} onPress={attachFile} {...locatorProps(testIds.raw('attach-file-btn'))}>
            <Text>📎 Attach file</Text>
          </Pressable>
          {contact.files.length === 0 && <Text style={styles.muted}>No files attached yet.</Text>}
          {contact.files.map((file) => (
            <View key={file.id} style={styles.fileItem}>
              <Text>
                📄 {file.name} <Text style={styles.muted}>({Math.max(1, Math.round(file.size / 1024))} KB)</Text>
              </Text>
              <Text style={styles.link} onPress={() => removeFile(file.id)}>
                Remove
              </Text>
            </View>
          ))}
        </View>
      )}

      <Modal visible={deleting} transparent animationType="fade" onRequestClose={() => setDeleting(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Delete contact — {contact.name}</Text>
            <Text>
              Delete "{contact.name}"? Their {contact.notes.length} note(s) and {contact.files.length} file(s) will be
              deleted with them. This cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.btn} onPress={() => setDeleting(false)}>
                <Text>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnDanger]}
                onPress={confirmDelete}
                {...locatorProps(testIds.raw('confirm-delete-btn'))}
              >
                <Text style={styles.btnDangerText}>Delete contact</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#2563eb', fontWeight: '700', fontSize: 18 },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 18, fontWeight: '700' },
  headerSub: { color: '#6b7280', fontSize: 13 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginBottom: 16 },
  tab: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#2563eb' },
  tabText: { fontSize: 13, color: '#6b7280' },
  tabTextActive: { color: '#2563eb', fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, gap: 12 },
  field: { gap: 2 },
  fieldLabel: { fontSize: 12, color: '#6b7280' },
  fieldValue: { fontSize: 15 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  tagChip: { fontSize: 11, backgroundColor: '#f3f4f6', color: '#374151', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  label: { fontSize: 13, color: '#374151', marginTop: 4, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  textarea: { textAlignVertical: 'top', minHeight: 70 },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start' },
  btnPrimary: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  btnPrimaryText: { color: '#fff', fontWeight: '600' },
  btnDanger: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  btnDangerText: { color: '#991b1b', fontWeight: '600' },
  addNoteBtn: { marginTop: 8, marginBottom: 4 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  activityIcon: { fontSize: 16 },
  activityText: { flex: 1, fontSize: 13 },
  activityTime: { fontSize: 11, color: '#9ca3af' },
  noteItem: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10, marginTop: 4, gap: 4 },
  noteFoot: { flexDirection: 'row', justifyContent: 'space-between' },
  muted: { color: '#9ca3af', fontSize: 12 },
  link: { color: '#2563eb', fontSize: 12, fontWeight: '600' },
  fileItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 12 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
});

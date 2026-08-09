import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useCreateUser, useDeleteUser, useToggleUserActive, useUpdateUser, useUsers } from '../api/hooks/useUsers';
import { useAudit } from '../api/hooks/useAudit';
import { ApiError } from '../api/client';
import { SelectField } from '../components/SelectField';
import { Spinner } from '../components/Spinner';
import { Role, User } from '../types';
import { formatDateTime } from '../utils';
import { locatorProps, testIds } from '../testIds';

const ROLES: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'rep', label: 'Sales Rep' },
  { value: 'viewer', label: 'Viewer' },
];

type Tab = 'users' | 'audit';

export function AdminScreen() {
  const { user } = useAuth();
  const readOnly = user?.role !== 'admin';
  const [tab, setTab] = useState<Tab>('users');

  const usersQ = useUsers();
  const auditQ = useAudit();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const toggleActive = useToggleUserActive();
  const deleteUser = useDeleteUser();

  const [editing, setEditing] = useState<User | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [reassigning, setReassigning] = useState<{ target: User; leads: number; accounts: number; deals: number } | null>(null);
  const [reassignTo, setReassignTo] = useState('');
  const [auditUserFilter, setAuditUserFilter] = useState('');

  const users = usersQ.data?.data ?? [];
  const audit = auditQ.data?.data ?? [];
  const auditUsers = useMemo(() => [...new Set(audit.map((a) => a.user))], [audit]);
  const filteredAudit = auditUserFilter ? audit.filter((a) => a.user === auditUserFilter) : audit;

  const startAdd = () => {
    setIsNew(true);
    setEditing({ id: '', name: '', email: '', password: 'Pass@123', role: 'rep', active: true });
  };

  const startEdit = (target: User) => {
    setIsNew(false);
    setEditing({ ...target });
  };

  const saveUser = async () => {
    if (!editing) return;
    if (!editing.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(editing.email)) return;
    if (isNew) await createUser.mutateAsync(editing);
    else await updateUser.mutateAsync(editing);
    setEditing(null);
  };

  const requestDelete = async (target: User) => {
    try {
      await deleteUser.mutateAsync({ id: target.id });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'has_owned_records') {
        const d = e.details as { leads: number; accounts: number; deals: number };
        setReassignTo('');
        setReassigning({ target, ...d });
      }
    }
  };

  const reassignAndDelete = async () => {
    if (!reassigning || !reassignTo) return;
    await deleteUser.mutateAsync({ id: reassigning.target.id, reassignTo });
    setReassigning(null);
  };

  return (
    <View style={styles.container} {...locatorProps(testIds.page('admin'))}>
      {readOnly && (
        <View style={styles.readOnlyBanner} {...locatorProps(testIds.raw('admin-readonly-banner'))}>
          <Text style={styles.readOnlyText}>You have read-only access to this area. Contact an administrator to make changes.</Text>
        </View>
      )}

      <View style={styles.tabRow} {...locatorProps(testIds.raw('admin-tabs'))}>
        <Pressable style={[styles.tab, tab === 'users' && styles.tabActive]} onPress={() => setTab('users')}>
          <Text style={[styles.tabText, tab === 'users' && styles.tabTextActive]}>Users ({users.length})</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'audit' && styles.tabActive]} onPress={() => setTab('audit')}>
          <Text style={[styles.tabText, tab === 'audit' && styles.tabTextActive]}>Audit log ({audit.length})</Text>
        </Pressable>
      </View>

      {tab === 'users' ? (
        usersQ.isLoading ? (
          <Spinner label="Loading users…" />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(u) => u.id}
            ListHeaderComponent={
              <Pressable style={[styles.addBtn, readOnly && styles.disabled]} disabled={readOnly} onPress={startAdd}>
                <Text style={styles.addBtnText}>+ Add user</Text>
              </Pressable>
            }
            renderItem={({ item }) => (
              <View style={styles.userRow}>
                <View style={styles.userMain}>
                  <Text style={styles.userName}>{item.name}</Text>
                  <Text style={styles.userEmail}>{item.email}</Text>
                  <Text style={styles.rolePill}>{ROLES.find((r) => r.value === item.role)?.label}</Text>
                </View>
                <View style={styles.userActions}>
                  <Switch
                    value={item.active}
                    disabled={readOnly}
                    onValueChange={() => toggleActive.mutate(item.id)}
                    {...locatorProps(testIds.raw(`user-active-${item.id}`))}
                  />
                  <Pressable disabled={readOnly} onPress={() => startEdit(item)}>
                    <Text style={[styles.link, readOnly && styles.disabledText]}>Edit</Text>
                  </Pressable>
                  <Pressable disabled={readOnly} onPress={() => requestDelete(item)}>
                    <Text style={[styles.link, readOnly && styles.disabledText]}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            )}
          />
        )
      ) : (
        <View style={styles.flex}>
          <View style={styles.auditFilterRow}>
            <SelectField
              value={auditUserFilter}
              options={[{ value: '', label: 'All users' }, ...auditUsers.map((u) => ({ value: u, label: u }))]}
              onChange={setAuditUserFilter}
              testID="audit-user-filter"
            />
          </View>
          {auditQ.isLoading ? (
            <Spinner label="Loading audit log…" />
          ) : (
            <FlatList
              data={filteredAudit}
              keyExtractor={(a) => a.id}
              ListEmptyComponent={<Text style={styles.empty}>No audit entries.</Text>}
              renderItem={({ item }) => (
                <View style={styles.auditRow}>
                  <Text style={styles.auditWhen}>{formatDateTime(item.when)}</Text>
                  <Text style={styles.auditUser}>{item.user}</Text>
                  <Text style={styles.auditAction}>{item.action}</Text>
                  <Text style={styles.auditDetail}>{item.detail}</Text>
                </View>
              )}
            />
          )}
        </View>
      )}

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <ScrollView>
              <Text style={styles.modalTitle}>{isNew ? 'Add user' : `Edit user — ${editing?.name}`}</Text>
              {editing && (
                <>
                  <Text style={styles.label}>Full name *</Text>
                  <TextInput
                    style={styles.input}
                    value={editing.name}
                    onChangeText={(v) => setEditing({ ...editing, name: v })}
                    {...locatorProps(testIds.raw('user-name'))}
                  />
                  <Text style={styles.label}>Email *</Text>
                  <TextInput
                    style={styles.input}
                    autoCapitalize="none"
                    value={editing.email}
                    onChangeText={(v) => setEditing({ ...editing, email: v })}
                    {...locatorProps(testIds.raw('user-email'))}
                  />
                  <Text style={styles.label}>Role</Text>
                  <SelectField
                    value={editing.role}
                    options={ROLES}
                    onChange={(v) => setEditing({ ...editing, role: v as Role })}
                    testID="user-role"
                  />
                  <View style={styles.switchRow}>
                    <Switch value={editing.active} onValueChange={(v) => setEditing({ ...editing, active: v })} />
                    <Text>Active</Text>
                  </View>
                </>
              )}
              <View style={styles.modalActions}>
                <Pressable style={styles.btn} onPress={() => setEditing(null)}>
                  <Text>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.btnPrimary]} onPress={saveUser} {...locatorProps(testIds.raw('user-save-btn'))}>
                  <Text style={styles.btnPrimaryText}>Save user</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!reassigning} transparent animationType="fade" onRequestClose={() => setReassigning(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Delete user — {reassigning?.target.name}</Text>
            {reassigning && (
              <>
                <View style={styles.banner} {...locatorProps(testIds.raw('reassign-banner'))}>
                  <Text style={styles.bannerText}>
                    {reassigning.target.name} owns {reassigning.leads} lead(s), {reassigning.accounts} account(s) and{' '}
                    {reassigning.deals} deal(s). These must be reassigned before the user can be deleted.
                  </Text>
                </View>
                <Text style={styles.label}>Reassign all records to *</Text>
                <SelectField
                  value={reassignTo}
                  options={users.filter((u) => u.id !== reassigning.target.id && u.active).map((u) => ({ value: u.id, label: u.name }))}
                  onChange={setReassignTo}
                  testID="reassign-select"
                />
              </>
            )}
            <View style={styles.modalActions}>
              <Pressable style={styles.btn} onPress={() => setReassigning(null)}>
                <Text>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnDanger]}
                disabled={!reassignTo}
                onPress={reassignAndDelete}
                {...locatorProps(testIds.raw('reassign-delete-btn'))}
              >
                <Text style={styles.btnDangerText}>Reassign & delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  readOnlyBanner: { backgroundColor: '#e0f2fe', margin: 16, marginBottom: 0, borderRadius: 8, padding: 10 },
  readOnlyText: { color: '#075985', fontSize: 13 },
  tabRow: { flexDirection: 'row', gap: 8, padding: 16 },
  tab: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  tabActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  tabText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  addBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 10, marginHorizontal: 16, marginBottom: 12, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '600' },
  disabled: { opacity: 0.5 },
  disabledText: { color: '#9ca3af' },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  userMain: { flex: 1, gap: 2 },
  userName: { fontWeight: '600', fontSize: 14 },
  userEmail: { fontSize: 12, color: '#6b7280' },
  rolePill: { fontSize: 11, color: '#5b21b6', marginTop: 2 },
  userActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  link: { color: '#2563eb', fontWeight: '600', fontSize: 12 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
  auditFilterRow: { paddingHorizontal: 16, marginBottom: 8 },
  auditRow: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  auditWhen: { fontSize: 11, color: '#9ca3af' },
  auditUser: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  auditAction: { fontSize: 11, color: '#5b21b6', fontFamily: 'monospace' },
  auditDetail: { fontSize: 12, marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: '#fff', borderRadius: 12, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 13, color: '#374151', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  btn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  btnPrimary: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  btnPrimaryText: { color: '#fff', fontWeight: '600' },
  btnDanger: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  btnDangerText: { color: '#991b1b', fontWeight: '600' },
  banner: { backgroundColor: '#e0f2fe', borderRadius: 8, padding: 10, marginTop: 8 },
  bannerText: { color: '#075985', fontSize: 13 },
});

import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ModulesStackParamList } from '../../navigation/types';
import { useDeleteProduct, useProduct, useProductDependents, useUpdateProduct } from '../../api/hooks/useProducts';
import { SelectField } from '../../components/SelectField';
import { Spinner } from '../../components/Spinner';
import { Product, PRODUCT_CATEGORIES } from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<ModulesStackParamList, 'productsDetail'>;

export function ProductDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { data: product, isLoading } = useProduct(id);
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const { data: dependents } = useProductDependents(deleting ? id : '');

  useEffect(() => {
    if (product) navigation.setOptions({ title: product.name });
  }, [product, navigation]);

  if (isLoading || !product) return <Spinner label="Loading product…" />;

  const startEdit = () => {
    setDraft({ ...product });
    setEditing(true);
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return;
    await updateProduct.mutateAsync(draft);
    setEditing(false);
  };

  const hasDependents = !!dependents && (dependents.leadCount > 0 || dependents.quoteCount > 0);

  const confirmDelete = async () => {
    await deleteProduct.mutateAsync(id);
    navigation.navigate('productsList');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} {...locatorProps(testIds.page('product-detail'))}>
      <View style={styles.header}>
        <Text
          style={[styles.statusPill, product.active ? styles.pillActive : styles.pillInactive]}
          {...locatorProps(testIds.raw('product-status'))}
        >
          {product.active ? 'Active' : 'Inactive'}
        </Text>
        {!editing ? (
          <View style={styles.headerActions}>
            <Pressable style={styles.btn} onPress={startEdit} {...locatorProps(testIds.action('edit', 'product'))}>
              <Text>✏️ Edit</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnDanger]}
              onPress={() => {
                setConfirmName('');
                setDeleting(true);
              }}
              {...locatorProps(testIds.action('delete', 'product'))}
            >
              <Text style={styles.btnDangerText}>🗑 Delete</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.headerActions}>
            <Pressable style={styles.btn} onPress={() => setEditing(false)}>
              <Text>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={save}
              disabled={updateProduct.isPending}
              {...locatorProps(testIds.action('save', 'product'))}
            >
              <Text style={styles.btnPrimaryText}>{updateProduct.isPending ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {!editing ? (
        <View style={styles.card}>
          <Field label="SKU" value={product.sku} />
          <Field label="Category" value={product.category} />
          <Field label="Price" value={formatCurrency(product.price)} />
          <Field label="Description" value={product.description || '—'} />
          <Field label="Created" value={formatDate(product.createdAt)} />
        </View>
      ) : (
        draft && (
          <View style={styles.card}>
            <Text style={styles.label}>Product name *</Text>
            <TextInput style={styles.input} value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} />
            <Text style={styles.label}>Category</Text>
            <SelectField
              value={draft.category}
              options={PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c }))}
              onChange={(v) => setDraft({ ...draft, category: v })}
            />
            <Text style={styles.label}>Price ($)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={String(draft.price)}
              onChangeText={(v) => setDraft({ ...draft, price: Number(v) || 0 })}
            />
            <View style={styles.switchRow}>
              <Switch value={draft.active} onValueChange={(v) => setDraft({ ...draft, active: v })} />
              <Text>Active</Text>
            </View>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              multiline
              numberOfLines={3}
              value={draft.description}
              onChangeText={(v) => setDraft({ ...draft, description: v })}
            />
          </View>
        )
      )}

      <Modal visible={deleting} transparent animationType="fade" onRequestClose={() => setDeleting(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Delete product — {product.name}</Text>
            {!hasDependents ? (
              <Text>Delete "{product.name}"? This cannot be undone.</Text>
            ) : (
              <>
                <View style={styles.banner}>
                  {dependents!.leadCount > 0 && (
                    <Text style={styles.bannerText}>
                      {dependents!.leadCount} lead(s) reference this product. Deleting it will unlink the product from
                      those leads — the leads themselves are kept.
                    </Text>
                  )}
                  {dependents!.quoteCount > 0 && (
                    <Text style={styles.bannerText}>
                      {dependents!.quoteCount} quote(s) reference this product in a line item — those quotes will keep
                      showing the product's name as a historical record.
                    </Text>
                  )}
                </View>
                <Text style={styles.label}>Type the product name to confirm</Text>
                <TextInput
                  style={styles.input}
                  placeholder={product.name}
                  value={confirmName}
                  onChangeText={setConfirmName}
                  {...locatorProps(testIds.raw('delete-confirm-input'))}
                />
              </>
            )}
            <View style={styles.modalActions}>
              <Pressable style={styles.btn} onPress={() => setDeleting(false)}>
                <Text>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnDanger]}
                disabled={hasDependents && confirmName !== product.name}
                onPress={confirmDelete}
                {...locatorProps(testIds.raw('confirm-delete-btn'))}
              >
                <Text style={styles.btnDangerText}>Delete product</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerActions: { flexDirection: 'row', gap: 8 },
  statusPill: { fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  pillActive: { backgroundColor: '#dcfce7', color: '#166534' },
  pillInactive: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, gap: 12 },
  field: { gap: 2 },
  fieldLabel: { fontSize: 12, color: '#6b7280' },
  fieldValue: { fontSize: 15 },
  label: { fontSize: 13, color: '#374151', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  textarea: { textAlignVertical: 'top', minHeight: 80 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  btn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  btnPrimary: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  btnPrimaryText: { color: '#fff', fontWeight: '600' },
  btnDanger: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  btnDangerText: { color: '#991b1b', fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 8 },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  banner: { backgroundColor: '#fee2e2', borderRadius: 8, padding: 10, gap: 6 },
  bannerText: { color: '#991b1b', fontSize: 13 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 },
});

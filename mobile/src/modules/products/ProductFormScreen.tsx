import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProductsStackParamList } from '../../navigation/types';
import { useCreateProduct } from '../../api/hooks/useProducts';
import { SelectField } from '../../components/SelectField';
import { PRODUCT_CATEGORIES } from '../../types';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<ProductsStackParamList, 'productsForm'>;

export function ProductFormScreen({ navigation }: Props) {
  const createProduct = useCreateProduct();

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState(PRODUCT_CATEGORIES[0]);
  const [priceText, setPriceText] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});

  const submit = async () => {
    const price = Number(priceText.replace(/[^0-9.]/g, ''));
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Product name is required.';
    if (!priceText.trim() || !Number.isFinite(price) || price <= 0) errs.price = 'Enter a valid price greater than 0.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const product = await createProduct.mutateAsync({
      name: name.trim(),
      sku: sku.trim() || undefined,
      category,
      price: Math.round(price),
      description: description.trim(),
      active,
    });
    navigation.replace('productsDetail', { id: product.id });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} {...locatorProps(testIds.page('product-form'))}>
      <Text style={styles.title}>New product</Text>

      <Text style={styles.label}>Product name *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} {...locatorProps(testIds.raw('product-name'))} />
      {errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}

      <Text style={styles.label}>SKU</Text>
      <TextInput
        style={styles.input}
        placeholder="Auto-generated if left empty"
        value={sku}
        onChangeText={setSku}
        {...locatorProps(testIds.raw('product-sku'))}
      />

      <Text style={styles.label}>Category</Text>
      <SelectField
        value={category}
        options={PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c }))}
        onChange={setCategory}
        testID="product-category"
      />

      <Text style={styles.label}>Price ($) *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 149"
        keyboardType="decimal-pad"
        value={priceText}
        onChangeText={setPriceText}
        {...locatorProps(testIds.raw('product-price'))}
      />
      {errors.price ? <Text style={styles.error}>{errors.price}</Text> : null}

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        multiline
        numberOfLines={3}
        value={description}
        onChangeText={setDescription}
        {...locatorProps(testIds.raw('product-description'))}
      />

      <View style={styles.switchRow}>
        <Switch value={active} onValueChange={setActive} />
        <Text>Active (available for lead generation)</Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text>Cancel</Text>
        </Pressable>
        {/* Deliberately no testID on the create/save button — locate by text (matches web's LOCATORS.md convention) */}
        <Pressable style={styles.primaryBtn} onPress={submit} disabled={createProduct.isPending}>
          <Text style={styles.primaryBtnText}>{createProduct.isPending ? 'Creating…' : 'Create product'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, color: '#374151', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  textarea: { textAlignVertical: 'top', minHeight: 80 },
  error: { color: '#dc2626', fontSize: 12, marginTop: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  primaryBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20 },
  primaryBtnText: { color: '#fff', fontWeight: '600' },
});

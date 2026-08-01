import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SelectField } from '../../components/SelectField';
import { Product, QuoteLineItem } from '../../types';
import { formatCurrency } from '../../utils';
import { computeQuoteTotals } from './quoteMath';
import { locatorProps, testIds } from '../../testIds';

export function QuoteLineItemsEditor({
  lineItems,
  onChange,
  products,
}: {
  lineItems: QuoteLineItem[];
  onChange: (items: QuoteLineItem[]) => void;
  products: Product[];
}) {
  const { lines, total } = computeQuoteTotals(lineItems);

  const updateLine = (id: string, patch: Partial<QuoteLineItem>) => {
    onChange(lineItems.map((li) => (li.id === id ? { ...li, ...patch } : li)));
  };

  const addLine = () => {
    onChange([
      ...lineItems,
      { id: `qline-${Date.now()}`, productId: '', productName: '', quantity: 1, unitPrice: 0, discountPct: 0 },
    ]);
  };

  const removeLine = (id: string) => onChange(lineItems.filter((li) => li.id !== id));

  const pickProduct = (id: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    updateLine(id, { productId, productName: product?.name ?? '', unitPrice: product?.price ?? 0 });
  };

  return (
    <View>
      {lines.length === 0 && <Text style={styles.empty}>No line items yet.</Text>}
      {lines.map((line) => (
        <View key={line.id} style={styles.row}>
          <View style={styles.rowTop}>
            <View style={styles.productField}>
              <SelectField
                value={line.productId}
                options={products.map((p) => ({ value: p.id, label: p.name }))}
                onChange={(v) => pickProduct(line.id, v)}
              />
            </View>
            {/* Deliberately no testID — locate by text, mirroring the web convention */}
            <Pressable onPress={() => removeLine(line.id)} hitSlop={8} {...locatorProps(testIds.raw('remove-line-item'))}>
              <Text style={styles.removeBtn}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.rowFields}>
            <View style={styles.smallField}>
              <Text style={styles.smallLabel}>Qty</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={String(line.quantity)}
                onChangeText={(v) => updateLine(line.id, { quantity: Number(v) || 0 })}
              />
            </View>
            <View style={styles.smallField}>
              <Text style={styles.smallLabel}>Unit price</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={String(line.unitPrice)}
                onChangeText={(v) => updateLine(line.id, { unitPrice: Number(v) || 0 })}
              />
            </View>
            <View style={styles.smallField}>
              <Text style={styles.smallLabel}>Discount %</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={String(line.discountPct)}
                onChangeText={(v) => updateLine(line.id, { discountPct: Math.min(100, Math.max(0, Number(v) || 0)) })}
              />
            </View>
          </View>
          <Text style={styles.lineTotal}>Line total: {formatCurrency(line.lineTotal, true)}</Text>
        </View>
      ))}
      <Pressable style={styles.addBtn} onPress={addLine} {...locatorProps(testIds.raw('add-line-item'))}>
        <Text style={styles.addBtnText}>+ Add line item</Text>
      </Pressable>
      <Text style={styles.total} {...locatorProps(testIds.raw('quote-total'))}>
        Total: {formatCurrency(total, true)}
      </Text>
    </View>
  );
}

export function QuoteLineItemsView({ lineItems, products }: { lineItems: QuoteLineItem[]; products: Product[] }) {
  const { lines, total } = computeQuoteTotals(lineItems);

  return (
    <View>
      {lines.length === 0 && <Text style={styles.empty}>No line items.</Text>}
      {lines.map((line) => {
        const product = products.find((p) => p.id === line.productId);
        return (
          <View key={line.id} style={styles.viewRow}>
            <Text style={styles.viewProduct}>{product ? product.name : `${line.productName} (deleted product)`}</Text>
            <Text style={styles.viewMeta}>
              {line.quantity} × {formatCurrency(line.unitPrice, true)} · {line.discountPct}% off
            </Text>
            <Text style={styles.lineTotal}>{formatCurrency(line.lineTotal, true)}</Text>
          </View>
        );
      })}
      <Text style={styles.total} {...locatorProps(testIds.raw('quote-total'))}>
        Total: {formatCurrency(total, true)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: '#9ca3af', fontSize: 13, marginBottom: 8 },
  row: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, marginBottom: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  productField: { flex: 1 },
  removeBtn: { color: '#dc2626', fontSize: 16, fontWeight: '700' },
  rowFields: { flexDirection: 'row', gap: 8 },
  smallField: { flex: 1 },
  smallLabel: { fontSize: 11, color: '#6b7280', marginBottom: 2 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, fontSize: 13 },
  lineTotal: { marginTop: 6, fontWeight: '600', fontSize: 13 },
  addBtn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start', marginTop: 4 },
  addBtnText: { fontWeight: '600' },
  total: { marginTop: 12, fontSize: 15, fontWeight: '700', textAlign: 'right' },
  viewRow: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingVertical: 8 },
  viewProduct: { fontSize: 14, fontWeight: '600' },
  viewMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
});

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TicketsStackParamList } from '../../navigation/types';
import { useCreateTicket } from '../../api/hooks/useTickets';
import { SelectField } from '../../components/SelectField';
import { TicketPriority, TICKET_PRIORITIES } from '../../types';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<TicketsStackParamList, 'ticketsForm'>;

export function TicketFormScreen({ navigation }: Props) {
  const createTicket = useCreateTicket();

  const [subject, setSubject] = useState('');
  const [requester, setRequester] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('Medium');
  const [errors, setErrors] = useState<{ subject?: string; requester?: string }>({});

  const submit = async () => {
    const errs: typeof errors = {};
    if (!subject.trim()) errs.subject = 'Subject is required.';
    if (!requester.trim()) errs.requester = 'Requester is required.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const ticket = await createTicket.mutateAsync({
      subject: subject.trim(),
      description: description.trim(),
      requester: requester.trim(),
      priority,
      status: 'Open',
      comments: [],
      attachments: [],
    });
    navigation.replace('ticketsDetail', { id: ticket.id });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} {...locatorProps(testIds.page('ticket-form'))}>
      <Text style={styles.title}>New ticket</Text>

      <Text style={styles.label}>Subject *</Text>
      <TextInput style={styles.input} value={subject} onChangeText={setSubject} {...locatorProps(testIds.raw('ticket-subject'))} />
      {errors.subject ? <Text style={styles.error}>{errors.subject}</Text> : null}

      <Text style={styles.label}>Requester *</Text>
      <TextInput style={styles.input} value={requester} onChangeText={setRequester} {...locatorProps(testIds.raw('ticket-requester'))} />
      {errors.requester ? <Text style={styles.error}>{errors.requester}</Text> : null}

      <Text style={styles.label}>Priority</Text>
      <SelectField
        value={priority}
        options={TICKET_PRIORITIES.map((p) => ({ value: p, label: p }))}
        onChange={(v) => setPriority(v as TicketPriority)}
        testID="ticket-priority-select"
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        multiline
        numberOfLines={4}
        value={description}
        onChangeText={setDescription}
        {...locatorProps(testIds.raw('ticket-description'))}
      />

      <View style={styles.actions}>
        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text>Cancel</Text>
        </Pressable>
        {/* Deliberately no testID — locate by text */}
        <Pressable style={styles.primaryBtn} onPress={submit} disabled={createTicket.isPending}>
          <Text style={styles.primaryBtnText}>{createTicket.isPending ? 'Creating…' : 'Create ticket'}</Text>
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
  textarea: { textAlignVertical: 'top', minHeight: 90 },
  error: { color: '#dc2626', fontSize: 12, marginTop: 4 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  primaryBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20 },
  primaryBtnText: { color: '#fff', fontWeight: '600' },
});

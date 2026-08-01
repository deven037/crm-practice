import { useEffect, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TicketsStackParamList } from '../../navigation/types';
import {
  useAddTicketComment,
  useDeleteTicket,
  useSetTicketPriority,
  useTicket,
  useTransitionTicket,
  useUpdateTicket,
} from '../../api/hooks/useTickets';
import { SelectField } from '../../components/SelectField';
import { Spinner } from '../../components/Spinner';
import { SlaCountdown } from './SlaCountdown';
import { TicketPriority, TICKET_PRIORITIES, TICKET_TRANSITIONS } from '../../types';
import { formatDateTime } from '../../utils';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<TicketsStackParamList, 'ticketsDetail'>;

const CANNED_RESPONSES = [
  { value: '', label: 'Insert canned response…' },
  { value: 'Thanks for reaching out! We are looking into this and will get back to you shortly.', label: 'Acknowledgement' },
  { value: 'Could you share a screenshot and the steps to reproduce the issue?', label: 'Request more info' },
  { value: 'This has been fixed in the latest release. Please refresh and try again.', label: 'Fixed in release' },
  { value: 'We are escalating this to our engineering team as a priority.', label: 'Escalation' },
];

export function TicketDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { data: ticket, isLoading } = useTicket(id);
  const transitionTicket = useTransitionTicket();
  const setPriority = useSetTicketPriority();
  const addComment = useAddTicketComment();
  const updateTicket = useUpdateTicket();
  const deleteTicket = useDeleteTicket();

  const [comment, setComment] = useState('');
  const [cannedValue, setCannedValue] = useState('');
  const [editingComment, setEditingComment] = useState<{ id: string; text: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (ticket) navigation.setOptions({ title: ticket.subject });
  }, [ticket, navigation]);

  if (isLoading || !ticket) return <Spinner label="Loading ticket…" />;

  const active = ticket.status === 'Open' || ticket.status === 'In Progress';

  const submitComment = async () => {
    if (!comment.trim()) return;
    await addComment.mutateAsync({ id: ticket.id, text: comment.trim() });
    setComment('');
    setCannedValue('');
  };

  const saveEditedComment = async () => {
    if (!editingComment) return;
    await updateTicket.mutateAsync({
      id: ticket.id,
      comments: ticket.comments.map((c) => (c.id === editingComment.id ? { ...c, text: editingComment.text } : c)),
    });
    setEditingComment(null);
  };

  const removeComment = (commentId: string) =>
    updateTicket.mutateAsync({ id: ticket.id, comments: ticket.comments.filter((c) => c.id !== commentId) });

  const attach = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: false });
    if (result.canceled) return;
    const asset = result.assets[0];
    await updateTicket.mutateAsync({
      id: ticket.id,
      attachments: [...ticket.attachments, { id: `file-${Date.now()}`, name: asset.name, size: asset.size ?? 0 }],
    });
  };

  const confirmDelete = async () => {
    await deleteTicket.mutateAsync(id);
    navigation.navigate('ticketsList');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} {...locatorProps(testIds.page('ticket-detail'))}>
      <View style={styles.header}>
        <Text style={[styles.statusPill, statusStyle(ticket.status)]} {...locatorProps(testIds.raw('ticket-status'))}>
          {ticket.status}
        </Text>
        <Pressable
          style={[styles.btn, styles.btnDanger]}
          onPress={() => setDeleting(true)}
          {...locatorProps(testIds.action('delete', 'ticket'))}
        >
          <Text style={styles.btnDangerText}>🗑 Delete</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            Requester: <Text style={styles.metaBold}>{ticket.requester}</Text>
          </Text>
          <SelectField
            value={ticket.priority}
            options={TICKET_PRIORITIES.map((p) => ({ value: p, label: p }))}
            onChange={(v) => setPriority.mutate({ id: ticket.id, priority: v as TicketPriority })}
            testID="ticket-priority"
          />
        </View>
        <SlaCountdown due={ticket.slaDue} active={active} />
        <Text style={styles.description}>{ticket.description}</Text>

        <View style={styles.transitionRow}>
          <Text style={styles.muted}>Move to:</Text>
          {TICKET_TRANSITIONS[ticket.status].map((next) => (
            <Pressable key={next} style={styles.btn} onPress={() => transitionTicket.mutate({ id: ticket.id, status: next })}>
              <Text>{next}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Attachments ({ticket.attachments.length})</Text>
        <Pressable style={styles.btn} onPress={attach} {...locatorProps(testIds.raw('ticket-attach-btn'))}>
          <Text>📎 Add attachment</Text>
        </Pressable>
        {ticket.attachments.map((f) => (
          <Text key={f.id} style={styles.fileItem}>
            📄 {f.name} <Text style={styles.muted}>({Math.max(1, Math.round(f.size / 1024))} KB)</Text>
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Comments ({ticket.comments.length})</Text>
        {ticket.comments.map((c) => (
          <View key={c.id} style={styles.comment}>
            <View style={styles.commentHead}>
              <Text style={styles.commentAuthor}>{c.author}</Text>
              <Text style={styles.muted}>{formatDateTime(c.createdAt)}</Text>
            </View>
            {editingComment?.id === c.id ? (
              <View>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  multiline
                  numberOfLines={2}
                  value={editingComment.text}
                  onChangeText={(v) => setEditingComment({ ...editingComment, text: v })}
                />
                <View style={styles.commentActions}>
                  <Pressable style={[styles.btn, styles.btnPrimary]} onPress={saveEditedComment}>
                    <Text style={styles.btnPrimaryText}>Save</Text>
                  </Pressable>
                  <Pressable style={styles.btn} onPress={() => setEditingComment(null)}>
                    <Text>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Text>{c.text}</Text>
            )}
            {editingComment?.id !== c.id && (
              <View style={styles.commentActions}>
                <Text style={styles.link} onPress={() => setEditingComment({ id: c.id, text: c.text })}>
                  Edit
                </Text>
                <Text style={styles.link} onPress={() => removeComment(c.id)}>
                  Delete
                </Text>
              </View>
            )}
          </View>
        ))}

        <SelectField
          value={cannedValue}
          options={CANNED_RESPONSES}
          onChange={(v) => {
            setCannedValue(v);
            if (v) setComment(v);
          }}
          testID="canned-response"
        />
        <TextInput
          style={[styles.input, styles.textarea, styles.commentInputSpacing]}
          multiline
          numberOfLines={3}
          placeholder="Write a comment…"
          value={comment}
          onChangeText={setComment}
          {...locatorProps(testIds.raw('comment-input'))}
        />
        <Pressable style={[styles.btn, styles.btnPrimary]} onPress={submitComment} {...locatorProps(testIds.raw('add-comment-btn'))}>
          <Text style={styles.btnPrimaryText}>Add comment</Text>
        </Pressable>
      </View>

      <Modal visible={deleting} transparent animationType="fade" onRequestClose={() => setDeleting(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {ticket.status !== 'Closed' ? (
              <>
                <Text style={styles.modalTitle}>Cannot delete ticket</Text>
                <View style={styles.bannerError} {...locatorProps(testIds.raw('delete-blocked-banner'))}>
                  <Text style={styles.bannerErrorText}>
                    Only Closed tickets can be deleted. This ticket is currently {ticket.status} — move it through the
                    workflow to Closed first.
                  </Text>
                </View>
                <Pressable style={styles.btn} onPress={() => setDeleting(false)}>
                  <Text>Close</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Delete ticket — {ticket.subject}</Text>
                <Text>
                  Delete "{ticket.subject}"? Its {ticket.comments.length} comment(s) and {ticket.attachments.length}{' '}
                  attachment(s) will be deleted with it.
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
                    <Text style={styles.btnDangerText}>Delete ticket</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function statusStyle(status: string) {
  switch (status) {
    case 'Open':
      return styles.pillOpen;
    case 'In Progress':
      return styles.pillProgress;
    case 'Resolved':
      return styles.pillResolved;
    default:
      return styles.pillClosed;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusPill: { fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  pillOpen: { backgroundColor: '#e0f2fe', color: '#075985' },
  pillProgress: { backgroundColor: '#fef3c7', color: '#92400e' },
  pillResolved: { backgroundColor: '#dcfce7', color: '#166534' },
  pillClosed: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, gap: 10, marginBottom: 16 },
  cardTitle: { fontWeight: '700', fontSize: 14 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText: { fontSize: 13 },
  metaBold: { fontWeight: '700' },
  description: { fontSize: 14, color: '#374151' },
  transitionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  muted: { color: '#9ca3af', fontSize: 12 },
  btn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start' },
  btnPrimary: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  btnPrimaryText: { color: '#fff', fontWeight: '600' },
  btnDanger: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  btnDangerText: { color: '#991b1b', fontWeight: '600' },
  fileItem: { fontSize: 13 },
  comment: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10, gap: 6 },
  commentHead: { flexDirection: 'row', justifyContent: 'space-between' },
  commentAuthor: { fontWeight: '700', fontSize: 13 },
  commentActions: { flexDirection: 'row', gap: 12 },
  link: { color: '#2563eb', fontSize: 12, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  textarea: { textAlignVertical: 'top', minHeight: 60 },
  commentInputSpacing: { marginTop: 4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  bannerError: { backgroundColor: '#fee2e2', borderRadius: 8, padding: 10 },
  bannerErrorText: { color: '#991b1b', fontSize: 13 },
});

import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { locatorProps, testIds } from '../../testIds';

/** Live SLA countdown — text changes every second; the native analogue of the web
 * version's DOM-mutating countdown (still worth automating: waiting on changing text). */
export function SlaCountdown({ due, active }: { due: string; active: boolean }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  if (!active) return <Text style={styles.muted}>SLA not applicable (ticket isn't active)</Text>;

  const diff = new Date(due).getTime() - now;
  if (diff <= 0) return <Text style={styles.breached}>SLA breached</Text>;

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return (
    <Text style={styles.countdown} {...locatorProps(testIds.raw('sla-countdown'))}>
      ⏱ SLA due in {hours}h {String(minutes).padStart(2, '0')}m {String(seconds).padStart(2, '0')}s
    </Text>
  );
}

const styles = StyleSheet.create({
  muted: { color: '#9ca3af', fontSize: 12 },
  breached: { color: '#dc2626', fontWeight: '700', fontSize: 12 },
  countdown: { color: '#374151', fontSize: 12 },
});

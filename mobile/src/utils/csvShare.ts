import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Native equivalent of the web app's downloadCsv — writes a CSV to the cache directory and
 * hands it to the OS share sheet instead of triggering a browser download. */
export async function shareCsv(filename: string, rows: (string | number)[][]) {
  const escapeCell = (cell: string | number) => {
    const s = String(cell);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((row) => row.map(escapeCell).join(',')).join('\n');

  // Unique-suffix the filename rather than checking/deleting a prior export — sidesteps
  // relying on File.exists()/delete() semantics we haven't needed to verify elsewhere.
  const uniqueName = filename.replace(/(\.csv)?$/, `-${Date.now()}$1`);
  const file = new File(Paths.cache, uniqueName);
  file.create();
  file.write(csv);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: filename });
  }
}

import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { locatorProps, testIds } from '../testIds';

const HELP_URL = 'https://automation-crm.netlify.app/help.html';

/**
 * Native equivalent of the web app's embedded help iframe. Appium can't see inside a
 * WebView's DOM from the native context — it requires switching to the `WEBVIEW_<pkg>`
 * context first (driver.contexts / switchContext), which is the direct analogue of the
 * original iframe's frame-switching practice.
 */
export function HelpWebViewScreen() {
  return (
    <View style={styles.container} {...locatorProps(testIds.page('help'))}>
      <WebView source={{ uri: HELP_URL }} {...locatorProps(testIds.raw('help-webview'))} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

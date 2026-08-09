import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsScreen } from '../../screens/SettingsScreen';
import { HelpWebViewScreen } from '../../screens/HelpWebViewScreen';

const Stack = createNativeStackNavigator();

export function SettingsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="settings" component={SettingsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="HelpWebView" component={HelpWebViewScreen} options={{ title: 'Help center' }} />
    </Stack.Navigator>
  );
}

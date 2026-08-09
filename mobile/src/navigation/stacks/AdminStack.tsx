import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminScreen } from '../../screens/AdminScreen';
import { HamburgerButton } from '../../components/HamburgerButton';

const Stack = createNativeStackNavigator();

export function AdminStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="admin" component={AdminScreen} options={{ title: 'Admin', headerLeft: () => <HamburgerButton /> }} />
    </Stack.Navigator>
  );
}

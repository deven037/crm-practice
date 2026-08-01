import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardScreen } from '../../screens/DashboardScreen';
import { HamburgerButton } from '../../components/HamburgerButton';

const Stack = createNativeStackNavigator();

export function DashboardStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="dashboard"
        component={DashboardScreen}
        options={{ title: 'Dashboard', headerLeft: () => <HamburgerButton /> }}
      />
    </Stack.Navigator>
  );
}

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminScreen } from '../../screens/AdminScreen';

const Stack = createNativeStackNavigator();

export function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="admin" component={AdminScreen} />
    </Stack.Navigator>
  );
}

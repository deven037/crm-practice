import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TasksScreen } from '../../screens/TasksScreen';
import { HamburgerButton } from '../../components/HamburgerButton';

const Stack = createNativeStackNavigator();

export function TasksStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="tasks" component={TasksScreen} options={{ title: 'Tasks', headerLeft: () => <HamburgerButton /> }} />
    </Stack.Navigator>
  );
}

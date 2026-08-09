import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TasksScreen } from '../../screens/TasksScreen';

const Stack = createNativeStackNavigator();

export function TasksStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="tasks" component={TasksScreen} />
    </Stack.Navigator>
  );
}

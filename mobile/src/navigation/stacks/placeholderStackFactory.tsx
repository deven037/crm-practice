import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PlaceholderScreen } from '../../screens/PlaceholderScreen';
import { HamburgerButton } from '../../components/HamburgerButton';

const Stack = createNativeStackNavigator();

/** Single-screen "coming soon" stack for modules not yet built — swapped for a real
 * multi-screen stack (see ProductsStack.tsx for the pattern) as each module lands. */
export function createPlaceholderStack(title: string) {
  return function PlaceholderStack() {
    return (
      <Stack.Navigator>
        <Stack.Screen
          name="placeholder"
          options={{ title, headerLeft: () => <HamburgerButton /> }}
        >
          {() => <PlaceholderScreen name={title} />}
        </Stack.Screen>
      </Stack.Navigator>
    );
  };
}

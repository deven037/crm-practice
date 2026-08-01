import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { Spinner } from '../components/Spinner';
import { AuthStack } from './AuthStack';
import { RootDrawer } from './RootDrawer';

/**
 * Native analogue of the web's RequireAuth three-way branch: undefined -> spinner while
 * the stored session is checked, null -> AuthStack (the web's redirect-to-/login), a real
 * user -> RootDrawer (hamburger menu + Dashboard as the default landing screen, since
 * Dashboard is the drawer's first-registered screen). This is a stack-swap at the root
 * rather than a per-route guard, which is the idiomatic React Navigation pattern.
 */
export function RootNavigator() {
  const { user } = useAuth();

  return (
    <NavigationContainer>
      {user === undefined ? <Spinner label="Checking session…" /> : user ? <RootDrawer /> : <AuthStack />}
    </NavigationContainer>
  );
}

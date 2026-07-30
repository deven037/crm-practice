import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { Spinner } from '../components/Spinner';
import { AuthStack } from './AuthStack';
import { AppTabs } from './AppTabs';

/**
 * Native analogue of the web's RequireAuth three-way branch: undefined -> spinner while
 * the stored session is checked, null -> AuthStack (the web's redirect-to-/login), a real
 * user -> AppTabs. This is a stack-swap at the root rather than a per-route guard, which is
 * the idiomatic React Navigation pattern (see mobile/README.md for why).
 */
export function RootNavigator() {
  const { user } = useAuth();

  return (
    <NavigationContainer>
      {user === undefined ? <Spinner label="Checking session…" /> : user ? <AppTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}

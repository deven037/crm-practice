import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AppTabsParamList } from './types';
import { ModulesStack } from './ModulesStack';
import { MoreStack } from './MoreStack';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';

const Tab = createBottomTabNavigator<AppTabsParamList>();

export function AppTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Dashboard">{() => <PlaceholderScreen name="Dashboard" />}</Tab.Screen>
      <Tab.Screen name="Modules" component={ModulesStack} />
      <Tab.Screen name="Tasks">{() => <PlaceholderScreen name="Tasks" />}</Tab.Screen>
      <Tab.Screen name="More" component={MoreStack} />
    </Tab.Navigator>
  );
}

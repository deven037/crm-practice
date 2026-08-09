import { createDrawerNavigator } from '@react-navigation/drawer';
import { DrawerParamList } from './types';
import { DrawerContent } from './DrawerContent';
import { ProductsStack } from './stacks/ProductsStack';
import { DashboardStack } from './stacks/DashboardStack';
import { LeadsStack } from './stacks/LeadsStack';
import { ContactsStack } from './stacks/ContactsStack';
import { AccountsStack } from './stacks/AccountsStack';
import { TicketsStack } from './stacks/TicketsStack';
import { CampaignsStack } from './stacks/CampaignsStack';
import { DealsStack } from './stacks/DealsStack';
import { QuotesStack } from './stacks/QuotesStack';
import { TasksStack } from './stacks/TasksStack';
import { AdminStack } from './stacks/AdminStack';
import { SettingsStack } from './stacks/SettingsStack';

const Drawer = createDrawerNavigator<DrawerParamList>();

export function RootDrawer() {
  return (
    <Drawer.Navigator
      screenOptions={{ headerShown: false }}
      drawerContent={(props) => <DrawerContent {...props} />}
    >
      <Drawer.Screen name="Dashboard" component={DashboardStack} />
      <Drawer.Screen name="LeadsStack" component={LeadsStack} />
      <Drawer.Screen name="ContactsStack" component={ContactsStack} />
      <Drawer.Screen name="AccountsStack" component={AccountsStack} />
      <Drawer.Screen name="ProductsStack" component={ProductsStack} />
      <Drawer.Screen name="CampaignsStack" component={CampaignsStack} />
      <Drawer.Screen name="QuotesStack" component={QuotesStack} />
      <Drawer.Screen name="DealsStack" component={DealsStack} />
      <Drawer.Screen name="Tasks" component={TasksStack} />
      <Drawer.Screen name="TicketsStack" component={TicketsStack} />
      <Drawer.Screen name="Admin" component={AdminStack} />
      <Drawer.Screen name="Settings" component={SettingsStack} />
    </Drawer.Navigator>
  );
}

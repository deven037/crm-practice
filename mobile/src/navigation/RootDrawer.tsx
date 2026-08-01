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
import { createPlaceholderStack } from './stacks/placeholderStackFactory';

const Drawer = createDrawerNavigator<DrawerParamList>();
const TasksStack = createPlaceholderStack('Tasks');
const AdminStack = createPlaceholderStack('Admin');
const SettingsStack = createPlaceholderStack('Settings');
const TestCatalogStack = createPlaceholderStack('Test Catalog');

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
      <Drawer.Screen name="TestCatalog" component={TestCatalogStack} />
      <Drawer.Screen name="Settings" component={SettingsStack} />
    </Drawer.Navigator>
  );
}

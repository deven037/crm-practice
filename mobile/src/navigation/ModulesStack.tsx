import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ModuleKey, ModulesStackParamList } from './types';
import { ModulesMenuScreen } from '../screens/ModulesMenuScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { ProductsListScreen } from '../modules/products/ProductsListScreen';
import { ProductFormScreen } from '../modules/products/ProductFormScreen';
import { ProductDetailScreen } from '../modules/products/ProductDetailScreen';

const Stack = createNativeStackNavigator<ModulesStackParamList>();

const PLACEHOLDER_MODULE_KEYS: ModuleKey[] = [
  'leads',
  'contacts',
  'accounts',
  'deals',
  'tickets',
  'campaigns',
  'quotes',
];

/**
 * One stack navigator holding ModulesMenu plus List/Form/Detail routes for all 8 modules.
 * Products is the first fully-built module; the remaining 7 are still registered as
 * placeholder trios until their real screens land (see the mobile port's per-module tasks)
 * — swapping a placeholder for real screens only touches this file.
 */
export function ModulesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ModulesMenu" component={ModulesMenuScreen} options={{ title: 'Modules' }} />

      <Stack.Screen name="productsList" component={ProductsListScreen} options={{ title: 'Products' }} />
      <Stack.Screen name="productsForm" component={ProductFormScreen} options={{ title: 'New product' }} />
      <Stack.Screen name="productsDetail" component={ProductDetailScreen} options={{ title: 'Product' }} />

      {PLACEHOLDER_MODULE_KEYS.map((key) => (
        <Stack.Group key={key}>
          <Stack.Screen name={`${key}List`}>{() => <PlaceholderScreen name={`${key} list`} />}</Stack.Screen>
          <Stack.Screen name={`${key}Form`}>{() => <PlaceholderScreen name={`${key} form`} />}</Stack.Screen>
          <Stack.Screen name={`${key}Detail`}>{() => <PlaceholderScreen name={`${key} detail`} />}</Stack.Screen>
        </Stack.Group>
      ))}
    </Stack.Navigator>
  );
}

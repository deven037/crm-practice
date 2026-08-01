import { Pressable, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProductsStackParamList } from '../types';
import { ProductsListScreen } from '../../modules/products/ProductsListScreen';
import { ProductFormScreen } from '../../modules/products/ProductFormScreen';
import { ProductDetailScreen } from '../../modules/products/ProductDetailScreen';
import { HamburgerButton } from '../../components/HamburgerButton';

const Stack = createNativeStackNavigator<ProductsStackParamList>();

export function ProductsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="productsList"
        component={ProductsListScreen}
        options={({ navigation }) => ({
          title: 'Products',
          headerLeft: () => <HamburgerButton />,
          // Deliberately no testID — locate by text, mirroring the web app's "+ New" convention
          headerRight: () => (
            <Pressable onPress={() => navigation.navigate('productsForm', {})} hitSlop={8}>
              <Text style={{ color: '#2563eb', fontWeight: '600' }}>+ New</Text>
            </Pressable>
          ),
        })}
      />
      <Stack.Screen name="productsForm" component={ProductFormScreen} options={{ title: 'New product' }} />
      <Stack.Screen name="productsDetail" component={ProductDetailScreen} options={{ title: 'Product' }} />
    </Stack.Navigator>
  );
}

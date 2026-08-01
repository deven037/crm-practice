import { Pressable, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DealsStackParamList } from '../types';
import { DealsBoardScreen } from '../../modules/deals/DealsBoardScreen';
import { DealFormScreen } from '../../modules/deals/DealFormScreen';
import { DealDetailScreen } from '../../modules/deals/DealDetailScreen';
import { HamburgerButton } from '../../components/HamburgerButton';

const Stack = createNativeStackNavigator<DealsStackParamList>();

export function DealsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="dealsBoard"
        component={DealsBoardScreen}
        options={({ navigation }) => ({
          title: 'Deals',
          headerLeft: () => <HamburgerButton />,
          headerRight: () => (
            <Pressable onPress={() => navigation.navigate('dealsForm', {})} hitSlop={8}>
              <Text style={{ color: '#2563eb', fontWeight: '600' }}>+ New</Text>
            </Pressable>
          ),
        })}
      />
      <Stack.Screen name="dealsForm" component={DealFormScreen} options={{ title: 'New deal' }} />
      <Stack.Screen name="dealsDetail" component={DealDetailScreen} options={{ title: 'Deal' }} />
    </Stack.Navigator>
  );
}

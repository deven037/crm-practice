import { Pressable, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AccountsStackParamList } from '../types';
import { AccountsListScreen } from '../../modules/accounts/AccountsListScreen';
import { AccountFormScreen } from '../../modules/accounts/AccountFormScreen';
import { AccountDetailScreen } from '../../modules/accounts/AccountDetailScreen';
import { HamburgerButton } from '../../components/HamburgerButton';

const Stack = createNativeStackNavigator<AccountsStackParamList>();

export function AccountsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="accountsList"
        component={AccountsListScreen}
        options={({ navigation }) => ({
          title: 'Accounts',
          headerLeft: () => <HamburgerButton />,
          headerRight: () => (
            <Pressable onPress={() => navigation.navigate('accountsForm', {})} hitSlop={8}>
              <Text style={{ color: '#2563eb', fontWeight: '600' }}>+ New</Text>
            </Pressable>
          ),
        })}
      />
      <Stack.Screen name="accountsForm" component={AccountFormScreen} options={{ title: 'New account' }} />
      <Stack.Screen name="accountsDetail" component={AccountDetailScreen} options={{ title: 'Account' }} />
    </Stack.Navigator>
  );
}

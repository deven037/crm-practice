import { Pressable, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ContactsStackParamList } from '../types';
import { ContactsListScreen } from '../../modules/contacts/ContactsListScreen';
import { ContactFormScreen } from '../../modules/contacts/ContactFormScreen';
import { ContactDetailScreen } from '../../modules/contacts/ContactDetailScreen';
import { HamburgerButton } from '../../components/HamburgerButton';

const Stack = createNativeStackNavigator<ContactsStackParamList>();

export function ContactsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="contactsList"
        component={ContactsListScreen}
        options={({ navigation }) => ({
          title: 'Contacts',
          headerLeft: () => <HamburgerButton />,
          headerRight: () => (
            <Pressable onPress={() => navigation.navigate('contactsForm', {})} hitSlop={8}>
              <Text style={{ color: '#2563eb', fontWeight: '600' }}>+ New</Text>
            </Pressable>
          ),
        })}
      />
      <Stack.Screen name="contactsForm" component={ContactFormScreen} options={{ title: 'New contact' }} />
      <Stack.Screen name="contactsDetail" component={ContactDetailScreen} options={{ title: 'Contact' }} />
    </Stack.Navigator>
  );
}

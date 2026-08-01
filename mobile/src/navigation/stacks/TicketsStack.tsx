import { Pressable, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TicketsStackParamList } from '../types';
import { TicketsListScreen } from '../../modules/tickets/TicketsListScreen';
import { TicketFormScreen } from '../../modules/tickets/TicketFormScreen';
import { TicketDetailScreen } from '../../modules/tickets/TicketDetailScreen';
import { HamburgerButton } from '../../components/HamburgerButton';

const Stack = createNativeStackNavigator<TicketsStackParamList>();

export function TicketsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ticketsList"
        component={TicketsListScreen}
        options={({ navigation }) => ({
          title: 'Tickets',
          headerLeft: () => <HamburgerButton />,
          headerRight: () => (
            <Pressable onPress={() => navigation.navigate('ticketsForm', {})} hitSlop={8}>
              <Text style={{ color: '#2563eb', fontWeight: '600' }}>+ New</Text>
            </Pressable>
          ),
        })}
      />
      <Stack.Screen name="ticketsForm" component={TicketFormScreen} options={{ title: 'New ticket' }} />
      <Stack.Screen name="ticketsDetail" component={TicketDetailScreen} options={{ title: 'Ticket' }} />
    </Stack.Navigator>
  );
}

import { Pressable, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LeadsStackParamList } from '../types';
import { LeadsListScreen } from '../../modules/leads/LeadsListScreen';
import { LeadFormScreen } from '../../modules/leads/LeadFormScreen';
import { LeadDetailScreen } from '../../modules/leads/LeadDetailScreen';
import { LeadConvertWizard } from '../../modules/leads/LeadConvertWizard';
import { HamburgerButton } from '../../components/HamburgerButton';

const Stack = createNativeStackNavigator<LeadsStackParamList>();

export function LeadsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="leadsList"
        component={LeadsListScreen}
        options={({ navigation }) => ({
          title: 'Leads',
          headerLeft: () => <HamburgerButton />,
          headerRight: () => (
            <Pressable onPress={() => navigation.navigate('leadsForm', {})} hitSlop={8}>
              <Text style={{ color: '#2563eb', fontWeight: '600' }}>+ New</Text>
            </Pressable>
          ),
        })}
      />
      <Stack.Screen name="leadsForm" component={LeadFormScreen} options={{ title: 'New lead' }} />
      <Stack.Screen name="leadsDetail" component={LeadDetailScreen} options={{ title: 'Lead' }} />
      <Stack.Screen name="leadConvertWizard" component={LeadConvertWizard} options={{ title: 'Convert lead' }} />
    </Stack.Navigator>
  );
}

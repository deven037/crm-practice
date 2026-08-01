import { Pressable, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CampaignsStackParamList } from '../types';
import { CampaignsListScreen } from '../../modules/campaigns/CampaignsListScreen';
import { CampaignFormScreen } from '../../modules/campaigns/CampaignFormScreen';
import { CampaignDetailScreen } from '../../modules/campaigns/CampaignDetailScreen';
import { HamburgerButton } from '../../components/HamburgerButton';

const Stack = createNativeStackNavigator<CampaignsStackParamList>();

export function CampaignsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="campaignsList"
        component={CampaignsListScreen}
        options={({ navigation }) => ({
          title: 'Campaigns',
          headerLeft: () => <HamburgerButton />,
          headerRight: () => (
            <Pressable onPress={() => navigation.navigate('campaignsForm', {})} hitSlop={8}>
              <Text style={{ color: '#2563eb', fontWeight: '600' }}>+ New</Text>
            </Pressable>
          ),
        })}
      />
      <Stack.Screen name="campaignsForm" component={CampaignFormScreen} options={{ title: 'New campaign' }} />
      <Stack.Screen name="campaignsDetail" component={CampaignDetailScreen} options={{ title: 'Campaign' }} />
    </Stack.Navigator>
  );
}

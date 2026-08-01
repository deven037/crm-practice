import { Pressable, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QuotesStackParamList } from '../types';
import { QuotesListScreen } from '../../modules/quotes/QuotesListScreen';
import { QuoteFormScreen } from '../../modules/quotes/QuoteFormScreen';
import { QuoteDetailScreen } from '../../modules/quotes/QuoteDetailScreen';
import { HamburgerButton } from '../../components/HamburgerButton';

const Stack = createNativeStackNavigator<QuotesStackParamList>();

export function QuotesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="quotesList"
        component={QuotesListScreen}
        options={({ navigation }) => ({
          title: 'Quotes',
          headerLeft: () => <HamburgerButton />,
          headerRight: () => (
            <Pressable onPress={() => navigation.navigate('quotesForm', {})} hitSlop={8}>
              <Text style={{ color: '#2563eb', fontWeight: '600' }}>+ New</Text>
            </Pressable>
          ),
        })}
      />
      <Stack.Screen name="quotesForm" component={QuoteFormScreen} options={{ title: 'New quote' }} />
      <Stack.Screen name="quotesDetail" component={QuoteDetailScreen} options={{ title: 'Quote' }} />
    </Stack.Navigator>
  );
}

import { Pressable, Text } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { locatorProps, testIds } from '../testIds';

/**
 * Top-left hamburger toggle for the root drawer. dispatch() bubbles DrawerActions up to
 * the nearest ancestor navigator that can handle it, so this works from inside any nested
 * per-module stack without needing a direct reference to the Drawer navigator.
 */
export function HamburgerButton() {
  const navigation = useNavigation();
  return (
    <Pressable
      onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
      hitSlop={12}
      style={{ paddingHorizontal: 12 }}
      {...locatorProps(testIds.raw('sidebar-toggle'))}
    >
      <Text style={{ fontSize: 20 }}>☰</Text>
    </Pressable>
  );
}

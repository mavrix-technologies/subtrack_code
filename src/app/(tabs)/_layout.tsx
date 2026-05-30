import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { router, Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/contexts/theme';

const tabItems: Record<string, { icon: string; selectedIcon: string; label: string }> = {
  index:         { icon: 'view-dashboard-outline', selectedIcon: 'view-dashboard',  label: 'Home' },
  assistant:     { icon: 'bell-ring-outline',       selectedIcon: 'bell-ring',      label: 'AI Remind' },
  subscriptions: { icon: 'repeat',                 selectedIcon: 'repeat',          label: 'Subs' },
  expenses:      { icon: 'wallet-outline',          selectedIcon: 'wallet',          label: 'Expenses' },
  invoices:      { icon: 'receipt-text-outline',    selectedIcon: 'receipt-text',    label: 'Invoices' },
  settings:      { icon: 'cog-outline',             selectedIcon: 'cog',             label: 'Settings' },
};

const tabs = ['index', 'subscriptions', 'expenses', 'invoices', 'assistant'];

function TabButton({
  route,
  focused,
  onPress,
  palette,
}: {
  route: { key: string; name: string };
  focused: boolean;
  onPress: () => void;
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  "use no memo";

  const item = tabItems[route.name];

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  if (!item) return null;

  const activeColor = palette.primary;
  const inactiveColor = 'rgba(255,255,255,0.75)';

  return (
    <Pressable
      key={route.key}
      onPress={handlePress}
      android_ripple={{ color: palette.primary + '33', borderless: true, radius: 28 }}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 2,
        paddingHorizontal: 4,
        flex: 1,
        minWidth: 0,
      }}
    >
      <View style={{ alignItems: 'center', gap: 3, minWidth: 0 }}>
        <View
          style={{
            minWidth: 42,
            height: 30,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            source={focused ? item.selectedIcon : item.icon}
            size={24}
            color={focused ? activeColor : inactiveColor}
          />
        </View>
        <Text
          style={{
            fontSize: 10,
            fontWeight: focused ? '800' : '600',
            color: focused ? activeColor : inactiveColor,
            letterSpacing: 0,
          }}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      </View>
    </Pressable>
  );
}

function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const focusedRoute = state.routes[state.index];
  const focusedOptions = descriptors[focusedRoute.key]?.options;
  const focusedTabBarStyle = StyleSheet.flatten(focusedOptions?.tabBarStyle as any);

  if (focusedTabBarStyle?.display === 'none') {
    return null;
  }

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: palette.navBackground,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 10,
        paddingTop: 10,
        paddingBottom: Math.max(12, insets.bottom + 4),
        boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.25)',
      }}
    >
      {tabs.map((name) => {
        const route = state.routes.find((r) => r.name === name);
        if (!route) return null;
        const index = state.routes.indexOf(route);
        return (
          <TabButton
            key={route.key}
            route={route}
            focused={state.index === index}
            onPress={() => navigation.navigate(name)}
            palette={palette}
          />
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { palette } = useTheme();
  const headerIconButton = {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  const headerIconButtonNeutral = {
    ...headerIconButton,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
  };
  const headerIconButtonPrimary = {
    ...headerIconButton,
    backgroundColor: palette.primary,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: palette.background },
        headerTitleStyle: { color: palette.text, fontWeight: '700' },
        headerTintColor: palette.text,
        /** Same background as app to avoid a flash between tab panels */
        sceneStyle: { backgroundColor: palette.background },
        /** Keep tab scenes mounted so switching tabs feels instant, not blank-then-paint */
        lazy: false,
        freezeOnBlur: false,
      }}
      tabBar={(props) => <AppTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Tabs.Screen name="assistant" options={{ title: 'AI Remind', tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen
        name="subscriptions"
        options={{
          title: 'Subscriptions',
          headerRight: () => (
            <Pressable style={[headerIconButtonPrimary, { marginRight: 10 }]} onPress={() => router.push('/add')}>
              <Icon source="plus" size={20} color="#FFFFFF" />
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Expenses',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 10 }}>
              <Pressable style={headerIconButtonNeutral} onPress={() => router.push('/friends')}>
                <Icon source="account-heart-outline" size={22} color={palette.text} />
              </Pressable>
              <Pressable style={headerIconButtonPrimary} onPress={() => router.push('/add-expense')}>
                <Icon source="plus" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: 'Invoices',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 10 }}>
              <Pressable style={headerIconButtonNeutral} onPress={() => router.push('/invoice/scan')}>
                <Icon source="camera-outline" size={21} color={palette.text} />
              </Pressable>
              <Pressable style={headerIconButtonPrimary} onPress={() => router.push('/invoice/create')}>
                <Icon source="plus" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          ),
        }}
      />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}

import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from 'react-native-paper';
import Animated, {
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/contexts/theme';

const tabItems: Record<string, { icon: string; selectedIcon: string; label: string }> = {
  index:         { icon: 'view-dashboard-outline', selectedIcon: 'view-dashboard',  label: 'Home' },
  subscriptions: { icon: 'repeat',                 selectedIcon: 'repeat',          label: 'Subs' },
  expenses:      { icon: 'wallet-outline',          selectedIcon: 'wallet',          label: 'Expenses' },
  invoices:      { icon: 'receipt-text-outline',    selectedIcon: 'receipt-text',    label: 'Invoices' },
  settings:      { icon: 'cog-outline',             selectedIcon: 'cog',             label: 'Settings' },
};

const tabs = ['index', 'subscriptions', 'expenses', 'invoices', 'settings'];

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
  const item = tabItems[route.name];
  const scale = useSharedValue(focused ? 1 : 0.88);
  const translateY = useSharedValue(focused ? -2 : 0);
  const opacity = useSharedValue(focused ? 1 : 0.75);

  useEffect(() => {
    if (focused) {
      scale.value = withSpring(1.15, { damping: 12, stiffness: 200, mass: 0.6 });
      translateY.value = withSpring(-3, { damping: 14, stiffness: 220 });
      opacity.value = withTiming(1, { duration: 150 });
    } else {
      scale.value = withSpring(1, { damping: 14, stiffness: 200 });
      translateY.value = withSpring(0, { damping: 14, stiffness: 220 });
      opacity.value = withTiming(0.75, { duration: 150 });
    }
  }, [focused, opacity, scale, translateY]);

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  const labelAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scale.value, [1, 1.15], [0.75, 1]),
  }));

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
        paddingVertical: 4,
        paddingHorizontal: 4,
        flex: 1,
        minWidth: 0,
      }}
    >
      <Animated.View style={{ alignItems: 'center', gap: 3, minWidth: 0 }}>
        <Animated.View style={iconAnimStyle}>
          <Icon
            source={focused ? item.selectedIcon : item.icon}
            size={26}
            color={focused ? activeColor : inactiveColor}
          />
        </Animated.View>
        <Animated.Text
          style={[
            labelAnimStyle,
            {
              fontSize: 11,
              fontWeight: focused ? '700' : '500',
              color: focused ? activeColor : inactiveColor,
              letterSpacing: 0,
            },
          ]}
          numberOfLines={1}
        >
          {item.label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();

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
        paddingTop: 14,
        paddingBottom: Math.max(14, insets.bottom + 4),
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

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        /** Same background as app to avoid a flash between tab panels */
        sceneStyle: { backgroundColor: palette.background },
        /** Keep tab scenes mounted so switching tabs feels instant, not blank-then-paint */
        lazy: false,
        freezeOnBlur: false,
      }}
      tabBar={(props) => <AppTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="subscriptions" />
      <Tabs.Screen name="expenses" />
      <Tabs.Screen name="invoices" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}

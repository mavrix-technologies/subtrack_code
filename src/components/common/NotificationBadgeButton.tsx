import React, { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

type NotificationBadgeButtonProps = {
  count: number;
  onPress: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function NotificationBadgeButton({
  count,
  onPress,
  children,
  style,
}: NotificationBadgeButtonProps) {
  const visible = count > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={visible ? `${count} notifications` : 'Notifications'}
      onPress={onPress}
      style={[styles.trigger, style]}
    >
      {children}
      {visible && (
        <View pointerEvents="none" style={styles.badge}>
          <View style={styles.badgeDot}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {count > 9 ? '9+' : count}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
  },
  badgeDot: {
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0,
  },
});

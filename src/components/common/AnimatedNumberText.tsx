import React, { useEffect, useRef, useState } from 'react';
import { StyleProp, TextStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type AnimatedNumberTextProps = {
  value: number;
  formatter?: (value: number) => string;
  loading?: boolean;
  placeholder?: string;
  style?: StyleProp<TextStyle>;
  duration?: number;
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
  minimumFontScale?: number;
};

const defaultFormatter = (value: number) => String(Math.round(value));

export function AnimatedNumberText({
  value,
  formatter = defaultFormatter,
  loading = false,
  placeholder = '--',
  style,
  duration = 520,
  numberOfLines = 1,
  adjustsFontSizeToFit,
  minimumFontScale,
}: AnimatedNumberTextProps) {
  const initialValue = Number.isFinite(value) ? value : 0;
  const animatedValue = useSharedValue(initialValue);
  const lastValue = useRef(initialValue);
  const [displayValue, setDisplayValue] = useState(initialValue);

  useEffect(() => {
    if (loading || !Number.isFinite(value)) return;

    const fromValue = lastValue.current;
    lastValue.current = value;
    animatedValue.set(fromValue);
    animatedValue.set(
      withTiming(value, {
        duration,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [animatedValue, duration, loading, value]);

  useAnimatedReaction(
    () => animatedValue.get(),
    (current) => {
      runOnJS(setDisplayValue)(current);
    },
    []
  );

  return (
    <Animated.Text
      style={style}
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit={adjustsFontSizeToFit}
      minimumFontScale={minimumFontScale}
    >
      {loading ? placeholder : formatter(displayValue)}
    </Animated.Text>
  );
}

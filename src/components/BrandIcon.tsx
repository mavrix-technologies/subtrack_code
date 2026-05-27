import React from 'react';
import Svg, { Path } from 'react-native-svg';

export function BrandIcon({ path, color, size = 32 }: { path: string, color: string, size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={path} fill={color} />
    </Svg>
  );
}

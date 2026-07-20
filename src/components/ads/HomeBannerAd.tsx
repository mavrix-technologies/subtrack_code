import { getGoogleMobileAdsModule } from './mobileAdsModule';
import { useTheme } from '@/contexts/theme';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from 'react-native-paper';

const ANDROID_BANNER_AD_UNIT_ID = 'ca-app-pub-6003470714469240/9885036988';
const IOS_BANNER_AD_UNIT_ID = 'ca-app-pub-6003470714469240/5932744295';

export function HomeBannerAd() {
  const { palette } = useTheme();
  const [isDismissed, setIsDismissed] = useState(false);
  if (isDismissed) return null;
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;

  const ads = getGoogleMobileAdsModule();
  if (!ads) return null;

  const { BannerAd, BannerAdSize, TestIds } = ads;
  const productionAdUnitId = Platform.select({
    android: ANDROID_BANNER_AD_UNIT_ID,
    ios: IOS_BANNER_AD_UNIT_ID,
    default: ANDROID_BANNER_AD_UNIT_ID,
  });
  const unitId = __DEV__ ? TestIds.ADAPTIVE_BANNER : productionAdUnitId;

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityLabel="Close ad"
        onPress={() => setIsDismissed(true)}
        style={[styles.closeButton, { backgroundColor: palette.surface, borderColor: palette.line }]}
      >
        <Icon source="close" size={16} color={palette.muted} />
      </Pressable>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 96,
    position: 'relative',
    overflow: 'hidden',
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: 6,
    top: 0,
    width: 28,
    zIndex: 2,
  },
});

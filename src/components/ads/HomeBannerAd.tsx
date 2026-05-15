import { getGoogleMobileAdsModule } from '@/components/ads/mobileAdsModule';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

const ANDROID_BANNER_AD_UNIT_ID = 'ca-app-pub-6003470714469240/9885036988';
const IOS_BANNER_AD_UNIT_ID = 'ca-app-pub-6003470714469240/5932744295';

export function HomeBannerAd() {
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
    overflow: 'hidden',
  },
});

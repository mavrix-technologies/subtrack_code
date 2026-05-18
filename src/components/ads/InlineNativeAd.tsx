import { getGoogleMobileAdsModule } from '@/components/ads/mobileAdsModule';
import { useTheme } from '@/contexts/theme';
import React, { useEffect, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Icon } from 'react-native-paper';

const ANDROID_NATIVE_AD_UNIT_ID = 'ca-app-pub-6003470714469240/4126655293';

type InlineNativeAdProps = {
  style?: ViewStyle;
};

export function InlineNativeAd({ style }: InlineNativeAdProps) {
  const { palette } = useTheme();
  const [nativeAd, setNativeAd] = useState<any | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (isDismissed) return;
    if (Platform.OS !== 'android') return;

    const ads = getGoogleMobileAdsModule();
    if (!ads) return;

    const {
      NativeAd,
      NativeAdChoicesPlacement,
      NativeMediaAspectRatio,
      TestIds,
    } = ads;
    const adUnitId = __DEV__ ? TestIds.NATIVE : ANDROID_NATIVE_AD_UNIT_ID;
    let isMounted = true;
    let loadedAd: any | null = null;

    NativeAd.createForAdRequest(adUnitId, {
      adChoicesPlacement: NativeAdChoicesPlacement.TOP_RIGHT,
      aspectRatio: NativeMediaAspectRatio.LANDSCAPE,
      startVideoMuted: true,
    })
      .then((ad) => {
        loadedAd = ad;
        if (isMounted) setNativeAd(ad);
        else ad.destroy();
      })
      .catch(() => {
        if (isMounted) setNativeAd(null);
      });

    return () => {
      isMounted = false;
      loadedAd?.destroy();
    };
  }, [isDismissed]);

  if (isDismissed || !nativeAd || Platform.OS !== 'android') return null;

  const ads = getGoogleMobileAdsModule();
  if (!ads) return null;

  const {
    NativeAdView,
    NativeAsset,
    NativeAssetType,
    NativeMediaView,
  } = ads;
  const visibleLine = palette.background === palette.surface ? '#E2E8F0' : palette.line;
  const dismissAd = () => {
    nativeAd.destroy?.();
    setNativeAd(null);
    setIsDismissed(true);
  };

  return (
    <NativeAdView
      nativeAd={nativeAd}
      style={[
        styles.card,
        {
          backgroundColor: palette.surface,
          borderColor: visibleLine,
        },
        style,
      ]}
    >
      <Pressable
        accessibilityLabel="Close ad"
        onPress={dismissAd}
        style={[styles.closeButton, { backgroundColor: palette.background, borderColor: visibleLine }]}
      >
        <Icon source="close" size={16} color={palette.muted} />
      </Pressable>

      <View style={styles.headerRow}>
        {nativeAd.icon && (
          <NativeAsset assetType={NativeAssetType.ICON}>
            <Image source={{ uri: nativeAd.icon.url }} style={styles.icon} />
          </NativeAsset>
        )}
        <View style={styles.titleBlock}>
          <View style={styles.metaRow}>
            <Text style={[styles.adBadge, { borderColor: palette.primary, color: palette.primary }]}>
              Ad
            </Text>
            <Text style={[styles.sponsored, { color: palette.muted }]} numberOfLines={1}>
              Sponsored{nativeAd.advertiser ? ` by ${nativeAd.advertiser}` : ''}
            </Text>
          </View>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text style={[styles.headline, { color: palette.text }]} numberOfLines={2}>
              {nativeAd.headline}
            </Text>
          </NativeAsset>
        </View>
      </View>

      {nativeAd.mediaContent && (
        <NativeMediaView resizeMode="cover" style={styles.media} />
      )}

      {!!nativeAd.body && (
        <NativeAsset assetType={NativeAssetType.BODY}>
          <Text style={[styles.body, { color: palette.muted }]} numberOfLines={2}>
            {nativeAd.body}
          </Text>
        </NativeAsset>
      )}

      {!!nativeAd.callToAction && (
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <Text style={[styles.cta, { backgroundColor: palette.primary }]} numberOfLines={1}>
            {nativeAd.callToAction}
          </Text>
        </NativeAsset>
      )}
    </NativeAdView>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 22,
    overflow: 'hidden',
    padding: 14,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: 10,
    top: 10,
    width: 28,
    zIndex: 10,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingRight: 34,
  },
  icon: {
    borderRadius: 10,
    height: 42,
    width: 42,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  headline: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 20,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    marginBottom: 5,
  },
  adBadge: {
    borderRadius: 4,
    borderWidth: 1,
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 14,
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  sponsored: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
  },
  media: {
    aspectRatio: 1.91,
    borderRadius: 12,
    marginTop: 12,
    overflow: 'hidden',
    width: '100%',
  },
  body: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 10,
  },
  cta: {
    borderRadius: 12,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 12,
    minHeight: 40,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 11,
    textAlign: 'center',
  },
});

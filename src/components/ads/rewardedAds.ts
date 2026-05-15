import { Platform } from 'react-native';

import { getGoogleMobileAdsModule } from '@/components/ads/mobileAdsModule';
import { trackEvent } from '@/services/analytics';

const ANDROID_INVOICE_EXPORT_REWARDED_AD_UNIT_ID = 'ca-app-pub-6003470714469240/7314111324';

export async function showInvoiceExportRewardAd() {
  void trackEvent('rewarded_ad_requested', { placement: 'invoice_export' });

  if (Platform.OS !== 'android') {
    void trackEvent('rewarded_ad_unavailable', {
      placement: 'invoice_export',
      reason: 'unsupported-platform',
    });
    return { shown: false, reason: 'unsupported-platform' as const };
  }

  const ads = getGoogleMobileAdsModule();
  if (!ads) {
    void trackEvent('rewarded_ad_unavailable', {
      placement: 'invoice_export',
      reason: 'ads-module-unavailable',
    });
    return { shown: false, reason: 'ads-module-unavailable' as const };
  }

  const {
    AdEventType,
    RewardedAd,
    RewardedAdEventType,
    TestIds,
  } = ads;
  const unitId = __DEV__ ? TestIds.REWARDED : ANDROID_INVOICE_EXPORT_REWARDED_AD_UNIT_ID;
  const rewarded = RewardedAd.createForAdRequest(unitId, {
    requestNonPersonalizedAdsOnly: false,
  });

  return new Promise<{ shown: boolean; rewarded: boolean }>((resolve) => {
    let resolved = false;
    let earnedReward = false;
    let didShow = false;
    const cleanups: (() => void)[] = [];

    const finish = (result: { shown: boolean; rewarded: boolean }) => {
      if (resolved) return;
      resolved = true;
      cleanups.forEach((cleanup) => cleanup());
      void trackEvent('rewarded_ad_finished', {
        placement: 'invoice_export',
        shown: result.shown,
        rewarded: result.rewarded,
      });
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({ shown: didShow, rewarded: earnedReward });
    }, 12000);
    cleanups.push(() => clearTimeout(timeout));

    cleanups.push(rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      didShow = true;
      void trackEvent('rewarded_ad_loaded', { placement: 'invoice_export' });
      rewarded.show().catch(() => finish({ shown: false, rewarded: false }));
    }));

    cleanups.push(rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earnedReward = true;
    }));

    cleanups.push(rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      finish({ shown: didShow, rewarded: earnedReward });
    }));

    cleanups.push(rewarded.addAdEventListener(AdEventType.ERROR, () => {
      finish({ shown: false, rewarded: false });
    }));

    rewarded.load();
  });
}

import { Platform } from 'react-native';

import { getGoogleMobileAdsModule } from '@/components/ads/mobileAdsModule';
import { trackEvent } from '@/services/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ANDROID_INVOICE_EXPORT_REWARDED_AD_UNIT_ID = 'ca-app-pub-6003470714469240/7314111324';
const ANDROID_STARTUP_REWARDED_INTERSTITIAL_AD_UNIT_ID = 'ca-app-pub-6003470714469240/2335886853';
const STARTUP_REWARDED_INTERSTITIAL_INTERVAL_MS = 24 * 60 * 60 * 1000;

type RewardedAdResult = { shown: boolean; rewarded: boolean };

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

  return new Promise<RewardedAdResult>((resolve) => {
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

export async function showStartupRewardedInterstitialAd(userId: string) {
  const placement = 'startup_home';
  void trackEvent('rewarded_interstitial_requested', { placement });

  if (Platform.OS !== 'android') {
    void trackEvent('rewarded_interstitial_unavailable', {
      placement,
      reason: 'unsupported-platform',
    });
    return { shown: false, reason: 'unsupported-platform' as const };
  }

  const storageKey = `subtrack:ads:startupRewardedInterstitial:lastShown:${userId}`;
  const lastShownRaw = await AsyncStorage.getItem(storageKey);
  const lastShownAt = lastShownRaw ? Number(lastShownRaw) : 0;
  if (Number.isFinite(lastShownAt) && Date.now() - lastShownAt < STARTUP_REWARDED_INTERSTITIAL_INTERVAL_MS) {
    void trackEvent('rewarded_interstitial_skipped', { placement, reason: 'frequency-cap' });
    return { shown: false, reason: 'frequency-cap' as const };
  }

  const ads = getGoogleMobileAdsModule();
  if (!ads) {
    void trackEvent('rewarded_interstitial_unavailable', {
      placement,
      reason: 'ads-module-unavailable',
    });
    return { shown: false, reason: 'ads-module-unavailable' as const };
  }

  const {
    AdEventType,
    RewardedAdEventType,
    RewardedInterstitialAd,
    TestIds,
  } = ads;
  const unitId = __DEV__
    ? TestIds.REWARDED_INTERSTITIAL
    : ANDROID_STARTUP_REWARDED_INTERSTITIAL_AD_UNIT_ID;
  const rewardedInterstitial = RewardedInterstitialAd.createForAdRequest(unitId, {
    requestNonPersonalizedAdsOnly: false,
  });

  return new Promise<RewardedAdResult>((resolve) => {
    let resolved = false;
    let earnedReward = false;
    let didShow = false;
    const cleanups: (() => void)[] = [];

    const finish = (result: RewardedAdResult) => {
      if (resolved) return;
      resolved = true;
      cleanups.forEach((cleanup) => cleanup());
      if (result.shown) void AsyncStorage.setItem(storageKey, String(Date.now()));
      void trackEvent('rewarded_interstitial_finished', {
        placement,
        shown: result.shown,
        rewarded: result.rewarded,
      });
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({ shown: didShow, rewarded: earnedReward });
    }, 15000);
    cleanups.push(() => clearTimeout(timeout));

    cleanups.push(rewardedInterstitial.addAdEventListener(RewardedAdEventType.LOADED, () => {
      didShow = true;
      void trackEvent('rewarded_interstitial_loaded', { placement });
      rewardedInterstitial.show().catch(() => finish({ shown: false, rewarded: false }));
    }));

    cleanups.push(rewardedInterstitial.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earnedReward = true;
    }));

    cleanups.push(rewardedInterstitial.addAdEventListener(AdEventType.CLOSED, () => {
      finish({ shown: didShow, rewarded: earnedReward });
    }));

    cleanups.push(rewardedInterstitial.addAdEventListener(AdEventType.ERROR, () => {
      finish({ shown: false, rewarded: false });
    }));

    rewardedInterstitial.load();
  });
}

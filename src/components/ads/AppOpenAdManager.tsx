import React, { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useAppOpenAd, TestIds } from 'react-native-google-mobile-ads';
import { getGoogleMobileAdsModule } from './mobileAdsModule';

// Replace with your actual AdMob App Open Ad Unit ID for production
const ANDROID_APP_OPEN_AD_UNIT_ID = 'ca-app-pub-6003470714469240/1234567890'; 
let hasShownAppOpenAdThisSession = false;

function AppOpenAdImpl() {
  const unitId = __DEV__ ? TestIds.APP_OPEN : ANDROID_APP_OPEN_AD_UNIT_ID;
  const { isLoaded, isClosed, load, show } = useAppOpenAd(unitId, {
    requestNonPersonalizedAdsOnly: false,
  });
  const isShowingAd = useRef(false);

  useEffect(() => {
    if (!hasShownAppOpenAdThisSession) load();
  }, [load]);

  // Show once per JS session. Do not show again on foreground/resume.
  useEffect(() => {
    if (
      !isLoaded ||
      hasShownAppOpenAdThisSession ||
      AppState.currentState !== 'active' ||
      isShowingAd.current
    ) {
      return;
    }

    hasShownAppOpenAdThisSession = true;
    isShowingAd.current = true;
    try {
      show();
    } catch {
      isShowingAd.current = false;
      hasShownAppOpenAdThisSession = false;
    }
  }, [isLoaded, show]);

  useEffect(() => {
    if (isClosed) {
      isShowingAd.current = false;
    }
  }, [isClosed]);

  return null;
}

export function AppOpenAdManager() {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  const ads = getGoogleMobileAdsModule();
  if (!ads) return null;
  
  return <AppOpenAdImpl />;
}

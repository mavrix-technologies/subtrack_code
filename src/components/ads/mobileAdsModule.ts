import { NativeModules } from 'react-native';

type GoogleMobileAdsModule = typeof import('react-native-google-mobile-ads');

export function getGoogleMobileAdsModule(): GoogleMobileAdsModule | null {
  if (!NativeModules.RNGoogleMobileAdsModule) return null;

  try {
    // Runtime require keeps Expo Go / old native binaries from crashing during route discovery.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-google-mobile-ads') as GoogleMobileAdsModule;
  } catch {
    return null;
  }
}

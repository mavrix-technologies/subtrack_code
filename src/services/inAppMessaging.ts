import { onSnapshot, Timestamp } from 'firebase/firestore';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { appConfigDoc } from '@/services/firestorePaths';
import { getFirebaseBundle } from '@/services/firebase';

export type HomeBannerSlide = {
  title: string;
  message: string;
  imageUrl?: string;
  icon?: string;
  accentColor?: string;
};

export type HomeBannerCampaign = {
  enabled: boolean;
  id: string;
  version: number;
  title: string;
  message: string;
  slides: HomeBannerSlide[];
  imageUrl?: string;
  buttonText?: string;
  actionRoute?: string;
  actionUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
  platforms?: ('ios' | 'android')[];
  minAppVersion?: string;
  maxAppVersion?: string;
  startsAt?: Timestamp;
  endsAt?: Timestamp;
};

export type UpdateAlertCampaign = {
  enabled: boolean;
  id: string;
  revision: number;
  targetVersion: string;
  title: string;
  message: string;
  buttonText: string;
  actionUrl: string;
  platforms?: ('ios' | 'android')[];
  minAppVersion?: string;
  maxAppVersion?: string;
  startsAt?: Timestamp;
  endsAt?: Timestamp;
};

const HOME_BANNER_CONFIG_ID = 'homeBanner';
const UPDATE_ALERT_CONFIG_ID = 'updateAlert';

function normalizeKeys(data: Record<string, unknown>) {
  return Object.entries(data).reduce<Record<string, unknown>>((normalized, [key, value]) => {
    normalized[key.trim()] = value;
    return normalized;
  }, {});
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSlides(data: Record<string, unknown>): HomeBannerSlide[] {
  if (!Array.isArray(data.slides)) return [];

  return data.slides.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const slide = {
      title: stringValue(item.title),
      message: stringValue(item.message),
      imageUrl: stringValue(item.imageUrl) || undefined,
      icon: stringValue(item.icon) || undefined,
      accentColor: stringValue(item.accentColor) || undefined,
    };
    return slide.title && slide.message ? [slide] : [];
  });
}

function compareVersions(left: string, right: string) {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }

  return 0;
}

function isCampaignActive(campaign: HomeBannerCampaign) {
  if (!campaign.enabled) return false;
  if (!campaign.slides.length && (!campaign.title || !campaign.message)) return false;
  if (campaign.platforms?.length && !campaign.platforms.includes(Platform.OS as 'ios' | 'android')) {
    return false;
  }

  const appVersion = Constants.expoConfig?.version || Constants.nativeApplicationVersion || '';
  if (campaign.minAppVersion && appVersion && compareVersions(appVersion, campaign.minAppVersion) < 0) {
    return false;
  }
  if (campaign.maxAppVersion && appVersion && compareVersions(appVersion, campaign.maxAppVersion) > 0) {
    return false;
  }

  const now = Date.now();
  const startsAt = campaign.startsAt?.toMillis();
  const endsAt = campaign.endsAt?.toMillis();
  if (startsAt && now < startsAt) return false;
  if (endsAt && now > endsAt) return false;

  return true;
}

function platformAllowed(platforms?: ('ios' | 'android')[]) {
  return !platforms?.length || platforms.includes(Platform.OS as 'ios' | 'android');
}

function appVersionAllowed(minAppVersion?: string, maxAppVersion?: string) {
  const appVersion = Constants.expoConfig?.version || Constants.nativeApplicationVersion || '';
  if (minAppVersion && appVersion && compareVersions(appVersion, minAppVersion) < 0) return false;
  if (maxAppVersion && appVersion && compareVersions(appVersion, maxAppVersion) > 0) return false;
  return true;
}

function timeAllowed(startsAt?: Timestamp, endsAt?: Timestamp) {
  const now = Date.now();
  const startsAtMillis = startsAt?.toMillis();
  const endsAtMillis = endsAt?.toMillis();
  if (startsAtMillis && now < startsAtMillis) return false;
  if (endsAtMillis && now > endsAtMillis) return false;
  return true;
}

function isUpdateAlertActive(campaign: UpdateAlertCampaign) {
  if (!campaign.enabled) return false;
  if (!campaign.targetVersion || !campaign.title || !campaign.message || !campaign.actionUrl) return false;
  if (!platformAllowed(campaign.platforms)) return false;
  if (!appVersionAllowed(campaign.minAppVersion, campaign.maxAppVersion)) return false;
  if (!timeAllowed(campaign.startsAt, campaign.endsAt)) return false;

  const appVersion = Constants.expoConfig?.version || Constants.nativeApplicationVersion || '';
  return !!appVersion && compareVersions(appVersion, campaign.targetVersion) < 0;
}

export function listenToHomeBannerCampaign(
  onData: (campaign: HomeBannerCampaign | null) => void,
  onError: (error: Error) => void
) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  return onSnapshot(
    appConfigDoc(firebase.db, HOME_BANNER_CONFIG_ID),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }

      const data = normalizeKeys(snapshot.data());
      const slides = normalizeSlides(data);
      const title = stringValue(data.title);
      const message = stringValue(data.message);
      const campaign: HomeBannerCampaign = {
        enabled: Boolean(data.enabled),
        id: stringValue(data.id) || HOME_BANNER_CONFIG_ID,
        version: Number(data.version || 1),
        title,
        message,
        slides: slides.length ? slides : title && message ? [{
          title,
          message,
          imageUrl: stringValue(data.imageUrl) || undefined,
        }] : [],
        imageUrl: stringValue(data.imageUrl) || undefined,
        buttonText: stringValue(data.buttonText) || undefined,
        actionRoute: stringValue(data.actionRoute) || undefined,
        actionUrl: stringValue(data.actionUrl) || undefined,
        backgroundColor: stringValue(data.backgroundColor) || undefined,
        textColor: stringValue(data.textColor) || undefined,
        buttonColor: stringValue(data.buttonColor) || undefined,
        platforms: Array.isArray(data.platforms)
          ? data.platforms.filter((item): item is 'ios' | 'android' => item === 'ios' || item === 'android')
          : undefined,
        minAppVersion: stringValue(data.minAppVersion) || undefined,
        maxAppVersion: stringValue(data.maxAppVersion) || undefined,
        startsAt: data.startsAt as Timestamp | undefined,
        endsAt: data.endsAt as Timestamp | undefined,
      };

      onData(isCampaignActive(campaign) ? campaign : null);
    },
    (error) => onError(error)
  );
}

export function listenToUpdateAlertCampaign(
  onData: (campaign: UpdateAlertCampaign | null) => void,
  onError: (error: Error) => void
) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  return onSnapshot(
    appConfigDoc(firebase.db, UPDATE_ALERT_CONFIG_ID),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }

      const data = normalizeKeys(snapshot.data());
      const platforms = Array.isArray(data.platforms)
        ? data.platforms.filter((item): item is 'ios' | 'android' => item === 'ios' || item === 'android')
        : undefined;
      const targetVersion = stringValue(data.targetVersion) || stringValue(data.versionName);
      const campaign: UpdateAlertCampaign = {
        enabled: Boolean(data.enabled),
        id: stringValue(data.id) || UPDATE_ALERT_CONFIG_ID,
        revision: Number(data.revision || data.version || 1),
        targetVersion,
        title: stringValue(data.title) || 'New version available',
        message: stringValue(data.message) || `SubTrack ${targetVersion} is ready. Update from Google Play for the latest fixes and improvements.`,
        buttonText: stringValue(data.buttonText) || 'Update now',
        actionUrl: stringValue(data.actionUrl),
        platforms,
        minAppVersion: stringValue(data.minAppVersion) || undefined,
        maxAppVersion: stringValue(data.maxAppVersion) || undefined,
        startsAt: data.startsAt as Timestamp | undefined,
        endsAt: data.endsAt as Timestamp | undefined,
      };

      onData(isUpdateAlertActive(campaign) ? campaign : null);
    },
    (error) => onError(error)
  );
}

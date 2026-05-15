import { onSnapshot, Timestamp } from 'firebase/firestore';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { appConfigDoc } from '@/services/firestorePaths';
import { getFirebaseBundle } from '@/services/firebase';

export type HomeBannerCampaign = {
  enabled: boolean;
  id: string;
  version: number;
  title: string;
  message: string;
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

const CONFIG_ID = 'homeBanner';

function normalizeKeys(data: Record<string, unknown>) {
  return Object.entries(data).reduce<Record<string, unknown>>((normalized, [key, value]) => {
    normalized[key.trim()] = value;
    return normalized;
  }, {});
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
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
  if (!campaign.title || !campaign.message) return false;
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

export function listenToHomeBannerCampaign(
  onData: (campaign: HomeBannerCampaign | null) => void,
  onError: (error: Error) => void
) {
  const firebase = getFirebaseBundle();
  if (!firebase) throw new Error('Firebase is not configured');

  return onSnapshot(
    appConfigDoc(firebase.db, CONFIG_ID),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }

      const data = normalizeKeys(snapshot.data());
      const campaign: HomeBannerCampaign = {
        enabled: Boolean(data.enabled),
        id: stringValue(data.id) || CONFIG_ID,
        version: Number(data.version || 1),
        title: stringValue(data.title),
        message: stringValue(data.message),
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

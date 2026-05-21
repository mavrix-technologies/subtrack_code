import { useTheme } from '@/contexts/theme';
import { listenToUpdateAlertCampaign, UpdateAlertCampaign } from '@/services/inAppMessaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from 'react-native-paper';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.subtrackapp.android';
const DEFAULT_UPDATE_ALERT: UpdateAlertCampaign = {
  enabled: true,
  id: 'update-v1-2-1',
  revision: 1,
  targetVersion: '1.2.1',
  title: 'New version available',
  message: 'SubTrack 1.2.1 is ready with a smoother Play Store build, fixes, and new app updates.',
  buttonText: 'Update now',
  actionUrl: PLAY_STORE_URL,
  platforms: ['android'],
};

function getInstalledVersion() {
  return Constants.nativeApplicationVersion || '';
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

function shouldShowUpdateAlert(campaign: UpdateAlertCampaign) {
  const installedVersion = getInstalledVersion();

  if (!campaign.enabled) return false;
  if (campaign.platforms?.length && !campaign.platforms.includes(Platform.OS as 'ios' | 'android')) return false;
  return !!installedVersion && compareVersions(installedVersion, campaign.targetVersion) < 0;
}

export function LegacyUpdateAlert() {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [visible, setVisible] = useState(false);
  const [campaign, setCampaign] = useState<UpdateAlertCampaign>(DEFAULT_UPDATE_ALERT);
  const installedVersion = getInstalledVersion();
  const dismissalKey = `subtrack:updateAlert:${campaign.id}:${campaign.targetVersion}:r${campaign.revision}:${installedVersion || 'unknown'}`;

  useEffect(() => {
    try {
      return listenToUpdateAlertCampaign(
        (nextCampaign) => setCampaign(nextCampaign || DEFAULT_UPDATE_ALERT),
        (error) => console.warn('Update alert sync failed:', error)
      );
    } catch (error) {
      console.warn('Update alert sync failed:', error);
      setCampaign(DEFAULT_UPDATE_ALERT);
    }
  }, []);

  useEffect(() => {
    if (!shouldShowUpdateAlert(campaign)) {
      setVisible(false);
      return;
    }

    const timer = setTimeout(() => {
      AsyncStorage.getItem(dismissalKey)
        .then((value) => setVisible(value !== 'true'))
        .catch(() => setVisible(true));
    }, 1200);

    return () => clearTimeout(timer);
  }, [campaign, dismissalKey]);

  const close = async () => {
    await AsyncStorage.setItem(dismissalKey, 'true');
    setVisible(false);
  };

  const updateNow = async () => {
    await AsyncStorage.setItem(dismissalKey, 'true');
    setVisible(false);
    await Linking.openURL(campaign.actionUrl || PLAY_STORE_URL);
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Pressable style={styles.closeButton} onPress={close} hitSlop={10}>
            <Icon source="close" size={20} color={palette.text} />
          </Pressable>

          <View style={styles.iconWrap}>
            <Icon source="download-circle-outline" size={34} color="#FFFFFF" />
          </View>

          <Text style={styles.title}>{campaign.title}</Text>
          <Text style={styles.message}>{campaign.message}</Text>

          <Pressable style={styles.cta} onPress={updateNow}>
            <Text style={styles.ctaText}>{campaign.buttonText}</Text>
            <Icon source="open-in-new" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.68)',
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },
  dialog: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 26,
    maxWidth: 420,
    padding: 22,
    width: '100%',
  },
  closeButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
    top: 12,
    width: 36,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    marginBottom: 16,
    width: 52,
  },
  title: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  message: {
    color: palette.muted,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  cta: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 52,
    paddingHorizontal: 22,
    width: '100%',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});

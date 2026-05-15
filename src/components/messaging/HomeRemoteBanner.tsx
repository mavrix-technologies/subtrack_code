import { useAppData } from '@/contexts/app-data';
import { useTheme } from '@/contexts/theme';
import {
  HomeBannerCampaign,
  listenToHomeBannerCampaign,
} from '@/services/inAppMessaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function dismissalKey(userId: string, campaign: HomeBannerCampaign) {
  return `subtrack:homeBannerDismissed:${userId}:${campaign.id}:${campaign.version}`;
}

export function HomeRemoteBanner() {
  const { user } = useAppData();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [campaign, setCampaign] = useState<HomeBannerCampaign | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) {
      setCampaign(null);
      setDismissed(false);
      return;
    }

    return listenToHomeBannerCampaign(
      async (nextCampaign) => {
        setCampaign(nextCampaign);
        if (!nextCampaign) {
          setDismissed(false);
          return;
        }

        const value = await AsyncStorage.getItem(dismissalKey(user.uid, nextCampaign));
        setDismissed(value === 'true');
      },
      (error) => console.warn('Home banner sync failed:', error)
    );
  }, [user]);

  if (!user || !campaign || dismissed) return null;

  const backgroundColor = campaign.backgroundColor || palette.navBackground;
  const textColor = campaign.textColor || '#FFFFFF';
  const buttonColor = campaign.buttonColor || palette.primary;

  const close = async () => {
    await AsyncStorage.setItem(dismissalKey(user.uid, campaign), 'true');
    setDismissed(true);
  };

  const openAction = async () => {
    await AsyncStorage.setItem(dismissalKey(user.uid, campaign), 'true');
    setDismissed(true);

    if (campaign.actionRoute) {
      router.push(campaign.actionRoute as any);
      return;
    }

    if (campaign.actionUrl && await Linking.canOpenURL(campaign.actionUrl)) {
      await Linking.openURL(campaign.actionUrl);
    }
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={[styles.dialog, { backgroundColor, marginBottom: insets.bottom + 12 }]}>
          <Pressable style={styles.closeButton} onPress={close} hitSlop={10}>
            <Icon source="close" size={20} color={textColor} />
          </Pressable>

          {!!campaign.imageUrl && (
            <Image source={{ uri: campaign.imageUrl }} style={styles.image} resizeMode="cover" />
          )}

          <View style={styles.content}>
            <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
              {campaign.title}
            </Text>
            <Text style={[styles.message, { color: `${textColor}CC` }]} numberOfLines={4}>
              {campaign.message}
            </Text>
          </View>

          {!!campaign.buttonText && (campaign.actionRoute || campaign.actionUrl) && (
            <Pressable style={[styles.cta, { backgroundColor: buttonColor }]} onPress={openAction}>
              <Text style={styles.ctaText} numberOfLines={1}>
                {campaign.buttonText}
              </Text>
              <Icon source="chevron-right" size={19} color="#FFFFFF" />
            </Pressable>
          )}
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
    borderRadius: 28,
    maxWidth: 430,
    overflow: 'hidden',
    width: '100%',
  },
  image: {
    aspectRatio: 1.8,
    backgroundColor: palette.line,
    width: '100%',
  },
  content: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 30,
    paddingRight: 24,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: 8,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
    top: 12,
    width: 36,
    zIndex: 10,
  },
  cta: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    margin: 20,
    marginTop: 8,
    minHeight: 52,
    paddingHorizontal: 18,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});

import { useAppData } from '@/contexts/app-data';
import { useTheme } from '@/contexts/theme';
import {
  HomeBannerCampaign,
  listenToHomeBannerCampaign,
} from '@/services/inAppMessaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  InteractionManager,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function dismissalKey(userId: string, campaign: HomeBannerCampaign) {
  return `subtrack:homeBannerDismissed:${userId}:${campaign.id}:${campaign.version}`;
}

export function HomeRemoteBanner() {
  "use no memo";

  const { user } = useAppData();
  const { palette } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const styles = createStyles(palette);
  const scrollRef = useRef<ScrollView>(null);
  const [campaign, setCampaign] = useState<HomeBannerCampaign | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      const cleanupTask = InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;
        setCampaign(null);
        setDismissed(false);
        setIsReady(false);
      });

      return () => {
        cancelled = true;
        cleanupTask.cancel();
      };
    }

    const unsubscribe = listenToHomeBannerCampaign(
      async (nextCampaign) => {
        setIsReady(false);

        if (!nextCampaign) {
          if (cancelled) return;
          setCampaign(null);
          setDismissed(false);
          setActiveSlide(0);
          setIsReady(true);
          return;
        }

        try {
          const value = await AsyncStorage.getItem(dismissalKey(user.uid, nextCampaign));
          if (cancelled) return;

          setCampaign(nextCampaign);
          setDismissed(value === 'true');
          setActiveSlide(0);
          scrollRef.current?.scrollTo({ x: 0, animated: false });

          InteractionManager.runAfterInteractions(() => {
            if (!cancelled) setIsReady(true);
          });
        } catch {
          if (cancelled) return;
          setCampaign(nextCampaign);
          setDismissed(false);
          setActiveSlide(0);
          setIsReady(true);
        }
      },
      (error) => console.warn('Home banner sync failed:', error)
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user]);

  if (!user || !campaign || dismissed || !isReady) return null;

  const backgroundColor = campaign.backgroundColor || palette.navBackground;
  const textColor = campaign.textColor || '#FFFFFF';
  const buttonColor = campaign.buttonColor || palette.primary;
  const slides = campaign.slides.length ? campaign.slides : [{
    title: campaign.title,
    message: campaign.message,
    imageUrl: campaign.imageUrl,
  }];
  const dialogWidth = Math.min(width - 44, 430);
  const isLastSlide = activeSlide >= slides.length - 1;

  const close = async () => {
    await AsyncStorage.setItem(dismissalKey(user.uid, campaign), 'true');
    setDismissed(true);
  };

  const openAction = async () => {
    await AsyncStorage.setItem(dismissalKey(user.uid, campaign), 'true');
    setDismissed(true);

    if (campaign.actionRoute && campaign.actionRoute !== '/') {
      router.push(campaign.actionRoute as any);
      return;
    }

    if (campaign.actionUrl && await Linking.canOpenURL(campaign.actionUrl)) {
      await Linking.openURL(campaign.actionUrl);
    }
  };

  const nextSlide = () => {
    const nextIndex = Math.min(activeSlide + 1, slides.length - 1);
    scrollRef.current?.scrollTo({ x: nextIndex * dialogWidth, animated: true });
    setActiveSlide(nextIndex);
  };

  const handlePrimaryPress = () => {
    if (!isLastSlide) {
      nextSlide();
      return;
    }

    if (campaign.actionRoute || campaign.actionUrl) {
      void openAction();
      return;
    }

    void close();
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / dialogWidth);
    setActiveSlide(Math.max(0, Math.min(nextIndex, slides.length - 1)));
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={[styles.dialog, { backgroundColor, marginBottom: insets.bottom + 12, width: dialogWidth }]}>
          <Pressable style={styles.closeButton} onPress={close} hitSlop={10}>
            <Icon source="close" size={20} color={textColor} />
          </Pressable>

          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={onScrollEnd}
          >
            {/* react-doctor-disable-next-line react-doctor/rn-no-scrollview-mapped-list */}
            {slides.map((slide, index) => (
              <View key={`${slide.title}:${slide.message}`} style={[styles.slide, { width: dialogWidth }]}>
                {!!slide.imageUrl ? (
                  <Image source={{ uri: slide.imageUrl }} style={styles.image} resizeMode="cover" />
                ) : (
                  <View style={[styles.iconHero, { backgroundColor: slide.accentColor || buttonColor }]}>
                    <Icon source={slide.icon || 'creation'} size={38} color="#FFFFFF" />
                  </View>
                )}

                <View style={styles.content}>
                  <Text style={[styles.kicker, { color: `${textColor}B8` }]} numberOfLines={1}>
                    New in SubTrack v1.3.0
                  </Text>
                  <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
                    {slide.title}
                  </Text>
                  <Text style={[styles.message, { color: `${textColor}CC` }]} numberOfLines={5}>
                    {slide.message}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.dots} accessibilityLabel={`Slide ${activeSlide + 1} of ${slides.length}`}>
              {/* react-doctor-disable-next-line react-doctor/rn-no-scrollview-mapped-list */}
            {slides.map((slide, index) => (
                <View
                  key={`${slide.title}:dot:${slide.message}`}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: index === activeSlide ? textColor : `${textColor}55`,
                      width: index === activeSlide ? 20 : 7,
                    },
                  ]}
                />
              ))}
            </View>

            <Pressable style={[styles.cta, { backgroundColor: buttonColor }]} onPress={handlePrimaryPress}>
              <Text style={styles.ctaText} numberOfLines={1}>
                {isLastSlide ? campaign.buttonText || 'Got it' : 'Next'}
              </Text>
              <Icon source={isLastSlide ? 'check' : 'chevron-right'} size={19} color="#FFFFFF" />
            </Pressable>
          </View>
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
  },
  slide: {
    minHeight: 340,
  },
  image: {
    aspectRatio: 1.8,
    backgroundColor: palette.line,
    width: '100%',
  },
  iconHero: {
    alignItems: 'center',
    aspectRatio: 1.8,
    justifyContent: 'center',
    width: '100%',
  },
  content: {
    padding: 20,
    paddingBottom: 12,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 8,
    textTransform: 'uppercase',
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
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 4,
  },
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    marginBottom: 14,
    minHeight: 10,
  },
  dot: {
    borderRadius: 4,
    height: 7,
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
    minHeight: 52,
    paddingHorizontal: 18,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});

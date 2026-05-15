import { BrandIcon, POPULAR_APPS } from '@/components/BrandIcon';
import { useAppData } from '@/contexts/app-data';
import { useCurrency } from '@/contexts/currency';
import { useTheme } from '@/contexts/theme';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from 'react-native-paper';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SubscriptionsScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const { subscriptions, removeSubscription } = useAppData();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { formatAmount } = useCurrency();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Subscriptions</Text>
          <Text style={styles.subtitle}>{subscriptions.length} active</Text>
        </View>
        <Pressable
          style={styles.addButton}
          onPress={() => router.push('/add')}
        >
          <Icon source="plus" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {subscriptions.length === 0 ? (
          <Text style={{ textAlign: 'center', color: palette.muted, marginTop: 40 }}>No subscriptions yet. Add one!</Text>
        ) : (
          subscriptions.map((sub, i) => {
            const isExpanded = expandedId === sub.id;
            const appDef = POPULAR_APPS.find(a => a.id === sub.icon);
            
            let expandedBgColor = sub.color;
            if (!expandedBgColor || expandedBgColor === '#FFFFFF' || expandedBgColor === '#000000' || expandedBgColor === '#111111') {
              expandedBgColor = palette.primary; 
            }
            
            return (
              <Animated.View key={sub.id} layout={Layout.duration(300)} style={{ overflow: 'hidden', borderRadius: 24, marginBottom: 16 }}>
                {isExpanded ? (
                  <Pressable style={[styles.expandedCard, { backgroundColor: expandedBgColor, borderRadius: 24 }]} onPress={() => setExpandedId(null)}>
                    <View style={styles.expandedTop}>
                      <View style={styles.cardLeft}>
                        <View style={[styles.expandedIconBox, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                          {appDef ? (
                            <BrandIcon path={appDef.icon.path} size={24} color="#FFF" />
                          ) : sub.icon?.startsWith('http') ? (
                            <Image source={{ uri: sub.icon }} style={{ width: 28, height: 28, borderRadius: 8, resizeMode: 'contain' }} />
                          ) : (
                            <Text style={[styles.expandedIconLetter, { color: '#FFF' }]}>{sub.name.charAt(0).toUpperCase()}</Text>
                          )}
                        </View>
                        <View style={styles.cardTextBlock}>
                          <Text style={[styles.expandedTitle, { color: '#FFF' }]} numberOfLines={1}>{sub.name}</Text>
                          <Text style={[styles.expandedSubtitle, { color: 'rgba(255,255,255,0.8)' }]} numberOfLines={1}>{sub.planName || 'Standard'}</Text>
                        </View>
                      </View>
                      <View style={styles.cardRight}>
                        <Text style={[styles.expandedPrice, { color: '#FFF' }]} numberOfLines={1}>{formatAmount(sub.price)}</Text>
                        <Text style={[styles.expandedSubtitle, { color: 'rgba(255,255,255,0.8)' }]}>1 {sub.billingCycle === 'monthly' ? 'month' : 'year'}</Text>
                      </View>
                    </View>

                    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
                      <View style={styles.detailsBlock}>
                        <View style={[styles.detailRow, { borderTopColor: 'rgba(255,255,255,0.2)' }]}>
                          <Text style={[styles.detailLabel, { color: 'rgba(255,255,255,0.8)' }]}>Payment info</Text>
                          <View style={styles.detailValueRow}>
                            <Text style={[styles.detailValue, { color: '#FFF' }]} numberOfLines={1}>{sub.notes || 'Default'}</Text>
                            <Pressable style={[styles.actionBtn, { borderColor: 'rgba(255,255,255,0.4)' }]} onPress={(e) => { e.stopPropagation(); router.push(`/subscription/${sub.id}`); }}>
                              <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Manage</Text>
                            </Pressable>
                          </View>
                        </View>
                        <View style={[styles.detailRow, { borderTopColor: 'rgba(255,255,255,0.2)' }]}>
                          <Text style={[styles.detailLabel, { color: 'rgba(255,255,255,0.8)' }]}>Plan details</Text>
                          <View style={styles.detailValueRow}>
                            <Text style={[styles.detailValue, { color: '#FFF' }]} numberOfLines={1}>{sub.planName || 'Standard'}</Text>
                            <Pressable style={[styles.actionBtn, { borderColor: 'rgba(255,255,255,0.4)' }]} onPress={(e) => { e.stopPropagation(); router.push(`/subscription/${sub.id}`); }}>
                              <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Change</Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>

                      <Pressable style={styles.cancelBtn} onPress={(e) => { e.stopPropagation(); removeSubscription(sub.id); }}>
                        <Text style={styles.cancelBtnText}>Cancel subscription</Text>
                      </Pressable>
                    </Animated.View>
                  </Pressable>
                ) : (
                  <Pressable 
                    style={styles.card}
                    onPress={() => setExpandedId(sub.id)}
                  >
                    <View style={styles.cardLeft}>
                      <View style={styles.iconBox}>
                        {appDef ? (
                          <BrandIcon path={appDef.icon.path} size={24} color={sub.color !== '#FFFFFF' && sub.color !== '#000000' && sub.color !== '#111111' ? sub.color : palette.text} />
                        ) : sub.icon?.startsWith('http') ? (
                          <Image source={{ uri: sub.icon }} style={{ width: 28, height: 28, borderRadius: 8, resizeMode: 'contain' }} />
                        ) : (
                          <Text style={{ fontSize: 20, fontWeight: 'bold', color: sub.color !== '#FFFFFF' && sub.color !== '#000000' && sub.color !== '#111111' ? sub.color : palette.text }}>
                            {sub.name.charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View style={styles.cardTextBlock}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{sub.name}</Text>
                        <Text style={styles.cardSubtitle} numberOfLines={1}>{sub.planName || 'Standard'}</Text>
                      </View>
                    </View>
                    <View style={styles.cardRight}>
                      <Text style={styles.cardPrice} numberOfLines={1}>{formatAmount(sub.price)}</Text>
                      <Text style={styles.cardDuration}>1 {sub.billingCycle === 'monthly' ? 'month' : 'year'}</Text>
                    </View>
                  </Pressable>
                )}
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: palette.text,
  },
  subtitle: {
    fontSize: 14,
    color: palette.muted,
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
    paddingTop: 8,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.line,
    overflow: 'hidden',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    minWidth: 0,
  },
  cardTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: palette.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.text,
  },
  cardSubtitle: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
    marginLeft: 12,
    maxWidth: 116,
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: palette.text,
  },
  cardDuration: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 2,
  },
  expandedCard: {
    backgroundColor: palette.cardBlue,
    borderRadius: 32,
    padding: 24,
    overflow: 'hidden',
  },
  expandedTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  expandedIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedIconLetter: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  expandedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  expandedSubtitle: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.7)',
    marginTop: 2,
  },
  expandedPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  detailsBlock: {
    gap: 16,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.7)',
    flexShrink: 0,
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-end',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flexShrink: 1,
    minWidth: 0,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    flexShrink: 0,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  cancelBtn: {
    backgroundColor: palette.navBackground,
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

import { legalPages, type LegalPageId } from '@/constants/legal';
import { useTheme } from '@/contexts/theme';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const isLegalPageId = (value: string): value is LegalPageId => value in legalPages;

export default function LegalPageScreen() {
  const { page } = useLocalSearchParams<{ page?: string }>();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const styles = useMemo(() => createStyles(palette), [palette]);

  const pageId = page && isLegalPageId(page) ? page : 'privacy';
  const content = legalPages[pageId];

  return (
    <>
      <Stack.Screen options={{ title: content.title }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.subtitle}>{content.subtitle}</Text>
        <Text style={styles.updated}>Last updated: {content.updatedAt}</Text>

        <View style={styles.divider} />

        {/* react-doctor-disable-next-line react-doctor/rn-no-scrollview-mapped-list */}
        {content.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.body.map((paragraph) => (
              <Text key={paragraph} style={styles.body}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.surface,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 22,
  },
  title: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 6,
  },
  updated: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 12,
  },
  divider: {
    backgroundColor: palette.line,
    height: StyleSheet.hairlineWidth,
    marginBottom: 22,
    marginTop: 20,
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 8,
  },
  body: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    marginBottom: 10,
  },
});

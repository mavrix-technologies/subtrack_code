import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from 'react-native-paper';
import { useTheme } from '@/contexts/theme';
import { useCurrency } from '@/contexts/currency';

export default function EditScreen() {
  const { palette } = useTheme();
  const { currency } = useCurrency();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 380;
  
  const [name, setName] = useState('Netflix');
  const [price, setPrice] = useState('26.00');
  
  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 72 : 0}
    >

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Logo Section */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>N</Text>
          </View>
          <Pressable>
            <Text style={styles.changeLogoText}>Change logo</Text>
          </Pressable>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          
          {/* Name Field */}
          <View style={styles.inputWrapper}>
            <View style={styles.labelContainer}>
              <Text style={styles.labelText}>Name</Text>
            </View>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Price & Billing Cycle Row */}
          <View style={[styles.row, compact && styles.rowStack]}>
            <View style={[styles.inputWrapper, { flex: 1 }]}>
              <View style={styles.labelContainer}>
                <Text style={styles.labelText}>Price</Text>
              </View>
              <View style={styles.priceInputContainer}>
                <Text style={styles.currencySymbol}>{currency.symbol}</Text>
                <TextInput
                  style={styles.priceInput}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={[styles.inputWrapper, { flex: 1 }]}>
              <View style={styles.labelContainer}>
                <Text style={styles.labelText}>Billing cycle</Text>
              </View>
              <Pressable style={styles.selectContainer}>
                <Text style={styles.selectText}>Monthly</Text>
                <Icon source="chevron-down" size={16} color={palette.muted} />
              </Pressable>
            </View>
          </View>

          {/* Next payment date */}
          <View style={styles.inputWrapper}>
            <View style={styles.labelContainer}>
              <Text style={styles.labelText}>Next payment date</Text>
            </View>
            <Pressable style={styles.selectContainer}>
              <Text style={styles.selectText} numberOfLines={1}>August 23, 2023 at 16:00</Text>
              <Icon source="calendar-month-outline" size={20} color={palette.muted} />
            </Pressable>
          </View>

          {/* Plan details */}
          <View style={styles.inputWrapper}>
            <View style={styles.labelContainer}>
              <Text style={styles.labelText}>Plan details</Text>
            </View>
            <Pressable style={styles.selectContainer}>
              <Text style={styles.selectText}>Premium</Text>
              <Icon source="chevron-down" size={16} color={palette.muted} />
            </Pressable>
          </View>

          {/* Payment method */}
          <Pressable style={styles.paymentMethodCard}>
            <Text style={styles.paymentMethodTitle} numberOfLines={1}>Payment method</Text>
            <View style={styles.paymentMethodRight}>
              <View style={styles.cardPreview}>
                <View style={styles.mcCircles}>
                  <View style={[styles.mcCircle, { backgroundColor: '#EB001B', right: -6 }]} />
                  <View style={[styles.mcCircle, { backgroundColor: '#F79E1B' }]} />
                </View>
                <Text style={styles.cardNumber} numberOfLines={1}>•••• 3096</Text>
              </View>
              <Icon source="chevron-down" size={16} color={palette.muted} />
            </View>
          </Pressable>

        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Pressable style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Save changes</Text>
          </Pressable>
          <Pressable style={styles.deleteButton}>
            <Text style={styles.deleteButtonText}>Delete subscription</Text>
          </Pressable>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBox: {
    width: 80,
    height: 80,
    backgroundColor: palette.surface,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: palette.danger,
  },
  changeLogoText: {
    fontSize: 14,
    fontWeight: '500',
    color: palette.muted,
  },
  formContainer: {
    gap: 20,
  },
  inputWrapper: {
    position: 'relative',
    marginTop: 8,
  },
  labelContainer: {
    position: 'absolute',
    top: -10,
    left: 12,
    backgroundColor: palette.surface,
    paddingHorizontal: 4,
    zIndex: 1,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '500',
    color: palette.muted,
  },
  textInput: {
    height: 56,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
    color: palette.text,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  rowStack: {
    flexDirection: 'column',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '500',
    color: palette.text,
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontWeight: '500',
    color: palette.text,
  },
  selectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  selectText: {
    flex: 1,
    marginRight: 8,
    fontSize: 16,
    fontWeight: '500',
    color: palette.text,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  paymentMethodTitle: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '500',
    color: palette.text,
  },
  paymentMethodRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  cardPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mcCircles: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 20,
    marginRight: 6,
  },
  mcCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
  },
  cardNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: palette.text,
    letterSpacing: 1,
    maxWidth: 90,
  },
  actionButtons: {
    marginTop: 32,
    gap: 16,
  },
  saveButton: {
    height: 56,
    backgroundColor: palette.navBackground,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  deleteButton: {
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: palette.danger,
    fontSize: 15,
    fontWeight: '500',
  },
});

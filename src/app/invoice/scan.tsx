import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { useTheme } from '@/contexts/theme';
import { useScanStore } from '@/store/useScanStore';
import { useInvoiceStore } from '@/store/useInvoiceStore';
import { processInvoiceScan } from '@/services/invoiceOcrService';
import { checkDuplicateInvoice } from '@/services/duplicateDetectionEngine';
import { trackPriceChanges, detectSubscription, detectSimilarMerchant } from '@/services/merchantIntelligence';



export default function InvoiceScanScreen() {
  "use no memo";

  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const viewfinderSize = width * 0.75;
  const S = React.useMemo(() => createStyles(palette, viewfinderSize), [palette, viewfinderSize]);

  const { invoices } = useInvoiceStore();
  const {
    status,
    setStatus,
    setImage,
    setExtractedData,
    setDuplicateCheck,
    setConfidence,
    setPriceChanges,
    setSubscriptionRecommendation,
    setError,
    reset,
  } = useScanStore();

  const [flash, setFlash] = useState(false);
  const [blurWarning, setBlurWarning] = useState<string | null>(null);

  // Laser scanner animation
  const laserY = useSharedValue(0);

  useEffect(() => {
    reset();
    laserY.value = withRepeat(
      withTiming(viewfinderSize - 4, {
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, [laserY, reset, viewfinderSize]);

  const animatedLaserStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: laserY.value }],
    };
  });

  /**
   * Blur detection helper
   */
  const checkImageBlur = (width: number, height: number): boolean => {
    // Simple mock check: if dimensions are tiny, it's probably blurred/low quality
    if (width < 600 || height < 600) {
      setBlurWarning('Low resolution detected. Receipt text might be blurry.');
      return true;
    }
    setBlurWarning(null);
    return false;
  };

  /**
   * Handles running the scanned base64 data through parsing and intelligence layers
   */
  const handleOcrAndMapping = async (uri: string, base64: string, w: number, h: number) => {
    try {
      setStatus('ocr_processing');
      setImage(uri, base64);
      checkImageBlur(w, h);

      // 1. Core OCR Extraction
      const extracted = await processInvoiceScan(uri, base64, invoices);

      // 2. Duplicate Detection
      setStatus('comparing');
      const duplicateResult = checkDuplicateInvoice(extracted, invoices, extracted.imageHash);
      setDuplicateCheck(duplicateResult);

      // 3. Similar Merchant Linking
      const similarMerchant = detectSimilarMerchant(extracted.clientName, invoices);
      if (similarMerchant) {
        extracted.merchantId = similarMerchant.merchantId;
        extracted.category = similarMerchant.category;
      }

      // 4. Product Intelligence (Price changes)
      const priceChanges = trackPriceChanges(extracted.items, extracted.clientName, invoices);
      setPriceChanges(priceChanges);

      // 5. Subscription detection
      const subscriptionRec = detectSubscription(extracted.clientName, extracted.total, invoices);
      setSubscriptionRecommendation(subscriptionRec);

      // 6. Set confidence indicator map (MOCKED confidence values for fields)
      setConfidence({
        clientName: extracted.clientName === 'Unknown Merchant' ? 'low' : 'high',
        total: extracted.total === 0 ? 'low' : 'high',
        date: extracted.date ? 'high' : 'medium',
        invoiceNumber: extracted.invoiceNumber.startsWith('INV-') ? 'medium' : 'high',
      });

      setExtractedData(extracted);
      setStatus('done');

      // Navigate to review screen
      router.push('/invoice/review');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to scan invoice.');
      setStatus('error');
    }
  };

  /**
   * Launch System Camera
   */
  const handleCameraCapture = async () => {
    try {
      const { status: permStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert(
          'Permission required',
          'SubTrack needs access to your camera to scan invoices.'
        );
        return;
      }

      setStatus('capturing');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setStatus('compressing');
        await handleOcrAndMapping(
          asset.uri,
          asset.base64 || '',
          asset.width,
          asset.height
        );
      } else {
        setStatus('idle');
      }
    } catch (error) {
      console.error(error);
      setStatus('error');
      setError('Could not open camera.');
    }
  };

  /**
   * Launch Image Gallery Picker
   */
  const handleGalleryUpload = async () => {
    try {
      const { status: permStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert(
          'Permission required',
          'SubTrack needs permission to access your photo library.'
        );
        return;
      }

      setStatus('capturing');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setStatus('compressing');
        await handleOcrAndMapping(
          asset.uri,
          asset.base64 || '',
          asset.width,
          asset.height
        );
      } else {
        setStatus('idle');
      }
    } catch (error) {
      console.error(error);
      setStatus('error');
      setError('Could not open photo library.');
    }
  };

  /**
   * Mock Demo scan generator for easy testing
   */
  const handleDemoReceiptSelect = async (fileName: string) => {
    setStatus('compressing');
    setTimeout(async () => {
      // Pass file name keyword to trigger matches in our OCR mock database
      await handleOcrAndMapping(fileName, 'demo_base64_data', 1200, 1800);
    }, 800);
  };

  const isProcessing =
    status !== 'idle' && status !== 'error' && status !== 'done';

  return (
    <View style={S.container}>
      {/* Top Header */}
      <View style={[S.header, { paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} style={S.backBtn}>
          <Icon source="arrow-left" size={24} color="#FFF" />
        </Pressable>
        <Text style={S.headerTitle}>Invoice Scanner</Text>
        <Pressable onPress={() => setFlash(!flash)} style={S.flashBtn}>
          <Icon
            source={flash ? 'flash' : 'flash-off'}
            size={22}
            color="#FFF"
          />
        </Pressable>
      </View>

      {/* Main Scanner viewport */}
      <View style={S.scannerViewport}>
        <View style={S.viewfinder}>
          {/* Border Corner Guides */}
          <View style={[S.corner, S.topLeft]} />
          <View style={[S.corner, S.topRight]} />
          <View style={[S.corner, S.bottomLeft]} />
          <View style={[S.corner, S.bottomRight]} />

          {/* Laser scanning beam */}
          {isProcessing ? (
            <View style={S.loadingOverlay}>
              <ActivityIndicator size="large" color={palette.primary} />
              <Text style={S.loadingStatus}>
                {status === 'capturing' && 'Opening camera...'}
                {status === 'compressing' && 'Optimizing image...'}
                {status === 'ocr_processing' && 'Extracting text (OCR)...'}
                {status === 'comparing' && 'Detecting duplicates...'}
              </Text>
            </View>
          ) : (
            <Animated.View style={[S.laserLine, animatedLaserStyle]} />
          )}
        </View>

        {blurWarning && (
          <View style={S.warningBadge}>
            <Icon source="alert-circle" size={16} color={palette.warning} />
            <Text style={[S.warningText, { color: palette.warning }]}>
              {blurWarning}
            </Text>
          </View>
        )}

        <Text style={S.instructionText}>
          Align your invoice inside the frame to scan
        </Text>
      </View>

      {/* Action panel */}
      <BlurView intensity={25} style={[S.actionPanel, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <Text style={S.panelHeading}>Select Scan Source</Text>

        <View style={S.actionsRow}>
          <Pressable style={S.actionBtn} onPress={handleCameraCapture} disabled={isProcessing}>
            <View style={[S.iconContainer, { backgroundColor: palette.primary }]}>
              <Icon source="camera" size={26} color="#FFF" />
            </View>
            <Text style={S.actionBtnLabel}>Camera</Text>
          </Pressable>

          <Pressable style={S.actionBtn} onPress={handleGalleryUpload} disabled={isProcessing}>
            <View style={[S.iconContainer, { backgroundColor: '#3A3A3C' }]}>
              <Icon source="image-outline" size={26} color="#FFF" />
            </View>
            <Text style={S.actionBtnLabel}>Gallery</Text>
          </Pressable>

          <Pressable
            style={S.actionBtn}
            onPress={() => handleDemoReceiptSelect('invoice_netflix.png')}
            disabled={isProcessing}
          >
            <View style={[S.iconContainer, { backgroundColor: '#3A3A3C' }]}>
              <Icon source="netflix" size={26} color="#E50914" />
            </View>
            <Text style={S.actionBtnLabel}>Netflix Bill</Text>
          </Pressable>
        </View>

        <View style={[S.actionsRow, { marginTop: 16 }]}>
          <Pressable
            style={S.actionBtn}
            onPress={() => handleDemoReceiptSelect('invoice_dmart.png')}
            disabled={isProcessing}
          >
            <View style={[S.iconContainer, { backgroundColor: '#3A3A3C' }]}>
              <Icon source="shopping-outline" size={26} color="#06D6A0" />
            </View>
            <Text style={S.actionBtnLabel}>DMart Bill</Text>
          </Pressable>

          <Pressable
            style={S.actionBtn}
            onPress={() => handleDemoReceiptSelect('invoice_spotify.png')}
            disabled={isProcessing}
          >
            <View style={[S.iconContainer, { backgroundColor: '#3A3A3C' }]}>
              <Icon source="spotify" size={26} color="#1ED760" />
            </View>
            <Text style={S.actionBtnLabel}>Spotify Bill</Text>
          </Pressable>

          <Pressable
            style={S.actionBtn}
            onPress={() => handleDemoReceiptSelect('invoice_jio.png')}
            disabled={isProcessing}
          >
            <View style={[S.iconContainer, { backgroundColor: '#3A3A3C' }]}>
              <Icon source="wifi" size={26} color="#0056B3" />
            </View>
            <Text style={S.actionBtnLabel}>Jio Fiber</Text>
          </Pressable>
        </View>
      </BlurView>
    </View>
  );
}

const createStyles = (palette: any, viewfinderSize: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0A0A0C', // Cinematic dark look
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 16,
      backgroundColor: 'rgba(10, 10, 12, 0.95)',
    },
    backBtn: {
      padding: 8,
      borderRadius: 20,
      backgroundColor: '#1C1C1E',
    },
    headerTitle: {
      color: '#FFF',
      fontSize: 18,
      fontWeight: '600',
    },
    flashBtn: {
      padding: 8,
      borderRadius: 20,
      backgroundColor: '#1C1C1E',
    },
    scannerViewport: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    viewfinder: {
      width: viewfinderSize,
      height: viewfinderSize,
      borderRadius: 16,
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
    },
    corner: {
      position: 'absolute',
      width: 24,
      height: 24,
      borderColor: palette.primary,
    },
    topLeft: {
      top: 0,
      left: 0,
      borderTopWidth: 4,
      borderLeftWidth: 4,
      borderTopLeftRadius: 16,
    },
    topRight: {
      top: 0,
      right: 0,
      borderTopWidth: 4,
      borderRightWidth: 4,
      borderTopRightRadius: 16,
    },
    bottomLeft: {
      bottom: 0,
      left: 0,
      borderBottomWidth: 4,
      borderLeftWidth: 4,
      borderBottomLeftRadius: 16,
    },
    bottomRight: {
      bottom: 0,
      right: 0,
      borderBottomWidth: 4,
      borderRightWidth: 4,
      borderBottomRightRadius: 16,
    },
    laserLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 3,
      backgroundColor: palette.primary,
      boxShadow: `0px 0px 8px ${palette.primary}`,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    loadingStatus: {
      color: '#FFF',
      marginTop: 16,
      fontSize: 14,
      fontWeight: '500',
    },
    warningBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      marginTop: 16,
      marginHorizontal: 32,
    },
    warningText: {
      fontSize: 12,
      marginLeft: 6,
      fontWeight: '500',
    },
    instructionText: {
      color: '#8E8E93',
      fontSize: 14,
      textAlign: 'center',
      marginTop: 20,
      marginHorizontal: 32,
    },
    actionPanel: {
      paddingHorizontal: 20,
      paddingTop: 20,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: 'rgba(28, 28, 30, 0.95)',
      overflow: 'hidden',
    },
    panelHeading: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 16,
      textAlign: 'center',
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    actionBtn: {
      flex: 1,
      alignItems: 'center',
    },
    iconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
      boxShadow: '0px 2px 3.84px rgba(0,0,0,0.25)',
    },
    actionBtnLabel: {
      color: '#8E8E93',
      fontSize: 12,
      fontWeight: '500',
    },
  });

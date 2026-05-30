import { useTheme } from '@/contexts/theme';
import { checkDuplicateInvoice } from '@/services/duplicateDetectionEngine';
import { processInvoiceScan } from '@/services/invoiceOcrService';
import { detectSimilarMerchant, detectSubscription, trackPriceChanges } from '@/services/merchantIntelligence';
import { useInvoiceStore } from '@/store/useInvoiceStore';
import { useScanStore } from '@/store/useScanStore';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function InvoiceScanScreen() {
  "use no memo";

  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const frameWidth = Math.min(width - 40, 360);
  const frameHeight = Math.round(frameWidth * 1.35);
  const S = createStyles(palette, frameWidth, frameHeight);
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [flashMode, setFlashMode] = useState<'auto' | 'on' | 'off'>('auto');
  const [blurWarning, setBlurWarning] = useState<string | null>(null);
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

  useEffect(() => {
    reset();
    void requestPermission();
  }, [requestPermission, reset]);

  const checkImageBlur = (imageWidth: number, imageHeight: number) => {
    if (imageWidth < 600 || imageHeight < 600) {
      setBlurWarning('Low resolution detected. Receipt text might be blurry.');
      return;
    }
    setBlurWarning(null);
  };

  const handleOcrAndMapping = async (uri: string, base64: string, imageWidth: number, imageHeight: number) => {
    try {
      setStatus('ocr_processing');
      setImage(uri, base64);
      checkImageBlur(imageWidth, imageHeight);

      const extracted = await processInvoiceScan(uri, base64, invoices);

      setStatus('comparing');
      const duplicateResult = checkDuplicateInvoice(extracted, invoices, extracted.imageHash);
      setDuplicateCheck(duplicateResult);

      const similarMerchant = detectSimilarMerchant(extracted.clientName, invoices);
      if (similarMerchant) {
        extracted.merchantId = similarMerchant.merchantId;
        extracted.category = similarMerchant.category;
      }

      const priceChanges = trackPriceChanges(extracted.items, extracted.clientName, invoices);
      setPriceChanges(priceChanges);

      const subscriptionRec = detectSubscription(extracted.clientName, extracted.total, invoices);
      setSubscriptionRecommendation(subscriptionRec);

      setConfidence({
        clientName: extracted.clientName === 'Unknown Merchant' ? 'low' : 'high',
        total: extracted.total === 0 ? 'low' : 'high',
        date: extracted.date ? 'high' : 'medium',
        invoiceNumber: extracted.invoiceNumber.startsWith('INV-') ? 'medium' : 'high',
      });

      setExtractedData(extracted);
      setStatus('done');
      router.push('/invoice/review');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to scan invoice.');
      setStatus('error');
    }
  };

  const ensureCameraPermission = async () => {
    if (permission?.granted) return true;
    const nextPermission = await requestPermission();
    if (nextPermission.granted) return true;
    Alert.alert('Permission required', 'SubTrack needs access to your camera to scan invoices.');
    return false;
  };

  const handleCameraCapture = async () => {
    try {
      const granted = await ensureCameraPermission();
      if (!granted) return;
      if (!cameraRef.current) {
        setError('Camera is still starting. Try again in a moment.');
        setStatus('error');
        return;
      }

      setStatus('capturing');
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.72,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        setStatus('idle');
        return;
      }

      setStatus('compressing');
      await handleOcrAndMapping(photo.uri, photo.base64 || '', photo.width, photo.height);
    } catch (error) {
      console.error(error);
      setStatus('error');
      setError('Could not capture invoice.');
    }
  };

  const handleGalleryUpload = async () => {
    try {
      const { status: permStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert('Permission required', 'SubTrack needs permission to access your photo library.');
        return;
      }

      setStatus('capturing');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.72,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setStatus('compressing');
        await handleOcrAndMapping(asset.uri, asset.base64 || '', asset.width, asset.height);
      } else {
        setStatus('idle');
      }
    } catch (error) {
      console.error(error);
      setStatus('error');
      setError('Could not open photo library.');
    }
  };

  const isProcessing = status !== 'idle' && status !== 'error' && status !== 'done';
  const hasCameraPermission = permission?.granted;

  return (
    <View style={S.container}>
      <StatusBar style="dark" backgroundColor={palette.background} translucent={false} />

      <View style={S.cameraStage}>
        {hasCameraPermission ? (
          <CameraView
            ref={cameraRef}
            style={S.camera}
            facing="back"
            enableTorch={flashMode === 'on'}
          />
        ) : (
          <View style={S.permissionPanel}>
            <Icon source="camera-lock-outline" size={44} color={palette.primary} />
            <Text style={S.permissionTitle}>Camera access needed</Text>
            <Text style={S.permissionText}>Allow camera access to scan invoices in real time.</Text>
            <Pressable style={S.permissionButton} onPress={requestPermission}>
              <Text style={S.permissionButtonText}>Allow Camera</Text>
            </Pressable>
          </View>
        )}

        <View style={S.frameWrap}>
          <View style={S.viewfinder}>
            <View style={[S.corner, S.topLeft]} />
            <View style={[S.corner, S.topRight]} />
            <View style={[S.corner, S.bottomLeft]} />
            <View style={[S.corner, S.bottomRight]} />
            {isProcessing ? (
              <View style={S.loadingOverlay}>
                <ActivityIndicator size="large" color={palette.primary} />
                <Text style={S.loadingStatus}>
                  {status === 'capturing' && 'Capturing invoice...'}
                  {status === 'compressing' && 'Optimizing image...'}
                  {status === 'ocr_processing' && 'Reading invoice text...'}
                  {status === 'comparing' && 'Checking duplicates...'}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {blurWarning ? (
          <View style={S.warningBadge}>
            <Icon source="alert-circle" size={16} color={palette.warning} />
            <Text style={[S.warningText, { color: palette.warning }]}>{blurWarning}</Text>
          </View>
        ) : null}
      </View>

      <View style={[S.actionPanel, { paddingBottom: Math.max(insets.bottom + 12, 26) }]}>
        <View style={S.topActions}>
          <Pressable style={S.iconButton} onPress={() => router.back()}>
            <Icon source="arrow-left" size={22} color={palette.text} />
          </Pressable>
          <Pressable
            style={S.flashModeButton}
            onPress={() => setFlashMode((value) => (value === 'auto' ? 'on' : value === 'on' ? 'off' : 'auto'))}
            disabled={!hasCameraPermission}
          >
            <Icon
              source={flashMode === 'on' ? 'flash' : flashMode === 'auto' ? 'flash-auto' : 'flash-off'}
              size={19}
              color={palette.text}
            />
            <Text style={S.flashModeText}>
              {flashMode === 'auto' ? 'Auto' : flashMode === 'on' ? 'On' : 'Off'}
            </Text>
          </Pressable>
        </View>

        <Pressable style={S.captureButton} onPress={handleCameraCapture} disabled={isProcessing || !hasCameraPermission}>
          <View style={S.captureInner}>
            {isProcessing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Icon source="line-scan" size={30} color="#FFFFFF" />
            )}
          </View>
        </Pressable>

        <Pressable style={S.galleryButton} onPress={handleGalleryUpload} disabled={isProcessing}>
          <Icon source="image-outline" size={20} color={palette.text} />
          <Text style={S.galleryButtonText}>Choose from gallery</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (palette: any, frameWidth: number, frameHeight: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    cameraStage: {
      flex: 1,
      backgroundColor: palette.background,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    camera: {
      ...StyleSheet.absoluteFillObject,
    },
    frameWrap: {
      width: frameWidth,
      height: frameHeight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewfinder: {
      width: frameWidth,
      height: frameHeight,
      borderRadius: 26,
      overflow: 'hidden',
      position: 'relative',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.62)',
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    corner: {
      position: 'absolute',
      width: 36,
      height: 36,
      borderColor: palette.primary,
      zIndex: 3,
    },
    topLeft: {
      top: 0,
      left: 0,
      borderTopWidth: 5,
      borderLeftWidth: 5,
      borderTopLeftRadius: 26,
    },
    topRight: {
      top: 0,
      right: 0,
      borderTopWidth: 5,
      borderRightWidth: 5,
      borderTopRightRadius: 26,
    },
    bottomLeft: {
      bottom: 0,
      left: 0,
      borderBottomWidth: 5,
      borderLeftWidth: 5,
      borderBottomLeftRadius: 26,
    },
    bottomRight: {
      bottom: 0,
      right: 0,
      borderBottomWidth: 5,
      borderRightWidth: 5,
      borderBottomRightRadius: 26,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(255,255,255,0.84)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
      zIndex: 5,
    },
    loadingStatus: {
      color: palette.text,
      marginTop: 14,
      fontSize: 14,
      fontWeight: '800',
      textAlign: 'center',
    },
    warningBadge: {
      position: 'absolute',
      bottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(245,158,11,0.14)',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 14,
      gap: 6,
    },
    warningText: {
      fontSize: 12,
      fontWeight: '700',
    },
    permissionPanel: {
      width: frameWidth,
      borderRadius: 24,
      padding: 22,
      alignItems: 'center',
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      gap: 10,
    },
    permissionTitle: {
      color: palette.text,
      fontSize: 18,
      fontWeight: '900',
    },
    permissionText: {
      color: palette.muted,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 18,
    },
    permissionButton: {
      marginTop: 6,
      minHeight: 42,
      borderRadius: 21,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.primary,
    },
    permissionButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '900',
    },
    actionPanel: {
      backgroundColor: palette.background,
      paddingHorizontal: 24,
      paddingTop: 16,
      alignItems: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: palette.line,
    },
    topActions: {
      position: 'absolute',
      top: 16,
      left: 24,
      right: 24,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    iconButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
    },
    flashModeButton: {
      minWidth: 76,
      height: 42,
      borderRadius: 21,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
    },
    flashModeText: {
      color: palette.text,
      fontSize: 12,
      fontWeight: '800',
    },
    captureButton: {
      width: 78,
      height: 78,
      borderRadius: 39,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${palette.primary}24`,
      borderWidth: 2,
      borderColor: palette.primary,
    },
    captureInner: {
      width: 62,
      height: 62,
      borderRadius: 31,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.primary,
    },
    galleryButton: {
      marginTop: 14,
      minHeight: 42,
      borderRadius: 21,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: palette.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
    },
    galleryButtonText: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '800',
    },
  });

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path, Rect, SvgXml } from 'react-native-svg';

interface SignaturePadModalProps {
  visible: boolean;
  onSave: (signature: string) => void;
  onClose: () => void;
  label?: string;
  onLabelChange?: (label: string) => void;
  initialSignature?: string;
}

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;

type Point = { x: number; y: number };
type StrokePath = Point[];

function strokesToDataUri(strokes: StrokePath[], w: number, h: number): string {
  const toD = (pts: StrokePath) => {
    if (!pts.length) return '';
    if (pts.length === 1) return `M${pts[0].x - 1} ${pts[0].y}L${pts[0].x + 1} ${pts[0].y}`;
    return pts.reduce((d, p, i) => d + (i === 0 ? `M${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`), '');
  };
  const paths = strokes
    .map(s => `<path d="${toD(s)}" stroke="#1A1A1A" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="white"/>${paths}</svg>`;
  // encode to base64 without deprecated unescape
  const encoded = encodeURIComponent(svg).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16)));
  return `data:image/svg+xml;base64,${btoa(encoded)}`;
}

/** Decode a data URI back to raw SVG XML string */
function dataUriToSvgXml(dataUri: string): string | null {
  if (!dataUri.startsWith('data:image/svg+xml;base64,')) return null;
  try {
    const base64 = dataUri.replace('data:image/svg+xml;base64,', '');
    return atob(base64);
  } catch {
    return null;
  }
}

export default function SignaturePadModal({
  visible,
  onSave,
  onClose,
  label = 'Authorized Signature',
  onLabelChange,
  initialSignature,
}: SignaturePadModalProps) {
  "use no memo";

  const { height } = useWindowDimensions();
  const [paths, setPaths] = useState<StrokePath[]>([]);
  const [currentPath, setCurrentPath] = useState<StrokePath>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(initialSignature || null);

  // When the modal becomes visible, restore the saved signature
  const [prevVisible, setPrevVisible] = useState({ value: visible });
  if (visible !== prevVisible.value) {
    setPrevVisible({ value: visible });
    if (visible && initialSignature) {
      // Modal just opened — restore initialSignature if provided
      setUploadedImage(initialSignature);
      setPaths([]); // Clear any leftover drawn paths
    }
  }

  // Use refs for values read inside PanResponder callbacks — avoids stale closures
  const livePathRef = useRef<StrokePath>([]);
  const isDrawingRef = useRef(false);
  // canvasSizeRef is updated via onLayout and read in PanResponder — no stale closure
  const canvasSizeRef = useRef({ width: 0, height: 0 });

  const panResponder = useMemo(() =>
    PanResponder.create({
      // Capture the touch immediately so parent scroll/modal-drag can't steal it
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,

      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        isDrawingRef.current = true;
        const pt = {
          x: Math.max(0, Math.min(canvasSizeRef.current.width, locationX)),
          y: Math.max(0, Math.min(canvasSizeRef.current.height, locationY)),
        };
        livePathRef.current = [pt];
        setCurrentPath([pt]);
      },

      onPanResponderMove: (evt) => {
        if (!isDrawingRef.current) return;
        const { locationX, locationY } = evt.nativeEvent;
        const pt = {
          x: Math.max(0, Math.min(canvasSizeRef.current.width, locationX)),
          y: Math.max(0, Math.min(canvasSizeRef.current.height, locationY)),
        };
        livePathRef.current = [...livePathRef.current, pt];
        // Use functional update to avoid batching issues
        setCurrentPath(livePathRef.current.slice());
      },

      onPanResponderRelease: () => {
        if (livePathRef.current.length > 0) {
          const completed = livePathRef.current.slice();
          setPaths(prev => [...prev, completed]);
        }
        livePathRef.current = [];
        setCurrentPath([]);
        isDrawingRef.current = false;
      },

      onPanResponderTerminate: () => {
        // Gesture stolen (e.g. incoming call) — commit what we have
        if (livePathRef.current.length > 0) {
          const completed = livePathRef.current.slice();
          setPaths(prev => [...prev, completed]);
        }
        livePathRef.current = [];
        setCurrentPath([]);
        isDrawingRef.current = false;
      },

      // Don't let the termination request succeed while drawing
      onPanResponderTerminationRequest: () => !isDrawingRef.current,
    }),
    []
  );

  const pathToD = (pts: StrokePath) => {
    if (!pts.length) return '';
    if (pts.length === 1) return `M${pts[0].x - 1} ${pts[0].y}L${pts[0].x + 1} ${pts[0].y}`;
    return pts.reduce((d, p, i) => d + (i === 0 ? `M${p.x} ${p.y}` : `L${p.x} ${p.y}`), '');
  };

  const handleClear = useCallback(() => {
    setPaths([]);
    setCurrentPath([]);
    livePathRef.current = [];
    isDrawingRef.current = false;
    setUploadedImage(null);
  }, []);

  const handleSave = useCallback(() => {
    if (uploadedImage) {
      onSave(uploadedImage);
      onClose();
      return;
    }
    if (paths.length === 0) {
      Alert.alert('No Signature', 'Please draw a signature or upload an image.');
      return;
    }
    const { width, height } = canvasSizeRef.current;
    const uri = strokesToDataUri(paths, width, height);
    onSave(uri);
    onClose();
  }, [uploadedImage, paths, onSave, onClose]);

  const handleClose = useCallback(() => {
    // Don't clear the signature when closing — preserve it for next open
    setCurrentPath([]);
    livePathRef.current = [];
    isDrawingRef.current = false;
    onClose();
  }, [onClose]);

  const handleUpload = useCallback(async () => {
    try {
      // Android uses the system photo picker for one-off image selection without broad media access.
      if (Platform.OS !== 'android') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Please allow access to your photo library.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 2],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        setUploadedImage(`data:image/png;base64,${result.assets[0].base64}`);
        setPaths([]);
        setCurrentPath([]);
        livePathRef.current = [];
      }
    } catch {
      Alert.alert('Error', 'Failed to upload image.');
    }
  }, []);

  const handleCanvasLayout = useCallback((e: any) => {
    canvasSizeRef.current = {
      width: e.nativeEvent.layout.width,
      height: e.nativeEvent.layout.height,
    };
  }, []);

  const hasContent = paths.length > 0 || currentPath.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      // fullScreen avoids the iOS sheet drag-to-dismiss gesture competing with drawing
      presentationStyle="fullScreen"
      statusBarTranslucent={false}
      onRequestClose={handleClose}
    >
      <View style={styles.root}>
        {/* Safe-area top spacer */}
        <View style={styles.safeTop} />

        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable
            onPress={handleClose}
            style={styles.headerBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </Pressable>

          <Text style={styles.headerTitle}>Signature Pad</Text>

          <Pressable
            onPress={handleSave}
            style={styles.headerBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.saveText, !hasContent && !uploadedImage && styles.saveTextDim]}>
              Save
            </Text>
          </Pressable>
        </View>

        {/* ── Label row ── */}
        <View style={styles.labelRow}>
          <Text style={styles.labelCaption}>LABEL</Text>
          <TextInput
            style={styles.labelInput}
            value={label}
            onChangeText={onLabelChange}
            placeholder="e.g. Authorized Signature"
            placeholderTextColor="#C7C7CC"
            returnKeyType="done"
            editable={!!onLabelChange}
          />
        </View>

        {/* ── Canvas card ── */}
        <View style={[styles.card, { maxHeight: height * 0.56 }]}>
          {/* Clear button */}
          <View style={styles.cardHeader}>
            <Pressable
              onPress={handleClear}
              hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
            >
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          </View>

          {/* Drawing surface */}
          <View
            style={styles.canvas}
            onLayout={handleCanvasLayout}
          >
            {uploadedImage ? (
              // Check if it's an SVG data URI or a regular image
              uploadedImage.startsWith('data:image/svg+xml') ? (
                <SvgXml
                  xml={dataUriToSvgXml(uploadedImage) || ''}
                  width="100%"
                  height="100%"
                />
              ) : (
                <Image
                  source={{ uri: uploadedImage }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="contain"
                />
              )
            ) : (
              // The PanResponder view must be the direct touch target
              <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
                {/* SVG is pointer-events:none so it never intercepts touches */}
                <Svg
                  width="100%"
                  height="100%"
                  style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
                >
                  <Rect width="100%" height="100%" fill="white" />
                  {paths.map((p) => (
                    <Path
                      key={pathToD(p)}
                      d={pathToD(p)}
                      stroke="#1A1A1A"
                      strokeWidth={2.5}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                  {currentPath.length > 0 && (
                    <Path
                      d={pathToD(currentPath)}
                      stroke="#1A1A1A"
                      strokeWidth={2.5}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </Svg>

                {/* Hint — hidden once drawing starts */}
                {!hasContent && (
                  <View style={[styles.hint, { pointerEvents: 'none' }]}>
                    <Ionicons name="create-outline" size={48} color="#D1D1D6" />
                    <Text style={styles.hintText}>Draw your signature here</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* ── Upload button ── */}
        <Pressable
          style={styles.uploadBtn}
          onPress={handleUpload}
        >
          <Ionicons name="cloud-upload-outline" size={20} color="#444" />
          <Text style={styles.uploadText}>Upload Image</Text>
        </Pressable>

        {/* Safe-area bottom spacer */}
        <View style={styles.safeBottom} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  // Manual safe-area — avoids importing safe-area-context inside this component
  safeTop: {
    height: STATUS_BAR_HEIGHT,
    backgroundColor: '#FFFFFF',
  },
  safeBottom: {
    height: 20,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  headerBtn: {
    minWidth: 64,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  saveText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  saveTextDim: {
    color: '#C7C7CC',
  },

  // Label
  labelRow: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 10,
  },
  labelCaption: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  labelInput: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    fontSize: 15,
    color: '#3C3C43',
  },

  // Canvas card
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 14,
    overflow: 'hidden',
    flex: 1,
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  clearText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  canvas: {
    flex: 1,
    minHeight: 260,
    backgroundColor: '#FFFFFF',
  },
  hint: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  hintText: {
    fontSize: 14,
    color: '#C7C7CC',
  },

  // Upload
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C6C6C8',
  },
  uploadText: {
    fontSize: 16,
    color: '#444',
    fontWeight: '500',
  },
});

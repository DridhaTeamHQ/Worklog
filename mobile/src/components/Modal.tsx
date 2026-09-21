import React, { useEffect, useState } from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  Dimensions,
  Platform,
  ScrollView,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from '../components/Icon';
import { colors, borderRadius, spacing, typography } from '../theme';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  maxHeight?: ViewStyle['maxHeight'];
  footer?: React.ReactNode;
}

export function Modal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxHeight = '90%',
  footer,
}: ModalProps) {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const availableHeight = Math.max(260, Dimensions.get('window').height - keyboardHeight - insets.top - insets.bottom - 24);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', event => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
        <View style={styles.overlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={onClose} style={StyleSheet.absoluteFill} />
          <KeyboardAvoidingView
            // Android already resizes the app window for the keyboard. Applying
            // KeyboardAvoidingView's height behavior again makes short dialogs
            // collapse into a thin strip, especially the Create Department form.
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.keyboardView, { justifyContent: keyboardHeight ? 'flex-start' : 'center', paddingTop: Math.max(insets.top, keyboardHeight ? 10 : 12), paddingBottom: keyboardHeight ? 8 : Math.max(insets.bottom, 12) }]}
            pointerEvents="box-none"
          >
              <View style={[styles.dialog, { maxHeight: keyboardHeight ? availableHeight : maxHeight }]}>
                <View style={styles.header}>
                  <View style={styles.titleContainer}>
                    <Text style={styles.title}>{title}</Text>
                    {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
                  </View>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={onClose}
                    activeOpacity={0.7}
                  >
                    <X size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={styles.content}
                  contentInsetAdjustmentBehavior="automatic"
                  automaticallyAdjustKeyboardInsets
                  contentContainerStyle={styles.contentContainer}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="none"
                >
                  {children}
                </ScrollView>
                {footer && <View style={styles.footer}>{footer}</View>}
              </View>
          </KeyboardAvoidingView>
        </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 500,
  },
  dialog: {
    flexShrink: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorderHighlight,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    maxHeight: '100%',
  },
  header: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  titleContainer: {
    flex: 1,
    paddingRight: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: typography.weights.bold,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.cardBorder, flexShrink: 0 },
});


import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle, AlertCircle, Info, X } from '../components/Icon';
import { colors, borderRadius, spacing } from '../theme';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev.slice(-2), { id, type, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const success = useCallback((msg: string) => toast(msg, 'success'), [toast]);
  const error = useCallback((msg: string) => toast(msg, 'error'), [toast]);
  const info = useCallback((msg: string) => toast(msg, 'info'), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      <View style={styles.container} pointerEvents="box-none">
        <SafeAreaView pointerEvents="box-none" style={styles.safeArea}>
          {toasts.map((t) => (
            <TouchableOpacity
              key={t.id}
              activeOpacity={0.9}
              onPress={() => removeToast(t.id)}
              style={[
                styles.toast,
                t.type === 'success' && styles.successToast,
                t.type === 'error' && styles.errorToast,
                t.type === 'info' && styles.infoToast,
              ]}
            >
              <View style={styles.iconContainer}>
                {t.type === 'success' && <CheckCircle size={20} color="#22c55e" />}
                {t.type === 'error' && <AlertCircle size={20} color="#ef4444" />}
                {t.type === 'info' && <Info size={20} color="#3b82f6" />}
              </View>
              <Text style={styles.message} numberOfLines={3}>
                {t.message}
              </Text>
              <X size={16} color="rgba(255, 255, 255, 0.45)" style={styles.closeIcon} />
            </TouchableOpacity>
          ))}
        </SafeAreaView>
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    elevation: 100,
    alignItems: 'center',
  },
  safeArea: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
    width: '100%',
    maxWidth: 480,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 24,
  },
  successToast: {
    borderColor: '#22c55e',
    backgroundColor: '#0c2415', // 100% Solid dark emerald
  },
  errorToast: {
    borderColor: '#ef4444',
    backgroundColor: '#270e12', // 100% Solid dark crimson
  },
  infoToast: {
    borderColor: '#3b82f6',
    backgroundColor: '#0c1b30', // 100% Solid dark sapphire
  },
  iconContainer: {
    marginRight: 10,
  },
  closeIcon: {
    marginLeft: 8,
  },
  message: {
    color: '#ffffff',
    fontSize: 13.5,
    flex: 1,
    fontWeight: '600',
    lineHeight: 19,
  },
});


import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, Check, Search, X } from '../components/Icon';
import { colors, borderRadius, spacing, typography } from '../theme';

export interface SelectOption<T = string | number> {
  label: string;
  value: T;
  sublabel?: string;
}

interface SelectPickerProps<T = string | number> {
  label?: string;
  placeholder?: string;
  options: SelectOption<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  error?: string;
  searchable?: boolean;
}

export function SelectPicker<T = string | number>({
  label,
  placeholder = 'Select an option',
  options,
  value,
  onChange,
  error,
  searchable = false,
}: SelectPickerProps<T>) {
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState('');

  const selectedOption = options.find((o) => o.value === value);

  const filteredOptions = searchable && query.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(query.toLowerCase()))
      )
    : options;

  return (
    <View style={styles.container}>
      {Boolean(label) && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.selector, Boolean(error) && styles.selectorError]}
        onPress={() => { Keyboard.dismiss(); setQuery(''); setModalVisible(true); }}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.selectedText,
            !selectedOption && styles.placeholderText,
          ]}
          numberOfLines={1}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <ChevronDown size={18} color={colors.textMuted} />
      </TouchableOpacity>
      {Boolean(error) && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.modalOverlay, { paddingTop: insets.top }]}
          >
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { paddingBottom: insets.bottom + spacing.md, paddingLeft: insets.left, paddingRight: insets.right }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{label || 'Select'}</Text>
                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    style={styles.closeBtn}
                  >
                    <X size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {searchable && (
                  <View style={styles.searchWrapper}>
                    <Search size={16} color={colors.textMuted} style={styles.searchIcon} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search..."
                      placeholderTextColor={colors.placeholder}
                      value={query}
                      onChangeText={setQuery}
                      autoCorrect={false}
                    />
                  </View>
                )}

                <FlatList
                  data={filteredOptions}
                  keyExtractor={(item) => String(item.value)}
                  style={styles.list}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const isSelected = item.value === value;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.optionItem,
                          isSelected && styles.optionItemSelected,
                        ]}
                        onPress={() => {
                          onChange(item.value);
                          setModalVisible(false);
                          setQuery('');
                        }}
                      >
                        <View style={styles.optionTextContainer}>
                          <Text
                            style={[
                              styles.optionLabel,
                              isSelected && styles.optionLabelSelected,
                            ]}
                          >
                            {item.label}
                          </Text>
                          {Boolean(item.sublabel) && (
                            <Text style={styles.optionSublabel}>
                              {item.sublabel}
                            </Text>
                          )}
                        </View>
                        {isSelected && (
                          <Check size={18} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={styles.emptyList}>
                      <Text style={styles.emptyListText}>No options found</Text>
                    </View>
                  }
                />
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: typography.weights.medium,
    marginBottom: 6,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  selectorError: {
    borderColor: colors.danger,
  },
  selectedText: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },
  placeholderText: {
    color: colors.placeholder,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorderHighlight,
    maxHeight: '75%',
    flexShrink: 1,
  },
  modalHeader: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: typography.weights.bold,
  },
  closeBtn: {
    padding: 4,
  },
  searchWrapper: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: borderRadius.md,
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    paddingVertical: 8,
    fontSize: 14,
  },
  list: {
    flexShrink: 1,
    minHeight: 0,
    paddingHorizontal: spacing.md,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: 4,
  },
  optionItemSelected: {
    backgroundColor: colors.primaryLight,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: typography.weights.medium,
  },
  optionLabelSelected: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  optionSublabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  emptyList: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyListText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});


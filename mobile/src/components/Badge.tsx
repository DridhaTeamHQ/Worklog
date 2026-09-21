import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, borderRadius, spacing, typography } from '../theme';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';
  size?: 'sm' | 'md';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Badge({
  label,
  variant = 'neutral',
  size = 'sm',
  style,
  textStyle,
}: BadgeProps) {
  return (
    <View style={[styles.base, styles[variant], styles[`size_${size}`], style]}>
      <Text style={[styles.text, styles[`text_${variant}`], styles[`textSize_${size}`], textStyle]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
  },
  success: {
    backgroundColor: colors.successLight,
    borderColor: colors.successBorder,
  },
  warning: {
    backgroundColor: colors.warningLight,
    borderColor: colors.warningBorder,
  },
  danger: {
    backgroundColor: colors.dangerLight,
    borderColor: colors.dangerBorder,
  },
  info: {
    backgroundColor: colors.infoLight,
    borderColor: colors.infoBorder,
  },
  purple: {
    backgroundColor: colors.purpleLight,
    borderColor: 'rgba(126, 34, 206, 0.25)',
  },
  neutral: {
    backgroundColor: colors.secondary,
    borderColor: colors.cardBorder,
  },
  size_sm: {
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  size_md: {
    paddingVertical: 3.5,
    paddingHorizontal: 9,
  },
  text: {
    fontWeight: typography.weights.semibold,
  },
  text_primary: {
    color: colors.primary,
  },
  text_success: {
    color: colors.success,
  },
  text_warning: {
    color: colors.warning,
  },
  text_danger: {
    color: colors.danger,
  },
  text_info: {
    color: colors.info,
  },
  text_purple: {
    color: colors.purple,
  },
  text_neutral: {
    color: colors.textSecondary,
  },
  textSize_sm: {
    fontSize: 10.5,
  },
  textSize_md: {
    fontSize: 12,
  },
});

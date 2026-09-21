import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { colors, borderRadius, spacing, typography } from '../theme';

interface StatCardProps {
  label: string;
  value: number | string;
  sublabel?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export function StatCard({
  label,
  value,
  sublabel,
  icon,
  accentColor = colors.primary,
  onPress,
  style,
}: StatCardProps) {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.card, style]}
    >
      <View style={styles.header}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {icon && <View style={[styles.iconBox, { backgroundColor: `${accentColor}20` }]}>{icon}</View>}
      </View>
      <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
      {sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    flex: 1,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: typography.weights.medium,
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconBox: {
    padding: 6,
    borderRadius: borderRadius.md,
    marginLeft: spacing.xs,
  },
  value: {
    fontSize: 21,
    fontWeight: typography.weights.bold,
    marginTop: 2,
  },
  sublabel: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
});

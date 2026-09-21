import React from 'react';
import { View, StyleSheet, ViewProps, ViewStyle, StyleProp } from 'react-native';
import { colors, borderRadius, spacing } from '../theme';

interface CardProps extends ViewProps {
  key?: any;
  variant?: 'default' | 'highlight' | 'flat';
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function Card({ variant = 'default', style, children, ...props }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        variant === 'highlight' && styles.highlight,
        variant === 'flat' && styles.flat,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  highlight: {
    borderColor: colors.cardBorderHighlight,
    backgroundColor: colors.cardHover,
  },
  flat: {
    backgroundColor: colors.card,
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
});

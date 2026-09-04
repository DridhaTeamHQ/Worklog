import { View } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import { useTheme } from '@/theme';
import { Text } from './Text';

/**
 * Small chart wrappers over react-native-gifted-charts, so the rest of the app never
 * touches the library directly and the look stays consistent: no axes, no grid, soft
 * area fill — the sparkline style of the reference's stat cards.
 */

interface SparkProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  area?: boolean;
}

export function Sparkline({ data, color, height = 44, width, area = true }: SparkProps) {
  const t = useTheme();
  const c = color ?? t.colors.hero;
  const points = (data.length ? data : [0, 0]).map((v) => ({ value: Math.max(0, v) }));
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <View pointerEvents="none" style={{ height, overflow: 'hidden' }}>
      <LineChart
        data={points}
        height={height}
        width={width}
        adjustToWidth={!width}
        thickness={2.2}
        color={c}
        curved
        curvature={0.25}
        areaChart={area}
        startFillColor={c}
        endFillColor={c}
        startOpacity={0.28}
        endOpacity={0.02}
        hideDataPoints
        hideAxesAndRules
        hideYAxisText
        yAxisThickness={0}
        xAxisThickness={0}
        initialSpacing={0}
        endSpacing={0}
        maxValue={max}
        disableScroll
        isAnimated
        animationDuration={600}
      />
    </View>
  );
}

interface BarsProps {
  data: { value: number; label?: string; highlight?: boolean }[];
  color?: string;
  height?: number;
  /** Space between bars. */
  gap?: number;
  barWidth?: number;
  showLabels?: boolean;
}

/** The little red/blue bar strip on the reference's blood-pressure card. */
export function MiniBars({ data, color, height = 48, gap = 4, barWidth = 6, showLabels }: BarsProps) {
  const t = useTheme();
  const base = color ?? t.colors.hero;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={{ height: height + (showLabels ? 16 : 0), flexDirection: 'row', alignItems: 'flex-end', gap }}>
      {data.map((d, i) => (
        <View key={i} style={{ alignItems: 'center', gap: 4 }}>
          <View style={{ width: barWidth, height, justifyContent: 'flex-end' }}>
            <View style={{ width: barWidth, borderRadius: barWidth / 2, backgroundColor: d.highlight ? t.colors.danger : base, height: Math.max(3, (d.value / max) * height), opacity: d.value === 0 ? 0.25 : 1 }} />
          </View>
          {showLabels && d.label ? <Text variant="caption" color="inkFaint" style={{ letterSpacing: 0, fontSize: 9 }}>{d.label}</Text> : null}
        </View>
      ))}
    </View>
  );
}

interface DonutProps {
  slices: { value: number; color: string; label: string }[];
  size?: number;
  centerLabel?: string;
  centerSub?: string;
}

/** Status breakdown as a ring with the total in the middle. */
export function Donut({ slices, size = 160, centerLabel, centerSub }: DonutProps) {
  const t = useTheme();
  const shown = slices.filter((s) => s.value > 0);
  const data = shown.length ? shown.map((s) => ({ value: s.value, color: s.color })) : [{ value: 1, color: t.colors.neutralSoft }];
  return (
    <View style={{ alignItems: 'center', gap: 16 }}>
      <PieChart
        data={data}
        donut
        radius={size / 2}
        innerRadius={size / 2 - 22}
        innerCircleColor={t.colors.card}
        strokeWidth={3}
        strokeColor={t.colors.card}
        centerLabelComponent={() => (
          <View style={{ alignItems: 'center' }}>
            {centerLabel ? <Text variant="h1">{centerLabel}</Text> : null}
            {centerSub ? <Text variant="caption" color="inkMuted">{centerSub}</Text> : null}
          </View>
        )}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
        {slices.map((s) => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
            <Text variant="small" color="inkMuted">{s.label} <Text variant="smallStrong">{s.value}</Text></Text>
          </View>
        ))}
      </View>
    </View>
  );
}

interface GroupedBarsProps {
  data: { label: string; values: { value: number; color: string }[] }[];
  height?: number;
}

/** Grouped bars per person for the analytics screen. */
export function GroupedBars({ data, height = 160 }: GroupedBarsProps) {
  const t = useTheme();
  const bars = data.flatMap((row) => row.values.map((v, i) => ({
    value: v.value,
    frontColor: v.color,
    label: i === 0 ? row.label : undefined,
    spacing: i === row.values.length - 1 ? 18 : 3,
    labelWidth: 40,
    labelTextStyle: { color: t.colors.inkMuted, fontSize: 10, fontFamily: t.fonts.semibold },
  })));
  return (
    <BarChart
      data={bars}
      height={height}
      barWidth={10}
      barBorderRadius={5}
      noOfSections={3}
      rulesColor={t.colors.border}
      rulesType="solid"
      yAxisThickness={0}
      xAxisThickness={0}
      yAxisTextStyle={{ color: t.colors.inkFaint, fontSize: 10 }}
      isAnimated
      animationDuration={600}
      disableScroll={bars.length < 12}
    />
  );
}

// ---------------------------------------------------------------------------------
// The reference's metric charts: a dotted line with an area fill, faint labelled
// rules, a dark tooltip on the point that matters, and a half-ring gauge.
// ---------------------------------------------------------------------------------

import { useState } from 'react';
import Svg, { Path } from 'react-native-svg';
import type { LayoutChangeEvent } from 'react-native';

/** Round the axis top to something a person would draw: 5, 10, 20, 50, 100 … */
function niceMax(max: number): number {
  if (max <= 5) return 5;
  const mag = 10 ** Math.floor(Math.log10(max));
  const n = max / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

function Dot({ color, fill }: { color: string; fill: string }) {
  return <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: fill, borderWidth: 2, borderColor: color }} />;
}

/** The dark pill with a tail that sits above the peak point — or below it when the peak touches the top. */
function Bubble({ text, below }: { text: string; below?: boolean }) {
  const t = useTheme();
  const pill = (
    <View style={{ backgroundColor: t.colors.tooltip, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 }}>
      <Text variant="caption" color={t.colors.onTooltip} style={{ fontFamily: t.fonts.semibold, letterSpacing: 0 }}>{text}</Text>
    </View>
  );
  const tail = (
    <View style={{
      width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderLeftColor: 'transparent', borderRightColor: 'transparent',
      ...(below ? { borderBottomWidth: 5, borderBottomColor: t.colors.tooltip } : { borderTopWidth: 5, borderTopColor: t.colors.tooltip }),
    }}
    />
  );
  return <View style={{ alignItems: 'center' }}>{below ? tail : pill}{below ? pill : tail}</View>;
}

interface TrendProps {
  data: number[];
  /** A comparison series drawn quieter, behind. */
  data2?: number[];
  labels?: string[];
  height?: number;
  color?: string;
  color2?: string;
  /** Which point gets the tooltip. */
  annotate?: 'max' | 'last' | 'none';
  formatValue?: (v: number) => string;
  curved?: boolean;
}

/**
 * A line with white-filled dots and a soft area under it, four faint rules with
 * small labels on the left, and a tooltip over the peak. Sized to its container.
 */
export function TrendChart({ data, data2, labels, height = 170, color, color2, annotate = 'max', formatValue = (v) => String(v), curved = false }: TrendProps) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const c = color ?? t.colors.hero;
  const c2 = color2 ?? t.colors.info;
  const series = data.length >= 2 ? data : [...data, ...Array(2 - data.length).fill(0)];
  // Whole-number rules: up to four sections, and a top that divides evenly by them.
  const rawMax = Math.max(1, ...series, ...(data2 ?? []));
  const sections = Math.min(4, Math.ceil(rawMax));
  const max = rawMax > 20 ? Math.ceil(niceMax(rawMax) / sections) * sections : Math.ceil(rawMax / sections) * sections;
  const peak = annotate === 'none' ? -1 : annotate === 'last' ? series.length - 1 : series.indexOf(Math.max(...series));
  // The chart clips at its top edge, so a peak that touches it gets its tooltip underneath.
  const peakNearTop = peak >= 0 && series[peak] / max > (height - 48) / height;
  const axisWidth = 30;
  // Room at both ends for a centred tooltip over the first or last point.
  const inset = 20;
  const spacing = width ? Math.max(8, (width - axisWidth - inset * 2) / (series.length - 1)) : 24;

  const points = series.map((v, i) => ({
    value: Math.max(0, v),
    label: labels?.[i],
    customDataPoint: () => <Dot color={c} fill={t.colors.card} />,
    ...(i === peak ? {
      dataPointLabelComponent: () => <Bubble text={formatValue(v)} below={peakNearTop} />,
      // The library centres the label just above the point; nudge it a touch higher,
      // or push it clear under the point when the peak touches the top edge.
      dataPointLabelShiftY: peakNearTop ? 48 : -3,
      dataPointLabelShiftX: 0,
    } : {}),
  }));
  const points2 = data2?.map((v) => ({ value: Math.max(0, v), hideDataPoint: true }));

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} pointerEvents="none" style={{ marginLeft: -6 }}>
      {width ? (
        <LineChart
          data={points}
          data2={points2}
          height={height}
          width={width - axisWidth}
          spacing={spacing}
          initialSpacing={inset}
          endSpacing={inset}
          overflowTop={44}
          maxValue={max}
          noOfSections={sections}
          thickness={2.4}
          thickness2={2}
          color={c}
          color2={c2}
          curved={curved}
          curvature={0.2}
          areaChart
          startFillColor={c}
          endFillColor={c}
          startOpacity={0.22}
          endOpacity={0}
          areaChart2={false}
          rulesColor={t.colors.border}
          rulesType="solid"
          yAxisThickness={0}
          xAxisThickness={0}
          yAxisLabelWidth={axisWidth}
          yAxisTextStyle={{ color: t.colors.inkFaint, fontSize: 10, fontFamily: t.fonts.medium }}
          xAxisLabelTextStyle={{ color: t.colors.inkFaint, fontSize: 10, fontFamily: t.fonts.medium }}
          xAxisLabelsHeight={labels ? 16 : 0}
          disableScroll
        />
      ) : null}
    </View>
  );
}

interface GaugeProps {
  /** 0..1 */
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  sub?: string;
}

/** A half ring: muted track, accent fill, the percentage in the middle, a caption beneath. */
export function Gauge({ value, size = 220, stroke = 18, color, label, sub }: GaugeProps) {
  const t = useTheme();
  const c = color ?? t.colors.hero;
  const v = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const cy = r + stroke / 2;
  const d = `M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`;
  const len = Math.PI * r;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: cy + stroke / 2 }}>
        <Svg width={size} height={cy + stroke / 2}>
          <Path d={d} stroke={t.colors.cardAlt} strokeWidth={stroke} fill="none" strokeLinecap="round" />
          <Path d={d} stroke={c} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${len * v} ${len}`} />
        </Svg>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' }}>
          {label ? <Text variant="stat">{label}</Text> : null}
          {sub ? <Text variant="small" color="inkMuted">{sub}</Text> : null}
        </View>
      </View>
    </View>
  );
}

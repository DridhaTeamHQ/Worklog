import Svg, { Circle } from 'react-native-svg';
import { View } from 'react-native';

const DIGITS = [
  ['111', '101', '101', '101', '111'],
  ['010', '110', '010', '010', '111'],
  ['111', '001', '111', '100', '111'],
  ['111', '001', '111', '001', '111'],
  ['101', '101', '111', '001', '001'],
  ['111', '100', '111', '001', '111'],
  ['111', '100', '111', '101', '111'],
  ['111', '001', '010', '010', '010'],
  ['111', '101', '111', '101', '111'],
  ['111', '101', '111', '001', '111'],
];

/** Instrument-inspired digits, with one accessible value instead of individual dots. */
export function DotNumber({ value, height = 58, color }: { value: number; height?: number; color: string }) {
  const digits = String(Math.max(0, Math.round(value)));
  const columns = digits.length * 4 - 1;
  return <View accessible accessibilityLabel={digits}><Svg width={height * columns / 5} height={height} viewBox={`0 0 ${columns * 10} 50`}>
    {[...digits].flatMap((digit, i) => DIGITS[Number(digit)].flatMap((row, y) => [...row].map((on, x) => <Circle key={`${i}-${y}-${x}`} cx={i * 40 + x * 10 + 5} cy={y * 10 + 5} r={3.1} fill={color} opacity={on === '1' ? 1 : 0.1} />)))}
  </Svg></View>;
}

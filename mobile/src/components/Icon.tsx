/**
 * Icon adapter — maps lucide-react-native icon names to @expo/vector-icons (Ionicons).
 * This avoids the react-native-svg dependency that lucide-react-native requires.
 * All lucide icons used across the app are re-exported as named components here.
 */
import React from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface IconProps {
  size?: number;
  color?: string;
  style?: object;
}

function createIcon(name: IoniconsName) {
  return function Icon({ size = 20, color = '#fff', style }: IconProps) {
    return <Ionicons name={name} size={size} color={color} style={style} />;
  };
}

// Navigation / Layout
export const LayoutDashboard = createIcon('grid-outline');
export const Home = createIcon('home-outline');

// Tasks / Checks
export const CheckSquare = createIcon('checkbox-outline');
export const CheckCircle = createIcon('checkmark-circle-outline');
export const CheckCircle2 = createIcon('checkmark-circle-outline');
export const Check = createIcon('checkmark-outline');
export const Circle = createIcon('ellipse-outline');

// Time / Calendar
export const Sun = createIcon('sunny-outline');
export const Calendar = createIcon('calendar-outline');
export const Clock = createIcon('time-outline');

// Communication / Alerts
export const Bell = createIcon('notifications-outline');
export const Mail = createIcon('mail-outline');
export const Ticket = createIcon('ticket-outline');
export const MessageSquare = createIcon('chatbubble-outline');

// People / Users
export const User = createIcon('person-outline');
export const UserCheck = createIcon('checkmark-circle-outline');
export const UserPlus = createIcon('person-add-outline');
export const Users = createIcon('people-outline');

// Security / Roles
export const Shield = createIcon('shield-outline');
export const ShieldCheck = createIcon('shield-checkmark-outline');

// Organization / Contact
export const Phone = createIcon('call-outline');
export const Building = createIcon('business-outline');
export const Briefcase = createIcon('briefcase-outline');

// Analytics / Charts
export const BarChart2 = createIcon('bar-chart-outline');
export const BarChart3 = createIcon('bar-chart-outline');
export const TrendingUp = createIcon('trending-up-outline');
export const PieChart = createIcon('pie-chart-outline');
export const Award = createIcon('ribbon-outline');

// Files / Documents
export const FileText = createIcon('document-text-outline');
export const FileCheck = createIcon('checkmark-done-outline');
export const FileCheck2 = createIcon('document-text-outline');
export const Folder = createIcon('folder-outline');
export const Clipboard = createIcon('clipboard-outline');

// UI / Controls
export const Search = createIcon('search-outline');
export const Filter = createIcon('filter-outline');
export const Plus = createIcon('add-outline');
export const Play = createIcon('play-outline');
export const CheckCheck = createIcon('checkmark-done-outline');
export const Edit = createIcon('create-outline');
export const Edit2 = createIcon('create-outline');
export const Trash2 = createIcon('trash-outline');
export const X = createIcon('close-outline');
export const ChevronLeft = createIcon('chevron-back-outline');
export const ChevronRight = createIcon('chevron-forward-outline');
export const ChevronDown = createIcon('chevron-down-outline');
export const ChevronUp = createIcon('chevron-up-outline');
export const Eye = createIcon('eye-outline');
export const EyeOff = createIcon('eye-off-outline');
export const MoreVertical = createIcon('ellipsis-vertical-outline');
export const Settings = createIcon('settings-outline');
export const LogOut = createIcon('log-out-outline');
export const Lock = createIcon('lock-closed-outline');
export const Server = createIcon('server-outline');
export const Sparkles = createIcon('sparkles-outline');
export const Inbox = createIcon('mail-unread-outline');
export const KeyRound = createIcon('key-outline');

// Status / Alerts
export const AlertCircle = createIcon('alert-circle-outline');
export const AlertTriangle = createIcon('warning-outline');
export const Info = createIcon('information-circle-outline');

// Misc
export const RefreshCw = createIcon('refresh-outline');
export const ExternalLink = createIcon('open-outline');
export const Copy = createIcon('copy-outline');
export const Share = createIcon('share-outline');
export const Star = createIcon('star-outline');
export const Tag = createIcon('pricetag-outline');
export const Flag = createIcon('flag-outline');
export const ArrowLeft = createIcon('arrow-back-outline');
export const ArrowRight = createIcon('arrow-forward-outline');


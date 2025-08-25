import {
  Home,
  Users,
  Video,
  History,
  BarChart3,
  Building2,
  Settings,
} from 'lucide-react';

export const NAVIGATION_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: Home, available: true },
  { path: '/team', label: 'Team', icon: Users, available: false },
  { path: '/meetings', label: 'Meetings', icon: Video, available: true },
  { path: '/history', label: 'History', icon: History, available: false },
  { path: '/analytics', label: 'Analytics', icon: BarChart3, available: false },
  {
    path: '/organization',
    label: 'Organization',
    icon: Building2,
    available: false,
  },
  { path: '/settings', label: 'Settings', icon: Settings, available: true },
];

export const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Contact', href: '#contact' },
];

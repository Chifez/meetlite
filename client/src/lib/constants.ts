import {
  Home,
  Users,
  Video,
  BarChart3,
  Building2,
  Settings,
  Film,
} from 'lucide-react';
import type { NavigationItem } from './types';

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: Home, available: true },
  {
    path: '/members',
    label: 'Members',
    icon: Users,
    available: true,
    organizationOnly: true,
  },
  { path: '/meetings', label: 'Meetings', icon: Video, available: true },
  {
    path: '/recordings',
    label: 'Recordings',
    icon: Film,
    available: true,
    organizationOnly: true,
  },
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

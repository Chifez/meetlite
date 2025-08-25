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
  { path: '/dashboard', label: 'Dashboard', icon: Home },
  { path: '/team', label: 'Team Members', icon: Users },
  { path: '/meetings', label: 'Meetings', icon: Video },
  { path: '/history', label: 'History', icon: History },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/organization', label: 'Organization', icon: Building2 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Contact', href: '#contact' },
];

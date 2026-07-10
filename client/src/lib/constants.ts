import {
  Home,
  Users,
  Video,
  BarChart3,
  Building2,
  Settings,
  Film,
  Bell,
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
  {
    path: '/notifications',
    label: 'Notifications',
    icon: Bell,
    available: true,
  },
  { path: '/analytics', label: 'Analytics', icon: BarChart3, available: true },
  {
    path: '/organization',
    label: 'Organization',
    icon: Building2,
    available: true,
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: Settings,
    available: true,
    children: [
      { path: '/settings/profile', label: 'Profile', available: true },
      { path: '/settings/organization', label: 'Workspace', available: true, organizationOnly: true },
      { path: '/settings/plan', label: 'Plan & Billing', available: true },
      { path: '/settings/notifications', label: 'Notifications', available: true },
    ]
  },
];

export const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Testimonials', href: '#testimonials' },
  { label: 'Compare', href: '#comparison' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Contact', href: '#contact' },
];

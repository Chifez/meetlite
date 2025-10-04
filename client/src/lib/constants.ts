import {
  Home,
  Users,
  Video,
  History,
  BarChart3,
  Building2,
  Settings,
  Film,
} from 'lucide-react';

export const NAVIGATION_ITEMS = [
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
  { label: 'Testimonials', href: '#testimonials' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Contact', href: '#contact' },
];

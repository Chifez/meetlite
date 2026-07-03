import {
  LayoutDashboard,
  Database,
  DollarSign,
  Activity,
  Building,
} from 'lucide-react';
import type { NavigationItem } from './types';

export const ADMIN_NAVIGATION_ITEMS: NavigationItem[] = [
  { path: '/admin', label: 'Overview', icon: LayoutDashboard, available: true },
  { path: '/admin/manage', label: 'Manage', icon: Database, available: true },
  { path: '/admin/inquiries', label: 'Inquiries', icon: Building, available: true },
  { path: '/admin/revenue', label: 'Revenue', icon: DollarSign, available: true },
  { path: '/admin/system', label: 'System & Logs', icon: Activity, available: true },
];




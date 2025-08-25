import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Home,
  Users,
  Settings,
  History,
  Video,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
// import { useAuth } from "./auth-provider"
import { OrganizationSwitcher } from './organization-switcher';
import { useAuth } from '@/hooks/useAuth';
import UserMenu from '../ui/user-menu';
import { useNavigate } from 'react-router-dom';
import Logo from '../logo';

const navigationItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard', active: true },
  { icon: Users, label: 'Team Members', href: '/team' },
  { icon: Video, label: 'Meetings', href: '/meetings' },
  { icon: History, label: 'History', href: '/history' },
  { icon: BarChart3, label: 'Analytics', href: '/analytics' },
  { icon: Building2, label: 'Organization', href: '/organization' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

interface SidebarProps {
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (open: boolean) => void;
}

export function Sidebar({ mobileMenuOpen, setMobileMenuOpen }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const { user, organization, logout, setOrganization } = useAuth();
  const navigate = useNavigate();
  // Load organizations (mock data for now)
  useEffect(() => {
    const mockOrgs = [
      {
        id: 'org_1',
        name: 'Acme Corp',
        size: '51-200',
        industry: 'Technology',
        members: [],
      },
      {
        id: 'org_2',
        name: 'Design Studio',
        size: '1-10',
        industry: 'Design',
        members: [],
      },
    ];
    setOrganizations(mockOrgs);
  }, []);

  const handleOrgChange = (org: any) => {
    setOrganization(org);
    // Update user account type based on selection
    if (user) {
      const updatedUser = {
        ...user,
        accountType: org ? 'organization' : 'personal',
        organizationId: org?.id || undefined,
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300',
        'fixed md:relative z-50 md:z-auto h-full',
        'md:flex',
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        collapsed && 'md:w-16',
        !collapsed && 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!(collapsed && window.innerWidth >= 768) && (
          <div className="flex items-center gap-2">
            <Logo />
          </div>
        )}
        <div className="md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileMenuOpen?.(false)}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="hidden md:block">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {!(collapsed && window.innerWidth >= 768) && (
        <div className="p-4 border-b border-sidebar-border">
          <div className="mb-2">
            <p className="text-xs text-sidebar-foreground/60 uppercase tracking-wide font-medium">
              Workspace
            </p>
          </div>

          {/* Organization Switcher - Now a compact dropdown */}

          <OrganizationSwitcher
            currentOrg={organization}
            onOrgChange={handleOrgChange}
          />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navigationItems.map((item) => (
            <li key={item.href}>
              <Button
                variant={item.active ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent',
                  collapsed &&
                    window.innerWidth >= 768 &&
                    'justify-center px-2',
                  item.active &&
                    'bg-sidebar-accent text-sidebar-accent-foreground'
                )}
                onClick={() => setMobileMenuOpen?.(false)}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!(collapsed && window.innerWidth >= 768) && (
                  <span>{item.label}</span>
                )}
              </Button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <UserMenu
          collapsed={collapsed}
          onOpenSettings={() => navigate('?settings=true', { replace: false })}
        />
      </div>
    </div>
  );
}

import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './dropdown-menu';
import { Avatar, AvatarFallback } from './avatar';
import { Settings, LogOut, Menu } from 'lucide-react';
import ThemeToggle from '../ThemeToggle';
import { useTheme } from 'next-themes';

interface UserMenuProps {
  onOpenSettings: () => void;
}

function getInitials(user?: any) {
  if (!user.name) return `ML`;
  const parts = user?.name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function UserMenu({ onOpenSettings }: UserMenuProps) {
  const { user, logout } = useAuth();
  const { theme, resolvedTheme } = useTheme();
  if (!user) return null;

  const name = user.name || `${user.email.split('@')[0]}`;
  const email = user.email || 'user@example.com';
  const initials = getInitials(user);
  const currentMode = (resolvedTheme || theme) === 'dark' ? 'Dark' : 'Light';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div>
          <div className="hidden flex-1 lg:flex items-center justify-center w-fit gap-2  overflow-hidden text-ellipsis cursor-pointer">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px] bg-gradient-to-b to-[#131316] from-[#5C6670] text-white font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <div className="font-medium leading-tight text-xs ">{name}</div>
              <div className="text-xs text-gray-500 leading-tight truncate">
                {email}
              </div>
            </div>
          </div>
          <Menu className="lg:hidden" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <ThemeToggle className="flex items-start justify-start gap-3 font-normal w-full">
            <div className="flex items-center cursor-pointer">
              <span className="text-sm mr-2">{currentMode} mode</span>
            </div>
          </ThemeToggle>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onOpenSettings}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={logout}
          className="flex items-center gap-2 cursor-pointer text-destructive"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <div className="flex items-center gap-2 py-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px] bg-gradient-to-b to-[#131316] from-[#5C6670] text-white font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              {/* <div className="font-medium leading-tight text-sm">{name}</div> */}
              <div className="font-medium text-xs truncate">{email}</div>
            </div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

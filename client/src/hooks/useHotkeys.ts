import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

interface HotkeyConfig {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description: string;
  category: string;
}

export const useHotkeys = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Navigation hotkeys
  const navigationHotkeys: HotkeyConfig[] = [
    {
      key: 'h',
      ctrlKey: true,
      action: () => navigate('/dashboard'),
      description: 'Go to Dashboard',
      category: 'Navigation',
    },
    {
      key: 'm',
      ctrlKey: true,
      action: () => navigate('/members'),
      description: 'Go to Members',
      category: 'Navigation',
    },
    {
      key: 's',
      ctrlKey: true,
      action: () => navigate('/settings'),
      description: 'Go to Settings',
      category: 'Navigation',
    },
    {
      key: 'o',
      ctrlKey: true,
      action: () => navigate('/organizations'),
      description: 'Go to Organizations',
      category: 'Navigation',
    },
    {
      key: 'p',
      ctrlKey: true,
      action: () => navigate('/profile'),
      description: 'Go to Profile',
      category: 'Navigation',
    },
  ];

  // Quick actions hotkeys
  const quickActionHotkeys: HotkeyConfig[] = [
    {
      key: 'n',
      ctrlKey: true,
      action: () => {
        // Trigger new organization creation
        const event = new CustomEvent('hotkey:new-organization');
        window.dispatchEvent(event);
      },
      description: 'Create New Organization',
      category: 'Quick Actions',
    },
    {
      key: 'i',
      ctrlKey: true,
      action: () => {
        // Trigger invite member
        const event = new CustomEvent('hotkey:invite-member');
        window.dispatchEvent(event);
      },
      description: 'Invite Member',
      category: 'Quick Actions',
    },
    {
      key: 'u',
      ctrlKey: true,
      action: () => {
        // Trigger upgrade plan
        const event = new CustomEvent('hotkey:upgrade-plan');
        window.dispatchEvent(event);
      },
      description: 'Upgrade Plan',
      category: 'Quick Actions',
    },
    {
      key: 'r',
      ctrlKey: true,
      action: () => {
        // Refresh current page
        window.location.reload();
      },
      description: 'Refresh Page',
      category: 'Quick Actions',
    },
  ];

  // Search hotkeys
  const searchHotkeys: HotkeyConfig[] = [
    {
      key: '/',
      action: () => {
        // Focus search input
        const searchInput = document.querySelector(
          'input[type="search"], input[placeholder*="search" i]'
        ) as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      },
      description: 'Focus Search',
      category: 'Search',
    },
    {
      key: 'k',
      ctrlKey: true,
      action: () => {
        // Open command palette
        const event = new CustomEvent('hotkey:command-palette');
        window.dispatchEvent(event);
      },
      description: 'Open Command Palette',
      category: 'Search',
    },
  ];

  // Organization switcher hotkeys
  const organizationHotkeys: HotkeyConfig[] = [
    {
      key: '1',
      ctrlKey: true,
      action: () => {
        // Switch to first organization
        const event = new CustomEvent('hotkey:switch-org', {
          detail: { index: 0 },
        });
        window.dispatchEvent(event);
      },
      description: 'Switch to Organization 1',
      category: 'Organization',
    },
    {
      key: '2',
      ctrlKey: true,
      action: () => {
        // Switch to second organization
        const event = new CustomEvent('hotkey:switch-org', {
          detail: { index: 1 },
        });
        window.dispatchEvent(event);
      },
      description: 'Switch to Organization 2',
      category: 'Organization',
    },
    {
      key: '3',
      ctrlKey: true,
      action: () => {
        // Switch to third organization
        const event = new CustomEvent('hotkey:switch-org', {
          detail: { index: 2 },
        });
        window.dispatchEvent(event);
      },
      description: 'Switch to Organization 3',
      category: 'Organization',
    },
  ];

  // Modal hotkeys
  const modalHotkeys: HotkeyConfig[] = [
    {
      key: 'Escape',
      action: () => {
        // Close any open modal
        const event = new CustomEvent('hotkey:close-modal');
        window.dispatchEvent(event);
      },
      description: 'Close Modal',
      category: 'Modal',
    },
    {
      key: 'Enter',
      ctrlKey: true,
      action: () => {
        // Submit current form
        const event = new CustomEvent('hotkey:submit-form');
        window.dispatchEvent(event);
      },
      description: 'Submit Form',
      category: 'Modal',
    },
  ];

  // Help hotkeys
  const helpHotkeys: HotkeyConfig[] = [
    {
      key: '?',
      action: () => {
        // Show hotkey help
        const event = new CustomEvent('hotkey:show-help');
        window.dispatchEvent(event);
      },
      description: 'Show Hotkey Help',
      category: 'Help',
    },
  ];

  // Combine all hotkeys
  const allHotkeys: HotkeyConfig[] = [
    ...navigationHotkeys,
    ...quickActionHotkeys,
    ...searchHotkeys,
    ...organizationHotkeys,
    ...modalHotkeys,
    ...helpHotkeys,
  ];

  // Handle keydown events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger hotkeys when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.closest('[contenteditable="true"]')
      ) {
        return;
      }

      // Find matching hotkey
      const matchingHotkey = allHotkeys.find((hotkey) => {
        return (
          hotkey.key.toLowerCase() === event.key.toLowerCase() &&
          !!hotkey.ctrlKey === event.ctrlKey &&
          !!hotkey.altKey === event.altKey &&
          !!hotkey.shiftKey === event.shiftKey &&
          !!hotkey.metaKey === event.metaKey
        );
      });

      if (matchingHotkey) {
        event.preventDefault();
        matchingHotkey.action();
      }
    },
    [allHotkeys]
  );

  // Register event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Return hotkey information for help display
  return {
    hotkeys: allHotkeys,
    categories: [...new Set(allHotkeys.map((h) => h.category))],
  };
};

// Hook for getting hotkey help
export const useHotkeyHelp = () => {
  const { hotkeys, categories } = useHotkeys();

  const getHotkeysByCategory = (category: string) => {
    return hotkeys.filter((hotkey) => hotkey.category === category);
  };

  const formatHotkey = (hotkey: HotkeyConfig) => {
    const parts = [];
    if (hotkey.ctrlKey) parts.push('Ctrl');
    if (hotkey.altKey) parts.push('Alt');
    if (hotkey.shiftKey) parts.push('Shift');
    if (hotkey.metaKey) parts.push('Cmd');
    parts.push(hotkey.key.toUpperCase());
    return parts.join(' + ');
  };

  return {
    hotkeys,
    categories,
    getHotkeysByCategory,
    formatHotkey,
  };
};

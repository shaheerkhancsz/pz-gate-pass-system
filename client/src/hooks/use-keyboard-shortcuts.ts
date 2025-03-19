import { useEffect } from 'react';
import { useLocation } from 'wouter';

interface ShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const [location] = useLocation();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Don't trigger shortcuts when typing in input fields
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        if (
          event.key.toLowerCase() === shortcut.key.toLowerCase() &&
          !!event.ctrlKey === !!shortcut.ctrlKey &&
          !!event.altKey === !!shortcut.altKey &&
          !!event.shiftKey === !!shortcut.shiftKey
        ) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, location]); // Include location to handle route-specific shortcuts
}

// Predefined shortcuts for common actions
export const commonShortcuts: Record<string, ShortcutConfig> = {
  newGatePass: {
    key: 'n',
    ctrlKey: true,
    action: () => window.location.href = '/create-gate-pass',
    description: 'Create new gate pass',
  },
  search: {
    key: 'k',
    ctrlKey: true,
    action: () => document.querySelector<HTMLInputElement>('input[type="search"]')?.focus(),
    description: 'Focus search',
  },
  help: {
    key: '?',
    action: () => {
      // Show keyboard shortcuts help dialog
      document.dispatchEvent(new CustomEvent('show-shortcuts-help'));
    },
    description: 'Show keyboard shortcuts',
  },
  save: {
    key: 's',
    ctrlKey: true,
    action: () => {
      // Trigger form submit
      document.querySelector<HTMLFormElement>('form')?.requestSubmit();
    },
    description: 'Save changes',
  },
  cancel: {
    key: 'Escape',
    action: () => {
      // Close any open dialogs or go back
      if (document.querySelector('[role="dialog"]')) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      } else {
        window.history.back();
      }
    },
    description: 'Cancel/Close/Back',
  },
  print: {
    key: 'p',
    ctrlKey: true,
    action: () => {
      // Find and click print button if available
      document.querySelector<HTMLButtonElement>('button[aria-label="Print"]')?.click();
    },
    description: 'Print gate pass',
  },
}; 
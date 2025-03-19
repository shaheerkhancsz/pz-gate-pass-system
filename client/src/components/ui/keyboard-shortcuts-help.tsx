import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { commonShortcuts } from '@/hooks/use-keyboard-shortcuts';

export function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleShowShortcuts = () => setIsOpen(true);
    document.addEventListener('show-shortcuts-help', handleShowShortcuts);
    return () => document.removeEventListener('show-shortcuts-help', handleShowShortcuts);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Press the following key combinations to quickly access features
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {Object.entries(commonShortcuts).map(([id, shortcut]) => (
            <div key={id} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {shortcut.description}
              </span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                {[
                  shortcut.ctrlKey && 'Ctrl',
                  shortcut.altKey && 'Alt',
                  shortcut.shiftKey && 'Shift',
                  shortcut.key,
                ]
                  .filter(Boolean)
                  .join(' + ')}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
} 
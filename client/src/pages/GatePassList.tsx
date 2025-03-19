import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GatePassList as GatePassListComponent } from "@/components/gate-pass/GatePassList";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useKeyboardShortcuts, commonShortcuts } from '@/hooks/use-keyboard-shortcuts';

export default function GatePassList() {
  useKeyboardShortcuts([
    commonShortcuts.newGatePass,
    commonShortcuts.search,
    commonShortcuts.help,
  ]);

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-medium text-neutral-dark">Gate Passes List</h1>
        <Link href="/create-gate-pass">
          <Button className="bg-primary hover:bg-primary-dark text-white">
            <span className="material-icons mr-1">add</span> Create New
          </Button>
        </Link>
      </div>
      
      <GatePassListComponent />
    </AppLayout>
  );
}

import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GatePassForm } from "@/components/gate-pass/GatePassForm";
import { Link } from "wouter";

export default function CreateGatePass() {
  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl sm:text-2xl font-medium text-neutral-dark">Create New Gate Pass</h1>
        <Link href="/gate-passes">
          <a className="text-primary hover:underline flex items-center">
            <span className="material-icons mr-1">arrow_back</span>
            Back to Gate Passes
          </a>
        </Link>
      </div>
      
      <GatePassForm />
    </AppLayout>
  );
}

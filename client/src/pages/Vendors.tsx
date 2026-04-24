import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { VendorsManager } from "@/components/admin/VendorsManager";

export default function Vendors() {
  return (
    <AppLayout>
      <div className="container mx-auto p-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Vendor Management</h1>
        <VendorsManager />
      </div>
    </AppLayout>
  );
}

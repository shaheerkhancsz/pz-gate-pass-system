import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useKeyboardShortcuts, commonShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { gatePassWithItemsSchema } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { getTodayISO } from "@/lib/utils";

// Form schema
const formSchema = gatePassWithItemsSchema.extend({
  // ... existing schema extensions ...
});

type FormValues = z.infer<typeof formSchema>;

export function GatePassForm() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    // ... existing form config ...
  });
  const todayISO = getTodayISO();

  // Create gate pass mutation
  const createGatePassMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const response = await apiRequest("POST", "/api/gate-passes", {
        ...data,
        customerId: data.customerId ?? undefined,
        driverId: data.driverId ?? undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gate-passes"] });
      toast({
        title: "Success",
        description: "Gate pass created successfully",
      });
      setLocation("/gate-passes");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create gate pass",
        variant: "destructive",
      });
    },
  });

  // Print gate pass mutation
  const printGatePassMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const response = await apiRequest("POST", "/api/gate-passes/print", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gate-passes"] });
      toast({
        title: "Success",
        description: "Gate pass printed successfully",
      });
      setLocation("/gate-passes");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to print gate pass",
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = async (data: FormValues) => {
    try {
      await createGatePassMutation.mutateAsync(data);
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  // Add keyboard shortcuts
  useKeyboardShortcuts([
    {
      ...commonShortcuts.save,
      action: () => form.handleSubmit(onSubmit)(),
    },
    {
      ...commonShortcuts.cancel,
      action: () => setLocation('/gate-passes'),
    },
    {
      ...commonShortcuts.print,
      action: () => {
        form.trigger().then(isValid => {
          if (isValid) {
            const formData = form.getValues();
            const formattedData = {
              ...formData,
              items: formData.items.map((item: { name: string; sku: string; quantity: number }) => ({
                name: item.name,
                sku: item.sku,
                quantity: Number(item.quantity),
              })),
            };
            printGatePassMutation.mutate(formattedData);
          } else {
            toast({
              title: "Validation Error",
              description: "Please fill in all required fields correctly before printing.",
              variant: "destructive",
            });
          }
        });
      },
    },
    commonShortcuts.help,
  ]);

  return (
    // ... existing code ...
  );
} 
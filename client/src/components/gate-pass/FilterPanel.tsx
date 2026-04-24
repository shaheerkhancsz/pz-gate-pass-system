import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDepartments } from "@/hooks/use-departments";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

// Filter schema
const filterSchema = z.object({
  gatePassNumber: z.string().optional(),
  customerName: z.string().optional(),
  itemName: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  department: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
});

type FilterValues = z.infer<typeof filterSchema>;

interface FilterPanelProps {
  onFilter: (filters: FilterValues) => void;
}

const EMPTY_FILTERS: FilterValues = {
  gatePassNumber: "",
  customerName: "",
  itemName: "",
  dateFrom: "",
  dateTo: "",
  department: "all",
  status: "all",
  type: "all",
};

export function FilterPanel({ onFilter }: FilterPanelProps) {
  const { user, isAdmin } = useAuth();

  // Fetch departments scoped to the user's company (all users)
  const effectiveCompanyId = user?.companyId ?? null;
  const { data: departments = [] } = useQuery<{ id: number; name: string; active: boolean }[]>({
    queryKey: ["departments", effectiveCompanyId],
    queryFn: () => {
      const url = effectiveCompanyId
        ? `/api/departments?companyId=${effectiveCompanyId}`
        : `/api/departments`;
      return fetch(url, { credentials: "include" }).then(r => r.json());
    },
  });
  const activeDepts = departments.filter(d => d.active !== false);

  const form = useForm<FilterValues>({
    defaultValues: EMPTY_FILTERS,
  });

  const onSubmit = (data: FilterValues) => {
    onFilter(data);
  };

  const handleReset = () => {
    form.reset(EMPTY_FILTERS);
    onFilter(EMPTY_FILTERS);
  };

  return (
    <Card className="bg-white rounded-lg shadow-sm mb-6">
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <FormField
                control={form.control}
                name="gatePassNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gate Pass Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. OWNR-AG01-IS-2026-0001" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter customer name" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="itemName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter item name" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dateFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dateTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* department — controlled (value=) so reset reflects immediately */}
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select value={field.value ?? "all"} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="All Departments" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {activeDepts.map((dept) => (
                          <SelectItem key={dept.id} value={dept.name}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* status — controlled */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value ?? "all"} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="sent_back">Sent Back</SelectItem>
                        <SelectItem value="hod_approved">HOD Approved</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="security_allowed">Security Allowed</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="force_closed">Force Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* type — controlled */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pass Type</FormLabel>
                    <Select value={field.value ?? "all"} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="outward">Outward</SelectItem>
                        <SelectItem value="inward">Inward</SelectItem>
                        <SelectItem value="returnable">Returnable</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-4 flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={handleReset}>
                Reset
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary-dark text-white">
                <span className="material-icons mr-1">search</span> Apply Filters
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

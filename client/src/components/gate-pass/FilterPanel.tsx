import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { departmentOptions } from "@/lib/utils";

// Filter schema
const filterSchema = z.object({
  gatePassNumber: z.string().optional(),
  customerName: z.string().optional(),
  itemName: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  department: z.string().optional(),
  status: z.string().optional()
});

type FilterValues = z.infer<typeof filterSchema>;

interface FilterPanelProps {
  onFilter: (filters: FilterValues) => void;
}

export function FilterPanel({ onFilter }: FilterPanelProps) {
  const form = useForm<FilterValues>({
    defaultValues: {
      gatePassNumber: "",
      customerName: "",
      itemName: "",
      dateFrom: "",
      dateTo: "",
      department: "all",
      status: "all"
    },
  });

  const onSubmit = (data: FilterValues) => {
    onFilter(data);
  };

  const handleReset = () => {
    const resetValues = {
      gatePassNumber: "",
      customerName: "",
      itemName: "",
      dateFrom: "",
      dateTo: "",
      department: "all",
      status: "all"
    };
    
    form.reset(resetValues);
    
    // Make sure to call onFilter with the reset values
    onFilter(resetValues);
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
                      <Input placeholder="e.g. PZGP-042" {...field} />
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
              
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="All Departments" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departmentOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
            
            <div className="mt-4 flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
              >
                Reset
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary-dark text-white"
              >
                <span className="material-icons mr-1">search</span> Apply Filters
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

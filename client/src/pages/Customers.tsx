import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertCustomerSchema, type Customer, type InsertCustomer } from "@shared/schema";
import { PlusCircle, Search, Edit } from "lucide-react";
import { formatPhoneNumber, validatePhoneNumber } from "@/lib/utils";

// Define a simplified schema for the form
const formSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  phone: z.string()
    .min(1, "Phone number is required")
    .refine(validatePhoneNumber, {
      message: "Please enter a valid phone number",
    }),
  address: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function Customers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [phoneInput, setPhoneInput] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
    },
  });

  const editForm = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
    },
  });

  // Query to get customers
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["/api/customers", searchTerm],
    queryFn: async () => {
      const params = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : "";
      const res = await fetch(`/api/customers${params}`);
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    },
  });

  // Mutation to create customer
  const createMutation = useMutation({
    mutationFn: (data: FormData) => {
      return fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(res => {
        if (!res.ok) throw new Error("Failed to add customer");
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Success",
        description: "Customer added successfully",
      });
      setIsAddDialogOpen(false);
      form.reset();
      setPhoneInput("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add customer",
        variant: "destructive",
      });
      console.error("Failed to add customer:", error);
    },
  });

  // Mutation to update customer
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) => {
      return fetch(`/api/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(res => {
        if (!res.ok) throw new Error("Failed to update customer");
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Success",
        description: "Customer updated successfully",
      });
      setSelectedCustomer(null);
      setPhoneInput("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update customer",
        variant: "destructive",
      });
      console.error("Failed to update customer:", error);
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  const onUpdate = (data: FormData) => {
    if (selectedCustomer) {
      updateMutation.mutate({ id: selectedCustomer.id, data });
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    editForm.reset({
      name: customer.name,
      phone: customer.phone || "",
      address: customer.address || "",
    });
    setPhoneInput(customer.phone || "");
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedPhone = formatPhoneNumber(e.target.value);
    setPhoneInput(formattedPhone);
    form.setValue("phone", formattedPhone);
  };

  const handleEditPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedPhone = formatPhoneNumber(e.target.value);
    setPhoneInput(formattedPhone);
    editForm.setValue("phone", formattedPhone);
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Customer Management</h1>
        
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle>Customers</CardTitle>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Customer
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Customer</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Customer name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="03xx-xxxxxxx"
                                value={phoneInput}
                                onChange={handlePhoneChange}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address</FormLabel>
                            <FormControl>
                              <Input placeholder="Customer address" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="submit" disabled={createMutation.isPending}>
                          {createMutation.isPending ? "Saving..." : "Save Customer"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
            <CardDescription>
              Manage your customers database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center mb-4">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search customers..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8">Loading customers...</div>
            ) : customers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No customers found.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer: Customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>{customer.phone || "-"}</TableCell>
                        <TableCell>{customer.address || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditCustomer(customer)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Customer Dialog */}
        {selectedCustomer && (
          <Dialog open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Customer</DialogTitle>
              </DialogHeader>
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(onUpdate)} className="space-y-4">
                  <FormField
                    control={editForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Customer name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="03xx-xxxxxxx"
                            value={phoneInput}
                            onChange={handleEditPhoneChange}
                            onBlur={field.onBlur}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Customer address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? "Updating..." : "Update Customer"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AppLayout>
  );
}
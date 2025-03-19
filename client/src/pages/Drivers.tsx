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
import { type Driver } from "@shared/schema";
import { PlusCircle, Search, Edit } from "lucide-react";
import { formatCNIC, validateCNIC, formatPhoneNumber, validatePhoneNumber } from "@/lib/utils";

// Define a simplified schema for the form
const formSchema = z.object({
  name: z.string().min(1, "Driver name is required"),
  mobile: z.string()
    .min(1, "Mobile number is required")
    .refine(validatePhoneNumber, {
      message: "Please enter a valid mobile number",
    }),
  cnic: z.string()
    .min(1, "CNIC is required")
    .refine(validateCNIC, {
      message: "Please enter a valid CNIC number (e.g., 42201-1234567-8)",
    }),
  vehicleNumber: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function Drivers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [cnicInput, setCnicInput] = useState("");
  const [mobileInput, setMobileInput] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      mobile: "",
      cnic: "",
      vehicleNumber: "",
    },
  });

  const editForm = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      mobile: "",
      cnic: "",
      vehicleNumber: "",
    },
  });

  // Query to get drivers
  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["/api/drivers", searchTerm],
    queryFn: async () => {
      const params = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : "";
      const res = await fetch(`/api/drivers${params}`);
      if (!res.ok) throw new Error("Failed to fetch drivers");
      return res.json();
    },
  });

  // Mutation to create driver
  const createMutation = useMutation({
    mutationFn: (data: FormData) => {
      return fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(res => {
        if (!res.ok) throw new Error("Failed to add driver");
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({
        title: "Success",
        description: "Driver added successfully",
      });
      setIsAddDialogOpen(false);
      form.reset();
      setCnicInput("");
      setMobileInput("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add driver",
        variant: "destructive",
      });
      console.error("Failed to add driver:", error);
    },
  });

  // Mutation to update driver
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) => {
      return fetch(`/api/drivers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(res => {
        if (!res.ok) throw new Error("Failed to update driver");
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({
        title: "Success",
        description: "Driver updated successfully",
      });
      setSelectedDriver(null);
      setCnicInput("");
      setMobileInput("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update driver",
        variant: "destructive",
      });
      console.error("Failed to update driver:", error);
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  const onUpdate = (data: FormData) => {
    if (selectedDriver) {
      updateMutation.mutate({ id: selectedDriver.id, data });
    }
  };

  const handleEditDriver = (driver: Driver) => {
    setSelectedDriver(driver);
    editForm.reset({
      name: driver.name,
      mobile: driver.mobile,
      cnic: driver.cnic,
      vehicleNumber: driver.vehicleNumber || "",
    });
    setCnicInput(driver.cnic);
    setMobileInput(driver.mobile);
  };

  const handleCnicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNIC(e.target.value);
    setCnicInput(formatted);
    form.setValue("cnic", formatted);
  };

  const handleEditCnicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNIC(e.target.value);
    setCnicInput(formatted);
    editForm.setValue("cnic", formatted);
  };

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setMobileInput(formatted);
    form.setValue("mobile", formatted);
  };

  const handleEditMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setMobileInput(formatted);
    editForm.setValue("mobile", formatted);
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Driver Management</h1>
        
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle>Drivers</CardTitle>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Driver
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Driver</DialogTitle>
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
                              <Input placeholder="Driver name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="mobile"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mobile</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="03xx-xxxxxxx"
                                value={mobileInput}
                                onChange={handleMobileChange}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="cnic"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CNIC</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="xxxxx-xxxxxxx-x"
                                value={cnicInput}
                                onChange={handleCnicChange}
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="vehicleNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vehicle Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Vehicle registration number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="submit" disabled={createMutation.isPending}>
                          {createMutation.isPending ? "Saving..." : "Save Driver"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
            <CardDescription>
              Manage your drivers database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center mb-4">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search drivers..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8">Loading drivers...</div>
            ) : drivers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No drivers found.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>CNIC</TableHead>
                      <TableHead>Vehicle Number</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drivers.map((driver: Driver) => (
                      <TableRow key={driver.id}>
                        <TableCell className="font-medium">{driver.name}</TableCell>
                        <TableCell>{driver.mobile}</TableCell>
                        <TableCell>{driver.cnic}</TableCell>
                        <TableCell>{driver.vehicleNumber || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditDriver(driver)}
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

        {/* Edit Driver Dialog */}
        {selectedDriver && (
          <Dialog open={!!selectedDriver} onOpenChange={(open) => !open && setSelectedDriver(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Driver</DialogTitle>
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
                          <Input placeholder="Driver name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="mobile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="03xx-xxxxxxx"
                            value={mobileInput}
                            onChange={handleEditMobileChange}
                            onBlur={field.onBlur}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="cnic"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNIC</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="xxxxx-xxxxxxx-x"
                            value={cnicInput}
                            onChange={handleEditCnicChange}
                            onBlur={field.onBlur}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="vehicleNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Vehicle registration number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? "Updating..." : "Update Driver"}
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
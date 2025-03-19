import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Customer, InsertCustomer } from "@shared/schema";
import { PlusCircle, Search, UserPlus } from "lucide-react";
import { formatPhoneNumber, validatePhoneNumber } from "@/lib/utils";

interface CustomerSelectionProps {
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer) => void;
  onClearCustomer: () => void;
}

export function CustomerSelection({
  selectedCustomer,
  onSelectCustomer,
  onClearCustomer
}: CustomerSelectionProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Partial<InsertCustomer>>({
    name: "",
    phone: "",
    address: ""
  });
  const [phoneInput, setPhoneInput] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customersResponse, isLoading } = useQuery({
    queryKey: ["/api/customers", searchTerm],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/customers${searchTerm ? `?search=${searchTerm}` : ""}`);
      const data = await response.json();
      return data as Customer[];
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
  
  // Ensure we have a valid customers array
  const customers = Array.isArray(customersResponse) ? customersResponse : [];

  const createCustomerMutation = useMutation({
    mutationFn: async (newCustomer: InsertCustomer) => {
      const response = await apiRequest("POST", "/api/customers", newCustomer);
      const data = await response.json();
      return data as Customer;
    },
    onSuccess: (createdCustomer) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Customer created",
        description: `${createdCustomer.name} has been added to the database`,
        variant: "default"
      });
      onSelectCustomer(createdCustomer);
      setOpenDialog(false);
      setNewCustomer({
        name: "",
        phone: "",
        address: ""
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating customer",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedPhone = formatPhoneNumber(e.target.value);
    setPhoneInput(formattedPhone);
    setNewCustomer({ ...newCustomer, phone: formattedPhone });
  };

  const handleCreateCustomer = () => {
    if (!newCustomer.name) {
      toast({
        title: "Missing information",
        description: "Customer name is required",
        variant: "destructive"
      });
      return;
    }

    if (newCustomer.phone && !validatePhoneNumber(newCustomer.phone)) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid phone number (e.g., 0306-2228391)",
        variant: "destructive"
      });
      return;
    }

    createCustomerMutation.mutate(newCustomer as InsertCustomer);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="customerSelect" className="text-sm font-medium">
          Customer
        </Label>
        {selectedCustomer ? (
          <div className="flex w-full items-center gap-2">
            <div className="rounded-lg border p-2 text-sm flex-grow">
              <div className="font-semibold">{selectedCustomer.name}</div>
              {selectedCustomer.phone && <div>Phone: {selectedCustomer.phone}</div>}
              {selectedCustomer.address && <div>Address: {selectedCustomer.address}</div>}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearCustomer}
              className="flex-shrink-0"
            >
              Change
            </Button>
          </div>
        ) : (
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span>Select a customer</span>
                <UserPlus size={16} />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Customer Selection</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="search">
                <TabsList className="w-full">
                  <TabsTrigger value="search" className="flex-1">Search Existing</TabsTrigger>
                  <TabsTrigger value="new" className="flex-1">Add New</TabsTrigger>
                </TabsList>
                
                <TabsContent value="search" className="mt-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <Input
                      placeholder="Search customers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="flex-1"
                    />
                    <Button variant="secondary" size="icon">
                      <Search size={16} />
                    </Button>
                  </div>

                  {isLoading ? (
                    <div className="py-8 text-center">Loading customers...</div>
                  ) : customers.length === 0 ? (
                    <div className="py-8 text-center">
                      <p>No customers found.</p>
                      <Button 
                        variant="link" 
                        onClick={() => {
                          // Find the new tab trigger and switch to it
                          const newTabBtn = document.querySelector('[data-value="new"]') as HTMLElement;
                          if (newTabBtn) newTabBtn.click();
                        }}
                      >
                        Add a new customer
                      </Button>
                    </div>
                  ) : (
                    <ScrollArea className="h-72">
                      <div className="space-y-2">
                        {customers.map((customer) => (
                          <div
                            key={customer.id}
                            className="rounded-lg border p-3 cursor-pointer hover:bg-muted transition-colors"
                            onClick={() => {
                              onSelectCustomer(customer);
                              setOpenDialog(false);
                            }}
                          >
                            <div className="font-semibold">{customer.name}</div>
                            {customer.phone && <div className="text-sm">Phone: {customer.phone}</div>}
                            {customer.address && <div className="text-sm">Address: {customer.address}</div>}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent value="new" className="mt-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerName">Name</Label>
                      <Input
                        id="customerName"
                        placeholder="Customer name"
                        value={newCustomer.name || ""}
                        onChange={(e) =>
                          setNewCustomer({ ...newCustomer, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerPhone">Phone</Label>
                      <Input
                        id="customerPhone"
                        placeholder="e.g., 0306-2228391"
                        value={phoneInput}
                        onChange={handlePhoneChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerAddress">Address</Label>
                      <Input
                        id="customerAddress"
                        placeholder="Customer address"
                        value={newCustomer.address || ""}
                        onChange={(e) =>
                          setNewCustomer({ ...newCustomer, address: e.target.value })
                        }
                      />
                    </div>
                    <Button
                      onClick={handleCreateCustomer}
                      disabled={createCustomerMutation.isPending}
                      className="w-full"
                    >
                      <PlusCircle size={16} className="mr-2" />
                      {createCustomerMutation.isPending ? "Creating..." : "Create Customer"}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
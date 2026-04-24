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
import { useAuth } from "@/contexts/AuthContext";
import type { Vendor, InsertVendor } from "@shared/schema";
import { PlusCircle, Search, Building2 } from "lucide-react";

interface VendorSelectionProps {
  selectedVendor: Vendor | null;
  onSelectVendor: (vendor: Vendor) => void;
  onClearVendor: () => void;
}

export function VendorSelection({
  selectedVendor,
  onSelectVendor,
  onClearVendor,
}: VendorSelectionProps) {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [newVendor, setNewVendor] = useState<Partial<InsertVendor>>({
    name: "",
    phone: "",
    email: "",
    address: "",
    companyId: user?.companyId ?? 0,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: vendorsResponse, isLoading } = useQuery({
    queryKey: ["/api/vendors", user?.companyId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (user?.companyId) params.set("companyId", String(user.companyId));
      const response = await apiRequest("GET", `/api/vendors?${params.toString()}`);
      const data = await response.json();
      return data as Vendor[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const allVendors = Array.isArray(vendorsResponse) ? vendorsResponse : [];
  // Client-side filtering since backend doesn't support ?search= on vendors
  const vendors = searchTerm
    ? allVendors.filter(v =>
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.phone || "").includes(searchTerm) ||
        (v.address || "").toLowerCase().includes(searchTerm.toLowerCase())
      )
    : allVendors;

  const createVendorMutation = useMutation({
    mutationFn: async (vendor: InsertVendor) => {
      const response = await apiRequest("POST", "/api/vendors", vendor);
      const data = await response.json();
      return data as Vendor;
    },
    onSuccess: (createdVendor) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      toast({
        title: "Vendor created",
        description: `${createdVendor.name} has been added to the database`,
      });
      onSelectVendor(createdVendor);
      setOpenDialog(false);
      setNewVendor({ name: "", phone: "", email: "", address: "", companyId: user?.companyId ?? 0 });
    },
    onError: (error) => {
      toast({
        title: "Error creating vendor",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateVendor = () => {
    if (!newVendor.name) {
      toast({
        title: "Missing information",
        description: "Vendor name is required",
        variant: "destructive",
      });
      return;
    }
    createVendorMutation.mutate({
      ...newVendor,
      name: newVendor.name!,
      companyId: user?.companyId ?? 0,
      active: true,
    } as InsertVendor);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="vendorSelect" className="text-sm font-medium">
          Vendor / Supplier
        </Label>
        {selectedVendor ? (
          <div className="flex w-full items-center gap-2">
            <div className="rounded-lg border p-2 text-sm flex-grow">
              <div className="font-semibold">{selectedVendor.name}</div>
              {selectedVendor.phone && <div>Phone: {selectedVendor.phone}</div>}
              {selectedVendor.address && <div>Address: {selectedVendor.address}</div>}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearVendor}
              className="flex-shrink-0"
            >
              Change
            </Button>
          </div>
        ) : (
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span>Select a vendor</span>
                <Building2 size={16} />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Vendor / Supplier Selection</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="search">
                <TabsList className="w-full">
                  <TabsTrigger value="search" className="flex-1">Search Existing</TabsTrigger>
                  <TabsTrigger value="new" className="flex-1">Add New</TabsTrigger>
                </TabsList>

                <TabsContent value="search" className="mt-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <Input
                      placeholder="Search vendors..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="flex-1"
                    />
                    <Button variant="secondary" size="icon">
                      <Search size={16} />
                    </Button>
                  </div>

                  {isLoading ? (
                    <div className="py-8 text-center">Loading vendors...</div>
                  ) : vendors.length === 0 ? (
                    <div className="py-8 text-center">
                      <p>No vendors found.</p>
                      <Button
                        variant="link"
                        onClick={() => {
                          const newTabBtn = document.querySelector('[data-value="new"]') as HTMLElement;
                          if (newTabBtn) newTabBtn.click();
                        }}
                      >
                        Add a new vendor
                      </Button>
                    </div>
                  ) : (
                    <ScrollArea className="h-72">
                      <div className="space-y-2">
                        {vendors.map((vendor) => (
                          <div
                            key={vendor.id}
                            className="rounded-lg border p-3 cursor-pointer hover:bg-muted transition-colors"
                            onClick={() => {
                              onSelectVendor(vendor);
                              setOpenDialog(false);
                            }}
                          >
                            <div className="font-semibold">{vendor.name}</div>
                            {vendor.phone && <div className="text-sm">Phone: {vendor.phone}</div>}
                            {vendor.address && <div className="text-sm">Address: {vendor.address}</div>}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent value="new" className="mt-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="vendorName">Name <span className="text-red-500">*</span></Label>
                      <Input
                        id="vendorName"
                        placeholder="Vendor / supplier name"
                        value={newVendor.name || ""}
                        onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vendorPhone">Phone</Label>
                      <Input
                        id="vendorPhone"
                        placeholder="e.g., 021-35641234"
                        value={newVendor.phone || ""}
                        onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vendorEmail">Email</Label>
                      <Input
                        id="vendorEmail"
                        type="email"
                        placeholder="vendor@example.com"
                        value={newVendor.email || ""}
                        onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vendorAddress">Address</Label>
                      <Input
                        id="vendorAddress"
                        placeholder="Vendor address"
                        value={newVendor.address || ""}
                        onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                      />
                    </div>
                    <Button
                      onClick={handleCreateVendor}
                      disabled={createVendorMutation.isPending}
                      className="w-full"
                    >
                      <PlusCircle size={16} className="mr-2" />
                      {createVendorMutation.isPending ? "Creating..." : "Create Vendor"}
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

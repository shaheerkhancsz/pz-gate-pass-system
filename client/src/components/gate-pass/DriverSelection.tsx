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
import type { Driver, InsertDriver } from "@shared/schema";
import { PlusCircle, Search, TruckIcon } from "lucide-react";
import { formatCNIC, validateCNIC } from "@/lib/utils";

interface DriverSelectionProps {
  selectedDriver: Driver | null;
  onSelectDriver: (driver: Driver) => void;
  onClearDriver: () => void;
}

export function DriverSelection({
  selectedDriver,
  onSelectDriver,
  onClearDriver
}: DriverSelectionProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [newDriver, setNewDriver] = useState<Partial<InsertDriver>>({
    name: "",
    mobile: "",
    cnic: "",
    vehicleNumber: ""
  });
  const [cnicInput, setCnicInput] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: driversResponse, isLoading } = useQuery({
    queryKey: ["/api/drivers", searchTerm],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/drivers${searchTerm ? `?search=${searchTerm}` : ""}`);
      const data = await response.json();
      return data as Driver[];
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
  
  // Ensure we have a valid drivers array
  const drivers = Array.isArray(driversResponse) ? driversResponse : [];

  const createDriverMutation = useMutation({
    mutationFn: async (newDriver: InsertDriver) => {
      const response = await apiRequest("POST", "/api/drivers", newDriver);
      const data = await response.json();
      return data as Driver;
    },
    onSuccess: (createdDriver) => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({
        title: "Driver created",
        description: `${createdDriver.name} has been added to the database`,
        variant: "default"
      });
      onSelectDriver(createdDriver);
      setOpenDialog(false);
      setNewDriver({
        name: "",
        mobile: "",
        cnic: "",
        vehicleNumber: ""
      });
      setCnicInput("");
    },
    onError: (error) => {
      toast({
        title: "Error creating driver",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleCreateDriver = () => {
    if (!newDriver.name || !newDriver.mobile || !newDriver.cnic) {
      toast({
        title: "Missing information",
        description: "Driver name, mobile, and CNIC are required",
        variant: "destructive"
      });
      return;
    }

    if (!validateCNIC(newDriver.cnic)) {
      toast({
        title: "Invalid CNIC",
        description: "Please enter a valid CNIC number (e.g., 42201-1234567-8)",
        variant: "destructive"
      });
      return;
    }

    createDriverMutation.mutate(newDriver as InsertDriver);
  };

  const handleCnicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCnicInput(value);
    const formattedCnic = formatCNIC(value);
    setNewDriver({ ...newDriver, cnic: formattedCnic });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="driverSelect" className="text-sm font-medium">
          Driver
        </Label>
        {selectedDriver ? (
          <div className="flex w-full items-center gap-2">
            <div className="rounded-lg border p-2 text-sm flex-grow">
              <div className="font-semibold">{selectedDriver.name}</div>
              <div>Mobile: {selectedDriver.mobile}</div>
              <div>CNIC: {selectedDriver.cnic}</div>
              {selectedDriver.vehicleNumber && <div>Vehicle: {selectedDriver.vehicleNumber}</div>}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearDriver}
              className="flex-shrink-0"
            >
              Change
            </Button>
          </div>
        ) : (
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span>Select a driver</span>
                <TruckIcon size={16} />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Driver Selection</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="search">
                <TabsList className="w-full">
                  <TabsTrigger value="search" className="flex-1">Search Existing</TabsTrigger>
                  <TabsTrigger value="new" className="flex-1">Add New</TabsTrigger>
                </TabsList>
                
                <TabsContent value="search" className="mt-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <Input
                      placeholder="Search by name, CNIC, or mobile..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="flex-1"
                    />
                    <Button variant="secondary" size="icon">
                      <Search size={16} />
                    </Button>
                  </div>

                  {isLoading ? (
                    <div className="py-8 text-center">Loading drivers...</div>
                  ) : drivers.length === 0 ? (
                    <div className="py-8 text-center">
                      <p>No drivers found.</p>
                      <Button 
                        variant="link" 
                        onClick={() => {
                          // Find the new tab trigger and switch to it
                          const newTabBtn = document.querySelector('[data-value="new"]') as HTMLElement;
                          if (newTabBtn) newTabBtn.click();
                        }}
                      >
                        Add a new driver
                      </Button>
                    </div>
                  ) : (
                    <ScrollArea className="h-72">
                      <div className="space-y-2">
                        {drivers.map((driver) => (
                          <div
                            key={driver.id}
                            className="rounded-lg border p-3 cursor-pointer hover:bg-muted transition-colors"
                            onClick={() => {
                              onSelectDriver(driver);
                              setOpenDialog(false);
                            }}
                          >
                            <div className="font-semibold">{driver.name}</div>
                            <div className="text-sm">Mobile: {driver.mobile}</div>
                            <div className="text-sm">CNIC: {driver.cnic}</div>
                            {driver.vehicleNumber && (
                              <div className="text-sm">Vehicle: {driver.vehicleNumber}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent value="new" className="mt-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="driverName">Name</Label>
                      <Input
                        id="driverName"
                        placeholder="Driver name"
                        value={newDriver.name || ""}
                        onChange={(e) =>
                          setNewDriver({ ...newDriver, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="driverMobile">Mobile</Label>
                      <Input
                        id="driverMobile"
                        placeholder="03xx-xxxxxxx"
                        value={newDriver.mobile || ""}
                        onChange={(e) =>
                          setNewDriver({ ...newDriver, mobile: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="driverCnic">CNIC</Label>
                      <Input
                        id="driverCnic"
                        placeholder="xxxxx-xxxxxxx-x"
                        value={cnicInput}
                        onChange={handleCnicChange}
                      />
                      {newDriver.cnic && !validateCNIC(newDriver.cnic) && (
                        <p className="text-sm text-red-500">
                          Please enter a valid CNIC number (e.g., 42201-1234567-8)
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vehicleNumber">Vehicle Number</Label>
                      <Input
                        id="vehicleNumber"
                        placeholder="Vehicle registration number"
                        value={newDriver.vehicleNumber || ""}
                        onChange={(e) =>
                          setNewDriver({ ...newDriver, vehicleNumber: e.target.value })
                        }
                      />
                    </div>
                    <Button
                      onClick={handleCreateDriver}
                      disabled={createDriverMutation.isPending}
                      className="w-full"
                    >
                      <PlusCircle size={16} className="mr-2" />
                      {createDriverMutation.isPending ? "Creating..." : "Create Driver"}
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
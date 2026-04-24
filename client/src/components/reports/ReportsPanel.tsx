import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { GatePass, Item } from "@shared/schema";
import { useDepartments } from "@/hooks/use-departments";
import { formatDate } from "@/lib/utils";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
// Import this way to properly load the autoTable plugin
import autoTable from 'jspdf-autotable';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pending",
    hod_approved: "HOD Approved",
    security_allowed: "Security Allowed",
    completed: "Completed",
    rejected: "Rejected",
    sent_back: "Sent Back",
  };
  return labels[status] || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "completed": return "bg-success bg-opacity-10 text-success";
    case "pending": return "bg-warning bg-opacity-10 text-warning";
    case "hod_approved": return "bg-blue-100 text-blue-700";
    case "security_allowed": return "bg-purple-100 text-purple-700";
    case "rejected": return "bg-red-100 text-red-700";
    case "sent_back": return "bg-orange-100 text-orange-700";
    default: return "bg-info bg-opacity-10 text-info";
  }
}

interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  customerName: string;
  department: string;
  driverName: string;
  itemName: string;
  status: string;
  type: string;
  companyId: string;
  createdBy: string;
  vehicleNumber: string;
  sortBy: string;
  sortOrder: string;
  limit: number;
}

export function ReportsPanel() {
  const tableRef = useRef<HTMLTableElement>(null);
  const isMobile = useIsMobile();
  const { isAdmin } = useAuth();
  const { data: departments = [] } = useDepartments();
  const { data: companies = [] } = useQuery<{ id: number; name: string; shortName: string | null; active: boolean }[]>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const response = await fetch("/api/companies");
      if (!response.ok) throw new Error("Failed to fetch companies");
      return response.json();
    },
    enabled: isAdmin,
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState({
    gatePassNumber: true,
    date: true,
    type: true,
    customer: true,
    department: true,
    driver: true,
    status: true,
    createdBy: true,
    items: false,
    vehicle: false,
    notes: false,
    driverMobile: false,
    customerPhone: false,
    deliveryAddress: false
  });

  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: "",
    dateTo: "",
    customerName: "",
    department: "",
    driverName: "",
    itemName: "",
    status: "",
    type: "",
    companyId: "",
    createdBy: "",
    vehicleNumber: "",
    sortBy: "date",
    sortOrder: "desc",
    limit: 100
  });

  // Build query parameters from filters
  const getQueryString = () => {
    const queryParams = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        queryParams.append(key, value);
      }
    });

    return queryParams.toString();
  };

  // Fetch all gate passes on initial load and apply filters when requested
  const { data: gatePasses, isLoading, refetch } = useQuery<(GatePass & { items: Item[] })[]>({
    queryKey: ['/api/gate-passes', getQueryString()],
    // Always fetch all gate passes by default (empty filter)
    queryFn: async () => {
      const url = getQueryString() ? `/api/gate-passes?${getQueryString()}` : '/api/gate-passes';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch gate passes');
      return response.json();
    }
  });

  // State to hold the selected gate pass for displaying detailed information
  const [selectedGatePass, setSelectedGatePass] = useState<(GatePass & { items: Item[] }) | null>(null);

  // Load all gate passes initially
  useEffect(() => {
    refetch();
  }, []);

  // Handle filter change
  const handleFilterChange = (key: keyof ReportFilters, value: string) => {
    // If select-based filters are set to "all", treat as empty string for API filtering
    if (value === "all") {
      setFilters({ ...filters, [key]: "" });
    } else {
      setFilters({ ...filters, [key]: value });
    }
  };

  // Apply filters
  const applyFilters = () => {
    refetch();
  };

  // Export to Excel with detailed information including items
  const exportToExcel = () => {
    if (!gatePasses || gatePasses.length === 0) return;

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Create main gate passes worksheet
    const mainWorksheet = XLSX.utils.json_to_sheet(
      gatePasses.map(pass => ({
        "Gate Pass No.": pass.gatePassNumber,
        "Date": formatDate(pass.date),
        "Type": ((pass as any).type || "outward").charAt(0).toUpperCase() + ((pass as any).type || "outward").slice(1),
        "Customer": pass.customerName,
        "Customer Phone": pass.customerPhone || "-",
        "Delivery Address": pass.deliveryAddress || "-",
        "Department": pass.department,
        "Driver Name": pass.driverName,
        "Driver Mobile": pass.driverMobile,
        "Vehicle Number": pass.deliveryVanNumber,
        "Status": getStatusLabel(pass.status),
        "Created By": pass.createdBy,
        "Created Date": formatDate(pass.createdAt),
        "Notes": pass.notes || "-"
      }))
    );

    // Add main worksheet
    XLSX.utils.book_append_sheet(workbook, mainWorksheet, "Gate Passes");

    // Create items worksheet with reference to gate pass numbers
    const itemsData: any[] = [];
    gatePasses.forEach(pass => {
      if (pass.items && pass.items.length > 0) {
        pass.items.forEach(item => {
          itemsData.push({
            "Gate Pass No.": pass.gatePassNumber,
            "Customer": pass.customerName,
            "Date": formatDate(pass.date),
            "Item Name": item.name,
            "SKU": item.sku,
            "Quantity": item.quantity
          });
        });
      }
    });

    if (itemsData.length > 0) {
      const itemsWorksheet = XLSX.utils.json_to_sheet(itemsData);
      XLSX.utils.book_append_sheet(workbook, itemsWorksheet, "Items");
    }

    // Generate Excel file
    XLSX.writeFile(workbook, `GatePass_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export to PDF with detailed information including items
  const exportToPDF = () => {
    if (!gatePasses || gatePasses.length === 0) return;

    // Create PDF document
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(18);
    doc.text("Gate Pass Report", 14, 22);

    // Add report info
    doc.setFontSize(11);
    doc.text(`Generated on: ${formatDate(new Date())}`, 14, 30);

    // Add filters applied
    let filterText = "Filters: ";
    if (filters.dateFrom) filterText += `From ${filters.dateFrom} `;
    if (filters.dateTo) filterText += `To ${filters.dateTo} `;
    if (filters.type) filterText += `Type: ${filters.type} `;
    if (filters.department) filterText += `Department: ${filters.department} `;
    if (filters.customerName) filterText += `Customer: ${filters.customerName} `;
    if (filters.driverName) filterText += `Driver: ${filters.driverName} `;
    if (filters.itemName) filterText += `Item: ${filters.itemName} `;
    if (filters.status) filterText += `Status: ${getStatusLabel(filters.status)} `;

    doc.text(filterText, 14, 38);

    // Create main gate passes table
    const tableColumn = ["Gate Pass No.", "Date", "Type", "Customer", "Department", "Driver Name", "Status"];
    const tableRows = gatePasses.map(pass => [
      pass.gatePassNumber,
      formatDate(pass.date),
      ((pass as any).type || "outward").charAt(0).toUpperCase() + ((pass as any).type || "outward").slice(1),
      pass.customerName,
      pass.department,
      pass.driverName,
      getStatusLabel(pass.status),
    ]);

    // @ts-ignore - jsPDF autotable types are not fully compatible
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [63, 81, 181], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    // Add detailed information for each gate pass
    let yPosition = (doc as any).lastAutoTable.finalY + 15;

    gatePasses.forEach((pass, index) => {
      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      // Gate pass header
      doc.setFontSize(12);
      doc.setTextColor(63, 81, 181);
      doc.text(`Gate Pass: ${pass.gatePassNumber}`, 14, yPosition);
      yPosition += 8;

      // Gate pass details
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);

      const detailsTable = [
        ["Customer", pass.customerName],
        ["Phone", pass.customerPhone || "-"],
        ["Address", pass.deliveryAddress || "-"],
        ["Department", pass.department],
        ["Driver", pass.driverName],
        ["Driver Mobile", pass.driverMobile],
        ["Vehicle", pass.deliveryVanNumber],
        ["Status", pass.status],
        ["Date", formatDate(pass.date)],
        ["Created By", pass.createdBy]
      ];

      // @ts-ignore
      autoTable(doc, {
        body: detailsTable,
        startY: yPosition,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
        margin: { left: 20 },
      });

      // Update Y position
      yPosition = (doc as any).lastAutoTable.finalY + 10;

      // Add items table if available
      if (pass.items && pass.items.length > 0) {
        // Check if we need a new page
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(10);
        doc.setTextColor(63, 81, 181);
        doc.text(`Items for Gate Pass: ${pass.gatePassNumber}`, 14, yPosition);
        yPosition += 6;

        // Items table
        const itemsColumn = ["Item Name", "SKU", "Quantity"];
        const itemsRows = pass.items.map(item => [
          item.name,
          item.sku,
          item.quantity.toString(),
        ]);

        // @ts-ignore
        autoTable(doc, {
          head: [itemsColumn],
          body: itemsRows,
          startY: yPosition,
          theme: 'striped',
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [100, 100, 100], textColor: [255, 255, 255] },
          margin: { left: 20 },
        });

        // Update Y position
        yPosition = (doc as any).lastAutoTable.finalY + 20;
      } else {
        yPosition += 10;
      }

      // Add separator between gate passes (except for the last one)
      if (index < gatePasses.length - 1) {
        doc.setDrawColor(200, 200, 200);
        doc.line(14, yPosition - 10, 196, yPosition - 10);
      }
    });

    // Save PDF
    doc.save(`GatePass_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <Card className="bg-white rounded-lg shadow-sm">
      <CardHeader className="p-6 border-b border-neutral-medium">
        <CardTitle className="font-medium">Gate Pass Reports</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {/* Basic Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <Label htmlFor="dateFrom">From Date</Label>
            <Input
              id="dateFrom"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="dateTo">To Date</Label>
            <Input
              id="dateTo"
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange("dateTo", e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="department">Department</Label>
            <Select
              value={filters.department}
              onValueChange={(value) => handleFilterChange("department", value)}
            >
              <SelectTrigger id="department" className="mt-1">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.name}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="customerName">Customer Name</Label>
            <Input
              id="customerName"
              value={filters.customerName}
              onChange={(e) => handleFilterChange("customerName", e.target.value)}
              placeholder="Enter customer name"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="driverName">Driver Name</Label>
            <Input
              id="driverName"
              value={filters.driverName}
              onChange={(e) => handleFilterChange("driverName", e.target.value)}
              placeholder="Enter driver name"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="itemName">Item Name</Label>
            <Input
              id="itemName"
              value={filters.itemName}
              onChange={(e) => handleFilterChange("itemName", e.target.value)}
              placeholder="Enter item name"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="type">Gate Pass Type</Label>
            <Select
              value={filters.type || "all"}
              onValueChange={(value) => handleFilterChange("type", value)}
            >
              <SelectTrigger id="type" className="mt-1">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="outward">Outward</SelectItem>
                <SelectItem value="inward">Inward</SelectItem>
                <SelectItem value="returnable">Returnable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isAdmin && (
            <div>
              <Label htmlFor="companyId">Company</Label>
              <Select
                value={filters.companyId || "all"}
                onValueChange={(value) => handleFilterChange("companyId", value)}
              >
                <SelectTrigger id="companyId" className="mt-1">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.filter(c => c.active !== false).map((company) => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.name} {company.shortName ? `(${company.shortName})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Advanced Filters Toggle */}
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="text-sm"
          >
            <span className="material-icons mr-2 text-sm">{showAdvancedFilters ? "expand_less" : "expand_more"}</span>
            {showAdvancedFilters ? "Hide Advanced Options" : "Show Advanced Options"}
          </Button>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="mb-6">
            <Accordion type="single" collapsible defaultValue="advanced-filters">
              <AccordionItem value="advanced-filters">
                <AccordionTrigger className="py-3 text-sm font-medium">Advanced Filters</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={filters.status}
                        onValueChange={(value) => handleFilterChange("status", value)}
                      >
                        <SelectTrigger id="status" className="mt-1">
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="hod_approved">HOD Approved</SelectItem>
                          <SelectItem value="security_allowed">Security Allowed</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="sent_back">Sent Back</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="createdBy">Created By</Label>
                      <Input
                        id="createdBy"
                        value={filters.createdBy}
                        onChange={(e) => handleFilterChange("createdBy", e.target.value)}
                        placeholder="Enter user email"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="vehicleNumber">Vehicle Number</Label>
                      <Input
                        id="vehicleNumber"
                        value={filters.vehicleNumber}
                        onChange={(e) => handleFilterChange("vehicleNumber", e.target.value)}
                        placeholder="Enter vehicle number"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="sortBy">Sort By</Label>
                      <Select
                        value={filters.sortBy}
                        onValueChange={(value) => handleFilterChange("sortBy", value)}
                      >
                        <SelectTrigger id="sortBy" className="mt-1">
                          <SelectValue placeholder="Sort By" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="gatePassNumber">Gate Pass Number</SelectItem>
                          <SelectItem value="customerName">Customer Name</SelectItem>
                          <SelectItem value="department">Department</SelectItem>
                          <SelectItem value="status">Status</SelectItem>
                          <SelectItem value="createdAt">Created Date</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="sortOrder">Sort Order</Label>
                      <Select
                        value={filters.sortOrder}
                        onValueChange={(value) => handleFilterChange("sortOrder", value)}
                      >
                        <SelectTrigger id="sortOrder" className="mt-1">
                          <SelectValue placeholder="Sort Order" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="asc">Ascending</SelectItem>
                          <SelectItem value="desc">Descending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="limit">Limit Results</Label>
                      <Select
                        value={filters.limit.toString()}
                        onValueChange={(value) => handleFilterChange("limit", value)}
                      >
                        <SelectTrigger id="limit" className="mt-1">
                          <SelectValue placeholder="Limit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="25">25 records</SelectItem>
                          <SelectItem value="50">50 records</SelectItem>
                          <SelectItem value="100">100 records</SelectItem>
                          <SelectItem value="250">250 records</SelectItem>
                          <SelectItem value="500">500 records</SelectItem>
                          <SelectItem value="1000">1000 records</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="column-selection">
                <AccordionTrigger className="py-3 text-sm font-medium">Column Selection</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="col-gatepass"
                        checked={selectedColumns.gatePassNumber}
                        onCheckedChange={() =>
                          setSelectedColumns({ ...selectedColumns, gatePassNumber: !selectedColumns.gatePassNumber })
                        }
                      />
                      <Label htmlFor="col-gatepass" className="text-sm">Gate Pass Number</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="col-date"
                        checked={selectedColumns.date}
                        onCheckedChange={() =>
                          setSelectedColumns({ ...selectedColumns, date: !selectedColumns.date })
                        }
                      />
                      <Label htmlFor="col-date" className="text-sm">Date</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="col-customer"
                        checked={selectedColumns.customer}
                        onCheckedChange={() =>
                          setSelectedColumns({ ...selectedColumns, customer: !selectedColumns.customer })
                        }
                      />
                      <Label htmlFor="col-customer" className="text-sm">Customer</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="col-department"
                        checked={selectedColumns.department}
                        onCheckedChange={() =>
                          setSelectedColumns({ ...selectedColumns, department: !selectedColumns.department })
                        }
                      />
                      <Label htmlFor="col-department" className="text-sm">Department</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="col-driver"
                        checked={selectedColumns.driver}
                        onCheckedChange={() =>
                          setSelectedColumns({ ...selectedColumns, driver: !selectedColumns.driver })
                        }
                      />
                      <Label htmlFor="col-driver" className="text-sm">Driver</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="col-status"
                        checked={selectedColumns.status}
                        onCheckedChange={() =>
                          setSelectedColumns({ ...selectedColumns, status: !selectedColumns.status })
                        }
                      />
                      <Label htmlFor="col-status" className="text-sm">Status</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="col-created-by"
                        checked={selectedColumns.createdBy}
                        onCheckedChange={() =>
                          setSelectedColumns({ ...selectedColumns, createdBy: !selectedColumns.createdBy })
                        }
                      />
                      <Label htmlFor="col-created-by" className="text-sm">Created By</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="col-items"
                        checked={selectedColumns.items}
                        onCheckedChange={() =>
                          setSelectedColumns({ ...selectedColumns, items: !selectedColumns.items })
                        }
                      />
                      <Label htmlFor="col-items" className="text-sm">Items</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="col-vehicle"
                        checked={selectedColumns.vehicle}
                        onCheckedChange={() =>
                          setSelectedColumns({ ...selectedColumns, vehicle: !selectedColumns.vehicle })
                        }
                      />
                      <Label htmlFor="col-vehicle" className="text-sm">Vehicle</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="col-notes"
                        checked={selectedColumns.notes}
                        onCheckedChange={() =>
                          setSelectedColumns({ ...selectedColumns, notes: !selectedColumns.notes })
                        }
                      />
                      <Label htmlFor="col-notes" className="text-sm">Notes</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="col-type"
                        checked={selectedColumns.type}
                        onCheckedChange={() =>
                          setSelectedColumns({ ...selectedColumns, type: !selectedColumns.type })
                        }
                      />
                      <Label htmlFor="col-type" className="text-sm">Type</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="col-driver-mobile"
                        checked={selectedColumns.driverMobile}
                        onCheckedChange={() =>
                          setSelectedColumns({ ...selectedColumns, driverMobile: !selectedColumns.driverMobile })
                        }
                      />
                      <Label htmlFor="col-driver-mobile" className="text-sm">Driver Mobile</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="col-customer-phone"
                        checked={selectedColumns.customerPhone}
                        onCheckedChange={() =>
                          setSelectedColumns({ ...selectedColumns, customerPhone: !selectedColumns.customerPhone })
                        }
                      />
                      <Label htmlFor="col-customer-phone" className="text-sm">Customer Phone</Label>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}

        {/* Applied Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(filters).map(([key, value]) => {
            if (value && key !== 'limit' && key !== 'sortBy' && key !== 'sortOrder') {
              return (
                <Badge key={key} variant="outline" className="gap-1 px-2 py-1">
                  <span className="text-xs capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}: {value}</span>
                  <button
                    className="text-xs ml-1 hover:text-destructive"
                    onClick={() => handleFilterChange(key as keyof ReportFilters, '')}
                  >
                    <span className="material-icons text-xs">close</span>
                  </button>
                </Badge>
              );
            }
            return null;
          })}
        </div>

        <div className="flex flex-col md:flex-row md:justify-between gap-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={applyFilters}
              className="h-9"
            >
              <span className="material-icons mr-2 text-sm">filter_list</span>
              {isMobile ? "Apply" : "Apply Filters"}
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setFilters({
                  dateFrom: "",
                  dateTo: "",
                  customerName: "",
                  department: "",
                  driverName: "",
                  itemName: "",
                  status: "",
                  type: "",
                  companyId: "",
                  createdBy: "",
                  vehicleNumber: "",
                  sortBy: "date",
                  sortOrder: "desc",
                  limit: 100
                });
                setTimeout(applyFilters, 0);
              }}
              className="h-9"
            >
              <span className="material-icons mr-2 text-sm">refresh</span>
              {isMobile ? "Reset" : "Reset Filters"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={exportToExcel}
              disabled={!gatePasses || gatePasses.length === 0}
              className="h-9"
            >
              <span className="material-icons mr-2 text-sm">description</span>
              {isMobile ? "Excel" : "Export to Excel"}
            </Button>

            <Button
              variant="outline"
              onClick={exportToPDF}
              disabled={!gatePasses || gatePasses.length === 0}
              className="h-9"
            >
              <span className="material-icons mr-2 text-sm">picture_as_pdf</span>
              {isMobile ? "PDF" : "Export to PDF"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-10">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2">Loading report data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table ref={tableRef} className="w-full whitespace-nowrap">
              <thead>
                <tr className="bg-neutral-light">
                  {selectedColumns.gatePassNumber && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Gate Pass No.</th>
                  )}
                  {selectedColumns.date && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Date</th>
                  )}
                  {selectedColumns.type && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Type</th>
                  )}
                  {selectedColumns.customer && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Customer</th>
                  )}
                  {selectedColumns.customerPhone && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Customer Phone</th>
                  )}
                  {selectedColumns.department && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Department</th>
                  )}
                  {selectedColumns.driver && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Driver Name</th>
                  )}
                  {selectedColumns.driverMobile && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Driver Mobile</th>
                  )}
                  {selectedColumns.vehicle && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Vehicle</th>
                  )}
                  {selectedColumns.status && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Status</th>
                  )}
                  {selectedColumns.createdBy && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Created By</th>
                  )}
                  {selectedColumns.items && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Items</th>
                  )}
                  {selectedColumns.notes && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Notes</th>
                  )}
                  {selectedColumns.deliveryAddress && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Delivery Address</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-medium bg-white">
                {gatePasses && gatePasses.length > 0 ? (
                  gatePasses.map((pass) => (
                    <React.Fragment key={pass.id}>
                      <tr
                        className="hover:bg-neutral-lightest cursor-pointer"
                        onClick={() => setSelectedGatePass(selectedGatePass?.id === pass.id ? null : pass)}
                      >
                        {selectedColumns.gatePassNumber && (
                          <td className="px-6 py-4 text-sm font-medium">{pass.gatePassNumber}</td>
                        )}
                        {selectedColumns.date && (
                          <td className="px-6 py-4 text-sm text-neutral-dark">{formatDate(pass.date)}</td>
                        )}
                        {selectedColumns.type && (
                          <td className="px-6 py-4 text-sm text-neutral-dark capitalize">{(pass as any).type || "outward"}</td>
                        )}
                        {selectedColumns.customer && (
                          <td className="px-6 py-4 text-sm text-neutral-dark">{pass.customerName}</td>
                        )}
                        {selectedColumns.customerPhone && (
                          <td className="px-6 py-4 text-sm text-neutral-dark">{pass.customerPhone || "-"}</td>
                        )}
                        {selectedColumns.department && (
                          <td className="px-6 py-4 text-sm text-neutral-dark">{pass.department}</td>
                        )}
                        {selectedColumns.driver && (
                          <td className="px-6 py-4 text-sm text-neutral-dark">{pass.driverName}</td>
                        )}
                        {selectedColumns.driverMobile && (
                          <td className="px-6 py-4 text-sm text-neutral-dark">{pass.driverMobile || "-"}</td>
                        )}
                        {selectedColumns.vehicle && (
                          <td className="px-6 py-4 text-sm text-neutral-dark">{pass.deliveryVanNumber || "-"}</td>
                        )}
                        {selectedColumns.status && (
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(pass.status)}`}>
                              {getStatusLabel(pass.status)}
                            </span>
                          </td>
                        )}
                        {selectedColumns.createdBy && (
                          <td className="px-6 py-4 text-sm text-neutral-dark">{pass.createdBy}</td>
                        )}
                        {selectedColumns.items && (
                          <td className="px-6 py-4 text-sm text-neutral-dark">
                            {pass.items && pass.items.length > 0
                              ? `${pass.items.length} item${pass.items.length > 1 ? 's' : ''}`
                              : "-"}
                          </td>
                        )}
                        {selectedColumns.notes && (
                          <td className="px-6 py-4 text-sm text-neutral-dark">{pass.notes || "-"}</td>
                        )}
                        {selectedColumns.deliveryAddress && (
                          <td className="px-6 py-4 text-sm text-neutral-dark">{pass.deliveryAddress || "-"}</td>
                        )}
                      </tr>

                      {/* Expanded row with detailed information */}
                      {selectedGatePass?.id === pass.id && (
                        <tr>
                          <td colSpan={Object.values(selectedColumns).filter(Boolean).length}
                            className="px-6 py-4 bg-slate-50 border-t border-b border-slate-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                              {/* Gate Pass Details */}
                              <div className="space-y-2">
                                <h4 className="font-medium text-primary text-sm mb-2">Gate Pass Details</h4>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                  {!selectedColumns.gatePassNumber && (
                                    <>
                                      <span className="text-gray-600">Gate Pass Number:</span>
                                      <span>{pass.gatePassNumber}</span>
                                    </>
                                  )}
                                  {!selectedColumns.date && (
                                    <>
                                      <span className="text-gray-600">Date:</span>
                                      <span>{formatDate(pass.date)}</span>
                                    </>
                                  )}
                                  {!selectedColumns.customer && (
                                    <>
                                      <span className="text-gray-600">Customer:</span>
                                      <span>{pass.customerName}</span>
                                    </>
                                  )}
                                  {!selectedColumns.customerPhone && (
                                    <>
                                      <span className="text-gray-600">Customer Phone:</span>
                                      <span>{pass.customerPhone || "-"}</span>
                                    </>
                                  )}
                                  {!selectedColumns.department && (
                                    <>
                                      <span className="text-gray-600">Department:</span>
                                      <span>{pass.department}</span>
                                    </>
                                  )}
                                  {!selectedColumns.deliveryAddress && (
                                    <>
                                      <span className="text-gray-600">Delivery Address:</span>
                                      <span>{pass.deliveryAddress || "-"}</span>
                                    </>
                                  )}
                                  {!selectedColumns.notes && (
                                    <>
                                      <span className="text-gray-600">Notes:</span>
                                      <span>{pass.notes || "-"}</span>
                                    </>
                                  )}
                                  {!selectedColumns.status && (
                                    <>
                                      <span className="text-gray-600">Status:</span>
                                      <span>{pass.status.charAt(0).toUpperCase() + pass.status.slice(1)}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Driver Details */}
                              <div className="space-y-2">
                                <h4 className="font-medium text-primary text-sm mb-2">Driver Details</h4>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                  {!selectedColumns.driver && (
                                    <>
                                      <span className="text-gray-600">Name:</span>
                                      <span>{pass.driverName}</span>
                                    </>
                                  )}
                                  {!selectedColumns.driverMobile && (
                                    <>
                                      <span className="text-gray-600">Mobile:</span>
                                      <span>{pass.driverMobile || "-"}</span>
                                    </>
                                  )}
                                  <span className="text-gray-600">CNIC:</span>
                                  <span>{pass.driverCnic || "-"}</span>

                                  {!selectedColumns.vehicle && (
                                    <>
                                      <span className="text-gray-600">Vehicle Number:</span>
                                      <span>{pass.deliveryVanNumber || "-"}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Items Table */}
                            {!selectedColumns.items && pass.items && pass.items.length > 0 ? (
                              <div>
                                <h4 className="font-medium text-primary text-sm mb-2">Items</h4>
                                <div className="overflow-x-auto">
                                  <table className="min-w-full border border-slate-200 mb-2">
                                    <thead className="bg-slate-100">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Item Name</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Quantity</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                      {pass.items.map((item, index) => (
                                        <tr key={index} className="border-t border-slate-200">
                                          <td className="px-4 py-2 text-sm">{item.name}</td>
                                          <td className="px-4 py-2 text-sm">{item.sku}</td>
                                          <td className="px-4 py-2 text-sm">{item.quantity}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50">
                                      <tr className="border-t border-slate-200">
                                        <td colSpan={2} className="px-4 py-2 text-right text-sm font-medium">Total Quantity:</td>
                                        <td className="px-4 py-2 text-sm font-medium">
                                          {pass.items.reduce((sum, item) => sum + item.quantity, 0)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>
                            ) : (
                              selectedColumns.items ? null : (
                                <div className="text-sm text-gray-500 italic">No items found for this gate pass</div>
                              )
                            )}

                            {/* Additional actions */}
                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(`/print-gate-pass/${pass.id}`, '_blank')}
                              >
                                <span className="material-icons text-sm mr-2">print</span>
                                Print Gate Pass
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(`/view-gate-pass/${pass.id}`, '_blank')}
                              >
                                <span className="material-icons text-sm mr-2">visibility</span>
                                View Details
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(`/edit-gate-pass/${pass.id}`, '_blank')}
                              >
                                <span className="material-icons text-sm mr-2">edit</span>
                                Edit
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan={Object.values(selectedColumns).filter(Boolean).length || 1}
                      className="px-6 py-10 text-center text-sm text-neutral-gray">
                      No gate passes found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {gatePasses && gatePasses.length > 0 && (
              <div className="mt-4 text-sm text-neutral-gray text-right">
                Total: {gatePasses.length} gate passes
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

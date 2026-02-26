import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { useDepartments } from "@/hooks/use-departments";
import { formatDate } from "@/lib/utils";

// Define the form schema
const reportFormSchema = z.object({
  name: z.string().min(1, "Report name is required"),
  description: z.string().optional(),
  filters: z.object({
    dateRange: z.object({
      enabled: z.boolean().default(true),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }),
    customer: z.object({
      enabled: z.boolean().default(false),
      value: z.string().optional(),
    }),
    department: z.object({
      enabled: z.boolean().default(false),
      value: z.string().optional(),
    }),
    driver: z.object({
      enabled: z.boolean().default(false),
      value: z.string().optional(),
    }),
    status: z.object({
      enabled: z.boolean().default(false),
      value: z.string().optional(),
    }),
    item: z.object({
      enabled: z.boolean().default(false),
      value: z.string().optional(),
    }),
  }),
  columns: z.object({
    gatePassNumber: z.boolean().default(true),
    date: z.boolean().default(true),
    customer: z.boolean().default(true),
    department: z.boolean().default(true),
    driver: z.boolean().default(true),
    vehicle: z.boolean().default(false),
    items: z.boolean().default(false),
    status: z.boolean().default(true),
    createdBy: z.boolean().default(false),
    createdAt: z.boolean().default(false),
    notes: z.boolean().default(false),
  }),
  groupBy: z.enum(["none", "customer", "department", "driver", "status", "date"]).default("none"),
  sortBy: z.enum(["date", "gatePassNumber", "customer", "department", "status"]).default("date"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

type ReportFormValues = z.infer<typeof reportFormSchema>;

export function CustomReportBuilder() {
  const [reportTab, setReportTab] = useState("design");
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isMobile = useIsMobile();
  const { data: departments = [] } = useDepartments();

  // Initialize form with default values
  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      name: "",
      description: "",
      filters: {
        dateRange: { enabled: true, dateFrom: "", dateTo: "" },
        customer: { enabled: false, value: "" },
        department: { enabled: false, value: "" },
        driver: { enabled: false, value: "" },
        status: { enabled: false, value: "" },
        item: { enabled: false, value: "" },
      },
      columns: {
        gatePassNumber: true,
        date: true,
        customer: true,
        department: true,
        driver: true,
        vehicle: false,
        items: false,
        status: true,
        createdBy: false,
        createdAt: false,
        notes: false,
      },
      groupBy: "none",
      sortBy: "date",
      sortOrder: "desc",
    },
  });

  // Preview the report
  const previewReport = async (values: ReportFormValues) => {
    try {
      setIsLoading(true);

      // Build the query parameters
      const queryParams = new URLSearchParams();

      // Add filters
      if (values.filters.dateRange.enabled) {
        if (values.filters.dateRange.dateFrom) {
          queryParams.append("dateFrom", values.filters.dateRange.dateFrom);
        }
        if (values.filters.dateRange.dateTo) {
          queryParams.append("dateTo", values.filters.dateRange.dateTo);
        }
      }

      if (values.filters.customer.enabled && values.filters.customer.value) {
        queryParams.append("customerName", values.filters.customer.value);
      }

      if (values.filters.department.enabled && values.filters.department.value) {
        queryParams.append("department", values.filters.department.value);
      }

      if (values.filters.driver.enabled && values.filters.driver.value) {
        queryParams.append("driverName", values.filters.driver.value);
      }

      if (values.filters.status.enabled && values.filters.status.value) {
        queryParams.append("status", values.filters.status.value);
      }

      if (values.filters.item.enabled && values.filters.item.value) {
        queryParams.append("itemName", values.filters.item.value);
      }

      // Add sorting
      queryParams.append("sortBy", values.sortBy);
      queryParams.append("sortOrder", values.sortOrder);

      // Fetch data
      const url = queryParams.toString()
        ? `/api/gate-passes?${queryParams.toString()}`
        : '/api/gate-passes';

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch gate passes');

      const data = await response.json();

      // Process data for preview based on selected columns
      const processedData = data.map((pass: any) => {
        const result: any = {};

        if (values.columns.gatePassNumber) result.gatePassNumber = pass.gatePassNumber;
        if (values.columns.date) result.date = formatDate(pass.date);
        if (values.columns.customer) result.customer = pass.customerName;
        if (values.columns.department) result.department = pass.department;
        if (values.columns.driver) result.driver = pass.driverName;
        if (values.columns.vehicle) result.vehicle = pass.deliveryVanNumber;
        if (values.columns.status) result.status = pass.status;
        if (values.columns.createdBy) result.createdBy = pass.createdBy;
        if (values.columns.createdAt) result.createdAt = formatDate(pass.createdAt);
        if (values.columns.notes) result.notes = pass.notes;
        if (values.columns.items) {
          result.items = pass.items ? pass.items.map((item: any) =>
            `${item.name} (${item.quantity})`
          ).join(", ") : "";
        }

        return result;
      });

      // Group data if requested
      let finalData = processedData;
      if (values.groupBy !== "none") {
        // Group by the selected field
        const groups: Record<string, any[]> = {};
        processedData.forEach((item: any) => {
          const key = item[values.groupBy] || 'Unknown';
          if (!groups[key]) groups[key] = [];
          groups[key].push(item);
        });

        // Convert groups to array format with headers
        finalData = [];
        Object.entries(groups).forEach(([key, items]) => {
          finalData.push({
            isGroupHeader: true,
            groupName: key,
            count: items.length
          });
          finalData = [...finalData, ...items];
        });
      }

      setPreviewData(finalData);
      setReportTab("preview");

    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Error generating report",
        description: "There was a problem generating your report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Save the report template
  const saveTemplate = (values: ReportFormValues) => {
    // Get existing templates from localStorage
    const savedTemplates = localStorage.getItem('reportTemplates');
    const templates = savedTemplates ? JSON.parse(savedTemplates) : [];

    // Add new template
    templates.push({
      id: Date.now(),
      ...values,
      createdAt: new Date().toISOString(),
    });

    // Save back to localStorage
    localStorage.setItem('reportTemplates', JSON.stringify(templates));

    toast({
      title: "Report template saved",
      description: "Your report template has been saved for future use.",
    });
  };

  // Export to Excel
  const exportToExcel = () => {
    if (!previewData || previewData.length === 0) return;

    // Filter out group headers
    const dataForExport = previewData.filter((item: any) => !item.isGroupHeader);

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);

    // Add worksheet
    XLSX.utils.book_append_sheet(workbook, worksheet, "Custom Report");

    // Generate Excel file
    XLSX.writeFile(workbook, `Custom_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export to PDF
  const exportToPDF = () => {
    if (!previewData || previewData.length === 0) return;

    // Create PDF document
    const doc = new jsPDF();

    // Add title
    const reportName = form.getValues("name") || "Custom Report";
    doc.setFontSize(18);
    doc.text(reportName, 14, 22);

    // Add description if available
    const description = form.getValues("description");
    if (description) {
      doc.setFontSize(11);
      doc.text(description, 14, 30);
    }

    // Add generation info
    doc.setFontSize(10);
    doc.text(`Generated on: ${formatDate(new Date())}`, 14, description ? 38 : 30);

    // Get column headers
    const columns = form.getValues("columns");
    const tableHeaders: string[] = [];

    if (columns.gatePassNumber) tableHeaders.push("Gate Pass No.");
    if (columns.date) tableHeaders.push("Date");
    if (columns.customer) tableHeaders.push("Customer");
    if (columns.department) tableHeaders.push("Department");
    if (columns.driver) tableHeaders.push("Driver");
    if (columns.vehicle) tableHeaders.push("Vehicle");
    if (columns.status) tableHeaders.push("Status");
    if (columns.createdBy) tableHeaders.push("Created By");
    if (columns.createdAt) tableHeaders.push("Created At");
    if (columns.notes) tableHeaders.push("Notes");
    if (columns.items) tableHeaders.push("Items");

    // Prepare data for table
    let startY = description ? 45 : 37;
    let currentY = startY;
    let currentGroupName = "";

    // Loop through data and create tables (possibly with group headers)
    previewData.forEach((row: any, index) => {
      if (row.isGroupHeader) {
        // Add group header
        if (index > 0) currentY += 10; // Add space after previous content

        if (currentY > 250) { // Check if we need a new page
          doc.addPage();
          currentY = 20;
        }

        currentGroupName = row.groupName;
        doc.setFontSize(12);
        doc.setTextColor(63, 81, 181);
        doc.text(`${form.getValues("groupBy").charAt(0).toUpperCase() + form.getValues("groupBy").slice(1)}: ${currentGroupName} (${row.count})`, 14, currentY);
        currentY += 7;
      } else {
        // Regular data row
        // If this is the first row after a group header or a new group altogether, create a new table
        if (
          (index > 0 && previewData[index - 1].isGroupHeader) ||
          (index === 0 && !row.isGroupHeader) ||
          (form.getValues("groupBy") === "none" && index === 0)
        ) {
          const tableRows: any[][] = [];

          // Collect all rows for this group
          let i = index;
          while (i < previewData.length && !previewData[i].isGroupHeader) {
            const dataRow: any[] = [];
            if (columns.gatePassNumber) dataRow.push(previewData[i].gatePassNumber || "");
            if (columns.date) dataRow.push(previewData[i].date || "");
            if (columns.customer) dataRow.push(previewData[i].customer || "");
            if (columns.department) dataRow.push(previewData[i].department || "");
            if (columns.driver) dataRow.push(previewData[i].driver || "");
            if (columns.vehicle) dataRow.push(previewData[i].vehicle || "");
            if (columns.status) dataRow.push(previewData[i].status || "");
            if (columns.createdBy) dataRow.push(previewData[i].createdBy || "");
            if (columns.createdAt) dataRow.push(previewData[i].createdAt || "");
            if (columns.notes) dataRow.push(previewData[i].notes || "");
            if (columns.items) dataRow.push(previewData[i].items || "");

            tableRows.push(dataRow);
            i++;
          }

          // Create table
          // @ts-ignore - jsPDF autotable types are not fully compatible
          autoTable(doc, {
            head: [tableHeaders],
            body: tableRows,
            startY: currentY,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [63, 81, 181], textColor: [255, 255, 255] },
            alternateRowStyles: { fillColor: [245, 245, 245] },
          });

          // Update current Y position
          currentY = (doc as any).lastAutoTable.finalY + 10;
        }
      }
    });

    // Save PDF
    doc.save(`Custom_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <Tabs value={reportTab} className="w-full">
      <Card className="bg-white rounded-lg shadow-sm mb-4">
        <CardHeader className="p-6 border-b border-neutral-medium">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="font-medium">Custom Report Builder</CardTitle>

            <TabsList className="grid grid-cols-2 w-full md:w-64">
              <TabsTrigger
                value="design"
                className={reportTab === "design" ? "data-[state=active]:bg-primary data-[state=active]:text-white" : ""}
                onClick={() => setReportTab("design")}
              >
                <span className="material-icons text-sm mr-2">tune</span>
                Design
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                className={reportTab === "preview" ? "data-[state=active]:bg-primary data-[state=active]:text-white" : ""}
                onClick={() => setReportTab("preview")}
                disabled={previewData.length === 0}
              >
                <span className="material-icons text-sm mr-2">visibility</span>
                Preview
              </TabsTrigger>
            </TabsList>
          </div>
        </CardHeader>
      </Card>

      <TabsContent value="design" className="m-0">
        <Card className="bg-white rounded-lg shadow-sm">
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(previewReport)}>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Report Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter report name"
                              {...field}
                              className="w-full"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Briefly describe this report"
                              {...field}
                              className="w-full"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-4">Report Filters</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Date Range Filter */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <FormField
                            control={form.control}
                            name="filters.dateRange.enabled"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-medium !mt-0">
                                  Date Range
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>

                        {form.watch("filters.dateRange.enabled") && (
                          <div className="grid grid-cols-2 gap-2">
                            <FormField
                              control={form.control}
                              name="filters.dateRange.dateFrom"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">From</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      {...field}
                                      className="w-full"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="filters.dateRange.dateTo"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">To</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      {...field}
                                      className="w-full"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                      </div>

                      {/* Customer Filter */}
                      <div className="space-y-3">
                        <FormField
                          control={form.control}
                          name="filters.customer.enabled"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-medium !mt-0">
                                Customer
                              </FormLabel>
                            </FormItem>
                          )}
                        />

                        {form.watch("filters.customer.enabled") && (
                          <FormField
                            control={form.control}
                            name="filters.customer.value"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    placeholder="Customer name"
                                    {...field}
                                    className="w-full"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        )}
                      </div>

                      {/* Department Filter */}
                      <div className="space-y-3">
                        <FormField
                          control={form.control}
                          name="filters.department.enabled"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-medium !mt-0">
                                Department
                              </FormLabel>
                            </FormItem>
                          )}
                        />

                        {form.watch("filters.department.enabled") && (
                          <FormField
                            control={form.control}
                            name="filters.department.value"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Select department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {departments.map((dept) => (
                                        <SelectItem key={dept.id} value={dept.name}>
                                          {dept.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        )}
                      </div>

                      {/* Driver Filter */}
                      <div className="space-y-3">
                        <FormField
                          control={form.control}
                          name="filters.driver.enabled"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-medium !mt-0">
                                Driver
                              </FormLabel>
                            </FormItem>
                          )}
                        />

                        {form.watch("filters.driver.enabled") && (
                          <FormField
                            control={form.control}
                            name="filters.driver.value"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    placeholder="Driver name"
                                    {...field}
                                    className="w-full"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        )}
                      </div>

                      {/* Status Filter */}
                      <div className="space-y-3">
                        <FormField
                          control={form.control}
                          name="filters.status.enabled"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-medium !mt-0">
                                Status
                              </FormLabel>
                            </FormItem>
                          )}
                        />

                        {form.watch("filters.status.enabled") && (
                          <FormField
                            control={form.control}
                            name="filters.status.value"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">Pending</SelectItem>
                                      <SelectItem value="approved">Approved</SelectItem>
                                      <SelectItem value="completed">Completed</SelectItem>
                                      <SelectItem value="rejected">Rejected</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        )}
                      </div>

                      {/* Item Filter */}
                      <div className="space-y-3">
                        <FormField
                          control={form.control}
                          name="filters.item.enabled"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-medium !mt-0">
                                Item
                              </FormLabel>
                            </FormItem>
                          )}
                        />

                        {form.watch("filters.item.enabled") && (
                          <FormField
                            control={form.control}
                            name="filters.item.value"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    placeholder="Item name"
                                    {...field}
                                    className="w-full"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-4">Columns to Display</h3>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      <FormField
                        control={form.control}
                        name="columns.gatePassNumber"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm !mt-0">
                              Gate Pass Number
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="columns.date"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm !mt-0">
                              Date
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="columns.customer"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm !mt-0">
                              Customer
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="columns.department"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm !mt-0">
                              Department
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="columns.driver"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm !mt-0">
                              Driver
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="columns.vehicle"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm !mt-0">
                              Vehicle
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="columns.items"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm !mt-0">
                              Items
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="columns.status"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm !mt-0">
                              Status
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="columns.createdBy"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm !mt-0">
                              Created By
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="columns.createdAt"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm !mt-0">
                              Created At
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="columns.notes"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm !mt-0">
                              Notes
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-4">Grouping &amp; Sorting</h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FormField
                        control={form.control}
                        name="groupBy"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Group By</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select grouping" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">No Grouping</SelectItem>
                                <SelectItem value="customer">Customer</SelectItem>
                                <SelectItem value="department">Department</SelectItem>
                                <SelectItem value="driver">Driver</SelectItem>
                                <SelectItem value="status">Status</SelectItem>
                                <SelectItem value="date">Date</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="sortBy"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sort By</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select sort field" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="date">Date</SelectItem>
                                <SelectItem value="gatePassNumber">Gate Pass Number</SelectItem>
                                <SelectItem value="customer">Customer</SelectItem>
                                <SelectItem value="department">Department</SelectItem>
                                <SelectItem value="status">Status</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="sortOrder"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sort Order</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select sort order" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="asc">Ascending</SelectItem>
                                <SelectItem value="desc">Descending</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => saveTemplate(form.getValues())}
                    >
                      <span className="material-icons text-sm mr-2">save</span>
                      Save Template
                    </Button>

                    <Button
                      type="submit"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <span className="material-icons text-sm mr-2">preview</span>
                          Generate Preview
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="preview" className="m-0 space-y-4">
        <Card className="bg-white rounded-lg shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
              <div>
                <h3 className="text-lg font-medium mb-1">{form.getValues("name") || "Custom Report"}</h3>
                {form.getValues("description") && (
                  <p className="text-sm text-neutral-gray">{form.getValues("description")}</p>
                )}
              </div>

              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToExcel}
                  disabled={previewData.length === 0}
                >
                  <span className="material-icons text-sm mr-2">description</span>
                  Export Excel
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToPDF}
                  disabled={previewData.length === 0}
                >
                  <span className="material-icons text-sm mr-2">picture_as_pdf</span>
                  Export PDF
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap">
                <thead>
                  <tr className="bg-neutral-light">
                    {form.watch("columns.gatePassNumber") && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Gate Pass No.</th>
                    )}
                    {form.watch("columns.date") && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Date</th>
                    )}
                    {form.watch("columns.customer") && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Customer</th>
                    )}
                    {form.watch("columns.department") && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Department</th>
                    )}
                    {form.watch("columns.driver") && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Driver</th>
                    )}
                    {form.watch("columns.vehicle") && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Vehicle</th>
                    )}
                    {form.watch("columns.status") && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Status</th>
                    )}
                    {form.watch("columns.createdBy") && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Created By</th>
                    )}
                    {form.watch("columns.createdAt") && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Created At</th>
                    )}
                    {form.watch("columns.notes") && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Notes</th>
                    )}
                    {form.watch("columns.items") && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Items</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-medium bg-white">
                  {previewData.length > 0 ? (
                    previewData.map((row: any, index: number) => (
                      row.isGroupHeader ? (
                        <tr key={`group-${index}`} className="bg-slate-100">
                          <td
                            colSpan={12}
                            className="px-4 py-3 text-sm font-medium text-primary"
                          >
                            {form.watch("groupBy").charAt(0).toUpperCase() + form.watch("groupBy").slice(1)}: {row.groupName} ({row.count})
                          </td>
                        </tr>
                      ) : (
                        <tr key={`row-${index}`} className="hover:bg-neutral-lightest">
                          {form.watch("columns.gatePassNumber") && (
                            <td className="px-4 py-3 text-sm">{row.gatePassNumber}</td>
                          )}
                          {form.watch("columns.date") && (
                            <td className="px-4 py-3 text-sm">{row.date}</td>
                          )}
                          {form.watch("columns.customer") && (
                            <td className="px-4 py-3 text-sm">{row.customer}</td>
                          )}
                          {form.watch("columns.department") && (
                            <td className="px-4 py-3 text-sm">{row.department}</td>
                          )}
                          {form.watch("columns.driver") && (
                            <td className="px-4 py-3 text-sm">{row.driver}</td>
                          )}
                          {form.watch("columns.vehicle") && (
                            <td className="px-4 py-3 text-sm">{row.vehicle}</td>
                          )}
                          {form.watch("columns.status") && (
                            <td className="px-4 py-3 text-sm">
                              {row.status && (
                                <span className={`px-2 py-1 text-xs rounded-full ${row.status === "completed"
                                    ? "bg-success bg-opacity-10 text-success"
                                    : row.status === "pending"
                                      ? "bg-warning bg-opacity-10 text-warning"
                                      : row.status === "approved"
                                        ? "bg-info bg-opacity-10 text-info"
                                        : "bg-error bg-opacity-10 text-error"
                                  }`}>
                                  {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                                </span>
                              )}
                            </td>
                          )}
                          {form.watch("columns.createdBy") && (
                            <td className="px-4 py-3 text-sm">{row.createdBy}</td>
                          )}
                          {form.watch("columns.createdAt") && (
                            <td className="px-4 py-3 text-sm">{row.createdAt}</td>
                          )}
                          {form.watch("columns.notes") && (
                            <td className="px-4 py-3 text-sm">{row.notes}</td>
                          )}
                          {form.watch("columns.items") && (
                            <td className="px-4 py-3 text-sm">{row.items}</td>
                          )}
                        </tr>
                      )
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={12}
                        className="px-4 py-10 text-center text-sm text-neutral-gray"
                      >
                        No results found matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {previewData.length > 0 && (
              <div className="mt-4 text-sm text-neutral-gray text-right">
                Total: {previewData.filter((r: any) => !r.isGroupHeader).length} gate passes
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between mt-4">
          <Button
            variant="outline"
            onClick={() => setReportTab("design")}
          >
            <span className="material-icons text-sm mr-2">arrow_back</span>
            Back to Design
          </Button>

          <Button
            onClick={() => form.handleSubmit(previewReport)()}
            disabled={isLoading}
          >
            <span className="material-icons text-sm mr-2">refresh</span>
            Refresh Preview
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectValue, SelectTrigger, SelectItem, SelectContent, Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Filter, Download, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";

// Define the type for activity logs
interface ActivityLog {
  id: number;
  userId: number | null;
  userEmail: string;
  actionType: string;
  entityType: string | null;
  entityId: number | null;
  description: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
  additionalData: string | null;
}

export default function ActivityLogs() {
  const { toast } = useToast();
  
  // Filter state
  const [userEmail, setUserEmail] = useState<string>("");
  const [actionType, setActionType] = useState<string>("");
  const [entityType, setEntityType] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);
  
  // Build the query parameters
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    
    if (userEmail) params.append("userEmail", userEmail);
    if (actionType) params.append("actionType", actionType);
    if (entityType) params.append("entityType", entityType);
    if (dateFrom) params.append("dateFrom", dateFrom.toISOString());
    if (dateTo) params.append("dateTo", dateTo.toISOString());
    
    return params.toString();
  };
  
  // Fetch activity logs
  const { 
    data: logs,
    isLoading,
    isError,
    refetch
  } = useQuery<ActivityLog[]>({
    queryKey: ['/api/activity-logs', userEmail, actionType, entityType, dateFrom, dateTo],
    queryFn: async () => {
      const params = buildQueryParams();
      const url = `/api/activity-logs${params ? `?${params}` : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch activity logs');
      }
      
      return response.json();
    }
  });
  
  // Handle export to CSV
  const exportToCSV = () => {
    if (!logs || logs.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no activity logs to export",
        variant: "destructive",
      });
      return;
    }
    
    // Convert logs to CSV format
    const headers = [
      "ID",
      "User ID",
      "User Email",
      "Action Type",
      "Entity Type",
      "Entity ID",
      "Description",
      "IP Address",
      "Timestamp",
    ];
    
    const csvRows = [
      headers.join(","),
      ...logs.map(log => [
        log.id,
        log.userId || "",
        `"${log.userEmail}"`,
        `"${log.actionType}"`,
        log.entityType ? `"${log.entityType}"` : "",
        log.entityId || "",
        log.description ? `"${log.description.replace(/"/g, '""')}"` : "",
        log.ipAddress ? `"${log.ipAddress}"` : "",
        `"${formatDateTime(log.timestamp)}"`,
      ].join(","))
    ];
    
    // Create CSV file
    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `activity_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Function to get badge color based on action type
  const getActionBadgeVariant = (actionType: string) => {
    switch (actionType) {
      case "login_success":
        return "default"; // Use default instead of success as it's not in the Badge variants
      case "login_failed":
        return "destructive";
      case "create":
        return "default";
      case "update":
        return "secondary";
      case "delete":
        return "destructive";
      case "view":
        return "outline";
      default:
        return "default";
    }
  };
  
  // Reset filters
  const resetFilters = () => {
    setUserEmail("");
    setActionType("");
    setEntityType("");
    setDateFrom(undefined);
    setDateTo(undefined);
    refetch();
  };
  
  // Apply filters
  const applyFilters = () => {
    refetch();
  };
  
  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">User Activity Logs</h1>
          <p className="text-muted-foreground">
            Track and monitor user activity throughout the system
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-2 h-4 w-4" />
            {showFilters ? "Hide Filters" : "Show Filters"}
          </Button>
          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={!logs || logs.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>
      
      {showFilters && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter Activity Logs</CardTitle>
            <CardDescription>
              Use the filters below to narrow down activity logs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <label htmlFor="userEmail" className="text-sm font-medium">
                  User Email
                </label>
                <Input
                  id="userEmail"
                  placeholder="Filter by user email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="actionType" className="text-sm font-medium">
                  Action Type
                </label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select action type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Actions</SelectItem>
                    <SelectItem value="login_success">Login Success</SelectItem>
                    <SelectItem value="login_failed">Login Failed</SelectItem>
                    <SelectItem value="create">Create</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="delete">Delete</SelectItem>
                    <SelectItem value="view">View</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="entityType" className="text-sm font-medium">
                  Entity Type
                </label>
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select entity type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Entities</SelectItem>
                    <SelectItem value="auth">Authentication</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="gatePass">Gate Pass</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="driver">Driver</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <label htmlFor="dateFrom" className="text-sm font-medium">
                  Date From
                </label>
                <DatePicker
                  date={dateFrom}
                  setDate={setDateFrom}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="dateTo" className="text-sm font-medium">
                  Date To
                </label>
                <DatePicker
                  date={dateTo}
                  setDate={setDateTo}
                  className="w-full"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={resetFilters}>
                Reset Filters
              </Button>
              <Button onClick={applyFilters}>
                Apply Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center p-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading activity logs...</span>
            </div>
          ) : isError ? (
            <div className="flex justify-center items-center p-10">
              <p className="text-destructive">Error loading activity logs. Please try again.</p>
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="flex justify-center items-center p-10">
              <p className="text-muted-foreground">No activity logs found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {formatDateTime(log.timestamp)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {log.userEmail}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.actionType)}>
                          {log.actionType.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.entityType ? (
                          <span className="capitalize">
                            {log.entityType}
                            {log.entityId ? ` #${log.entityId}` : ''}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {log.description || 'N/A'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {log.ipAddress || 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
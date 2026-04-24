import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { formatDate } from "@/lib/utils";
import { jsPDF } from "jspdf";
import { useIsMobile } from "@/hooks/use-mobile";

// Define chart types
type ChartType = 'bar' | 'pie' | 'line' | 'area';

// Define colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function AnalyticsVisualization() {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [dataType, setDataType] = useState('status');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [exportLoading, setExportLoading] = useState(false);
  const isMobile = useIsMobile();

  // Fetch statistics data for visualizations
  const { data: statistics, isLoading } = useQuery({
    queryKey: ['/api/statistics', dateRange.from, dateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.from) params.append('dateFrom', dateRange.from);
      if (dateRange.to) params.append('dateTo', dateRange.to);
      
      const url = params.toString() ? `/api/statistics?${params.toString()}` : '/api/statistics';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch statistics');
      return response.json();
    }
  });

  // Handle date range changes
  const handleDateChange = (field: 'from' | 'to', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

  const STATUS_LABELS: Record<string, string> = {
    pending: "Pending",
    hod_approved: "HOD Approved",
    security_allowed: "Security Allowed",
    completed: "Completed",
    rejected: "Rejected",
    sent_back: "Sent Back",
  };

  // Prepare data for the selected visualization
  const getChartData = () => {
    if (!statistics) return [];

    switch(dataType) {
      case 'status':
        // Map raw status keys to friendly labels for display
        return statistics.statusDistribution.map((item) => ({
          ...item,
          status: STATUS_LABELS[item.status] || item.status,
        }));
      case 'type':
        return (statistics as any).typeDistribution?.map((item: any) => ({
          ...item,
          type: item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : "Unknown",
        })) ?? [];
      case 'department':
        return statistics.departmentDistribution;
      case 'monthly':
        return statistics.monthlyTrend;
      case 'daily':
        return statistics.dailyTrend;
      default:
        return [];
    }
  };

  // Get appropriate label for the X axis
  const getXAxisLabel = () => {
    switch(dataType) {
      case 'status': return 'Status';
      case 'type': return 'Type';
      case 'department': return 'Department';
      case 'monthly': return 'Month';
      case 'daily': return 'Date';
      default: return '';
    }
  };

  // Get appropriate data key for the selected data type
  const getDataKey = () => 'count';

  // Get appropriate name key for the selected data type
  const getNameKey = () => {
    switch(dataType) {
      case 'status': return 'status';
      case 'type': return 'type';
      case 'department': return 'department';
      case 'monthly': return 'month';
      case 'daily': return 'date';
      default: return '';
    }
  };

  // Format the chart title based on current selection
  const getChartTitle = () => {
    const typeText: Record<string, string> = {
      'status': 'Status Distribution',
      'type': 'Type Distribution',
      'department': 'Department Distribution',
      'monthly': 'Monthly Trend',
      'daily': 'Daily Distribution',
    };
    return `Gate Pass ${typeText[dataType] || dataType}`;
  };

  // Export chart as PDF
  const exportToPDF = async () => {
    try {
      setExportLoading(true);
      
      // Create new PDF document
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(18);
      doc.text(getChartTitle(), 14, 22);
      
      // Add date range info if provided
      if (dateRange.from || dateRange.to) {
        doc.setFontSize(11);
        doc.text(`Date Range: ${dateRange.from ? formatDate(dateRange.from) : 'All'} to ${dateRange.to ? formatDate(dateRange.to) : 'Present'}`, 14, 30);
      }
      
      // Create a temporary canvas element to capture the chart
      const chartContainer = document.getElementById('chart-container');
      if (chartContainer) {
        // Use html2canvas to capture the chart (dynamically import to reduce initial load time)
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(chartContainer);
        
        // Add the chart image to PDF
        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 10, 40, 190, 100);
        
        // Add statistics summary
        doc.setFontSize(12);
        doc.text('Summary Statistics', 14, 150);
        
        // Add data table
        const tableData = getChartData();
        const tableHeaders = [getXAxisLabel(), 'Count', 'Percentage'];
        
        const tableRows = tableData.map((item: any) => {
          const nameKey = getNameKey();
          const dataKey = getDataKey();
          const percentage = ((item[dataKey] / tableData.reduce((acc: number, curr: any) => acc + curr[dataKey], 0)) * 100).toFixed(1);
          return [
            item[nameKey], 
            item[dataKey].toString(), 
            `${percentage}%`
          ];
        });
        
        // @ts-ignore - jsPDF autotable types are not fully compatible
        (await import('jspdf-autotable')).default(doc, {
          startY: 155,
          head: [tableHeaders],
          body: tableRows,
        });
        
        // Save PDF
        doc.save(`GatePass_Analytics_${dataType}_${new Date().toISOString().slice(0, 10)}.pdf`);
      }
    } catch (error) {
      console.error('Error exporting to PDF:', error);
    } finally {
      setExportLoading(false);
    }
  };

  // Render appropriate chart based on selected type
  const renderChart = () => {
    const data = getChartData();
    const nameKey = getNameKey();
    const dataKey = getDataKey();
    
    // No data to display
    if (data.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-neutral-gray">
          No data available for the selected criteria
        </div>
      );
    }
    
    switch(chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={nameKey} />
              <YAxis />
              <Tooltip 
                formatter={(value) => [`${value}`, 'Count']}
                labelFormatter={(label) => `${getXAxisLabel()}: ${label}`}
              />
              <Legend />
              <Bar dataKey={dataKey} fill="#3F51B5" name="Count" />
            </BarChart>
          </ResponsiveContainer>
        );
        
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={(entry) => entry[nameKey]}
                outerRadius={80}
                fill="#8884d8"
                dataKey={dataKey}
                nameKey={nameKey}
              >
                {data.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => [`${value}`, 'Count']}
                labelFormatter={(label) => `${getXAxisLabel()}: ${label}`}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
        
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={nameKey} />
              <YAxis />
              <Tooltip 
                formatter={(value) => [`${value}`, 'Count']}
                labelFormatter={(label) => `${getXAxisLabel()}: ${label}`}
              />
              <Legend />
              <Line type="monotone" dataKey={dataKey} stroke="#3F51B5" name="Count" />
            </LineChart>
          </ResponsiveContainer>
        );
        
      default:
        return null;
    }
  };

  // Render summary statistics in cards
  const renderSummary = () => {
    if (!statistics) return null;
    const stats = statistics as any;

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-neutral-gray mb-1">Total</div>
            <div className="text-2xl font-semibold">{statistics.totalPasses}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-neutral-gray mb-1">This Month</div>
            <div className="text-2xl font-semibold">{statistics.monthlyPasses}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-neutral-gray mb-1">This Week</div>
            <div className="text-2xl font-semibold">{statistics.weeklyPasses}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-400">
          <CardContent className="p-4">
            <div className="text-xs text-neutral-gray mb-1">Awaiting HOD</div>
            <div className="text-2xl font-semibold text-yellow-600">{stats.pendingHOD ?? statistics.pendingApprovals}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="p-4">
            <div className="text-xs text-neutral-gray mb-1">Awaiting Security</div>
            <div className="text-2xl font-semibold text-blue-600">{stats.pendingSecurity ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-400">
          <CardContent className="p-4">
            <div className="text-xs text-neutral-gray mb-1">Sent Back</div>
            <div className="text-2xl font-semibold text-orange-600">{stats.sentBack ?? 0}</div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <Card className="bg-white rounded-lg shadow-sm">
      <CardHeader className="p-6 border-b border-neutral-medium">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className="font-medium">Analytics Visualization</CardTitle>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportToPDF} 
            disabled={isLoading || exportLoading}
          >
            {exportLoading ? (
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
            ) : (
              <span className="material-icons text-sm mr-2">picture_as_pdf</span>
            )}
            Export as PDF
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div>
            <Label htmlFor="chart-type">Chart Type</Label>
            <Select value={chartType} onValueChange={(value) => setChartType(value as ChartType)}>
              <SelectTrigger id="chart-type" className="mt-1">
                <SelectValue placeholder="Select chart type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Bar Chart</SelectItem>
                <SelectItem value="pie">Pie Chart</SelectItem>
                <SelectItem value="line">Line Chart</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="data-type">Data Type</Label>
            <Select value={dataType} onValueChange={setDataType}>
              <SelectTrigger id="data-type" className="mt-1">
                <SelectValue placeholder="Select data type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Status Distribution</SelectItem>
                <SelectItem value="type">Type Distribution</SelectItem>
                <SelectItem value="department">Department Distribution</SelectItem>
                <SelectItem value="monthly">Monthly Trend</SelectItem>
                <SelectItem value="daily">Daily Distribution</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="date-from">From Date</Label>
            <Input
              id="date-from"
              type="date"
              value={dateRange.from}
              onChange={(e) => handleDateChange('from', e.target.value)}
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="date-to">To Date</Label>
            <Input
              id="date-to"
              type="date"
              value={dateRange.to}
              onChange={(e) => handleDateChange('to', e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        
        {renderSummary()}
        
        <Card>
          <CardHeader className="p-4 border-b border-neutral-medium">
            <CardTitle className="font-medium text-base">{getChartTitle()}</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="ml-2">Loading chart data...</p>
              </div>
            ) : (
              <div id="chart-container">
                {renderChart()}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Data Table */}
        <Card className="mt-6">
          <CardHeader className="p-4 border-b border-neutral-medium">
            <CardTitle className="font-medium text-base">Data Table</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap">
                <thead>
                  <tr className="bg-neutral-light">
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">{getXAxisLabel()}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Count</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Percentage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-medium bg-white">
                  {isLoading ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center">
                        <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                        <p className="ml-2 inline-block">Loading...</p>
                      </td>
                    </tr>
                  ) : getChartData().length > 0 ? (
                    getChartData().map((item: any, index: number) => {
                      const nameKey = getNameKey();
                      const dataKey = getDataKey();
                      const total = getChartData().reduce((acc: number, curr: any) => acc + curr[dataKey], 0);
                      const percentage = ((item[dataKey] / total) * 100).toFixed(1);
                      
                      return (
                        <tr key={index} className="hover:bg-neutral-lightest">
                          <td className="px-4 py-3 text-sm font-medium">{item[nameKey]}</td>
                          <td className="px-4 py-3 text-sm">{item[dataKey]}</td>
                          <td className="px-4 py-3 text-sm">{percentage}%</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-sm text-neutral-gray">
                        No data available for the selected criteria
                      </td>
                    </tr>
                  )}
                </tbody>
                {getChartData().length > 0 && (
                  <tfoot className="bg-neutral-lightest">
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium">Total</td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {getChartData().reduce((acc: number, curr: any) => acc + curr[getDataKey()], 0)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">100%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
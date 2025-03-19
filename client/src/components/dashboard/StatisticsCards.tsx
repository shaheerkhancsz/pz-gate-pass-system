import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { BarChart, LineChart, PieChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Bar, Line, Cell, Pie, Legend } from 'recharts';
import { Button } from "@/components/ui/button";

interface StatusDistribution {
  status: string;
  count: number;
}

interface DepartmentDistribution {
  department: string;
  count: number;
}

interface MonthlyTrend {
  month: string;
  count: number;
}

interface DailyTrend {
  date: string;
  count: number;
}

interface StatisticsProps {
  totalPasses: number;
  monthlyPasses: number;
  weeklyPasses: number;
  pendingApprovals: number;
  statusDistribution: StatusDistribution[];
  departmentDistribution: DepartmentDistribution[];
  monthlyTrend: MonthlyTrend[];
  dailyTrend: DailyTrend[];
}

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

// Format status for display
const formatStatus = (status: string): string => {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

// Format department for display
const formatDepartment = (department: string): string => {
  if (!department) return 'Unknown';
  return department.charAt(0).toUpperCase() + department.slice(1);
};

export function StatisticsCards() {
  const { data: statistics, isLoading, error, refetch } = useQuery<StatisticsProps>({
    queryKey: ["/api/statistics"],
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true,
    retry: 3,
    staleTime: 0 // Always fetch fresh data
  });

  // Calculate percentage changes with safety checks
  const calculatePercentageChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    if (isNaN(current) || isNaN(previous)) return 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  // Format dates for display with safety check
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return ''; // Invalid date
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  // Show error state if there's an error
  if (error instanceof Error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card className="bg-white p-6 rounded-lg shadow-sm col-span-full">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div className="text-error">Error loading statistics: {error.message}</div>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !statistics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {[...Array(4)].map((_, index) => (
          <Card key={index} className="bg-white p-6 rounded-lg shadow-sm">
            <CardContent className="p-0">
              <div className="animate-pulse flex space-x-4">
                <div className="flex-1 space-y-4 py-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
                <div className="h-12 w-12 rounded-full bg-gray-200"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Prepare data for charts with safety checks
  const statusData = statistics.statusDistribution
    .filter(item => item.status && typeof item.count === 'number' && item.count >= 0)
    .map(item => ({
      ...item,
      status: formatStatus(item.status)
    }));

  const departmentData = statistics.departmentDistribution
    .filter(item => item.department && typeof item.count === 'number' && item.count >= 0)
    .map(item => ({
      ...item,
      department: formatDepartment(item.department)
    }));

  const monthlyTrendData = statistics.monthlyTrend
    .filter(item => item.month && typeof item.count === 'number' && item.count >= 0);

  const dailyTrendData = statistics.dailyTrend
    .filter(item => item.date && typeof item.count === 'number' && item.count >= 0)
    .map(item => ({
      ...item,
      formattedDate: formatDate(item.date)
    }))
    .filter(item => item.formattedDate);

  // Calculate trend percentages with safety checks
  const monthlyChangePercent = monthlyTrendData.length >= 2 
    ? calculatePercentageChange(
        monthlyTrendData[monthlyTrendData.length - 1]?.count || 0, 
        monthlyTrendData[monthlyTrendData.length - 2]?.count || 0
      )
    : 0;
    
  const weeklyChangePercent = dailyTrendData.length >= 14
    ? calculatePercentageChange(
        dailyTrendData.slice(-7).reduce((sum, item) => sum + (item.count || 0), 0),
        dailyTrendData.slice(-14, -7).reduce((sum, item) => sum + (item.count || 0), 0)
      )
    : 0;

  return (
    <>
      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card className="bg-white p-6 rounded-lg shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-neutral-gray text-sm">Total Gate Passes</p>
                <h2 className="text-2xl font-medium mt-1">{statistics?.totalPasses || 0}</h2>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary bg-opacity-10 flex items-center justify-center">
                <span className="material-icons text-primary">description</span>
              </div>
            </div>
            <div className="mt-4 flex items-center text-success text-sm">
              <span className="material-icons text-sm mr-1">trending_up</span>
              <span>All time</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white p-6 rounded-lg shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-neutral-gray text-sm">Passes This Month</p>
                <h2 className="text-2xl font-medium mt-1">{statistics?.monthlyPasses || 0}</h2>
              </div>
              <div className="h-12 w-12 rounded-full bg-info bg-opacity-10 flex items-center justify-center">
                <span className="material-icons text-info">date_range</span>
              </div>
            </div>
            <div className={`mt-4 flex items-center ${monthlyChangePercent >= 0 ? 'text-success' : 'text-error'} text-sm`}>
              <span className="material-icons text-sm mr-1">
                {monthlyChangePercent >= 0 ? 'trending_up' : 'trending_down'}
              </span>
              <span>{Math.abs(monthlyChangePercent)}% {monthlyChangePercent >= 0 ? 'increase' : 'decrease'}</span>
              <span className="text-neutral-gray ml-1">from previous month</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white p-6 rounded-lg shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-neutral-gray text-sm">Passes This Week</p>
                <h2 className="text-2xl font-medium mt-1">{statistics?.weeklyPasses || 0}</h2>
              </div>
              <div className="h-12 w-12 rounded-full bg-warning bg-opacity-10 flex items-center justify-center">
                <span className="material-icons text-warning">view_week</span>
              </div>
            </div>
            <div className={`mt-4 flex items-center ${weeklyChangePercent >= 0 ? 'text-success' : 'text-error'} text-sm`}>
              <span className="material-icons text-sm mr-1">
                {weeklyChangePercent >= 0 ? 'trending_up' : 'trending_down'}
              </span>
              <span>{Math.abs(weeklyChangePercent)}% {weeklyChangePercent >= 0 ? 'increase' : 'decrease'}</span>
              <span className="text-neutral-gray ml-1">from last week</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white p-6 rounded-lg shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-neutral-gray text-sm">Pending Approvals</p>
                <h2 className="text-2xl font-medium mt-1">{statistics?.pendingApprovals || 0}</h2>
              </div>
              <div className="h-12 w-12 rounded-full bg-error bg-opacity-10 flex items-center justify-center">
                <span className="material-icons text-error">pending_actions</span>
              </div>
            </div>
            <div className="mt-4 flex items-center text-neutral-gray text-sm">
              <span className="material-icons text-sm mr-1">access_time</span>
              <span>Needs attention</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly Trend Chart */}
        <Card className="bg-white rounded-lg shadow-sm">
          <CardHeader className="p-6 border-b border-neutral-medium">
            <CardTitle className="font-medium">Monthly Gate Pass Trend</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={monthlyTrendData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Number of Gate Passes"
                    stroke="#8884d8"
                    activeDot={{ r: 8 }}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Daily Trend Chart */}
        <Card className="bg-white rounded-lg shadow-sm">
          <CardHeader className="p-6 border-b border-neutral-medium">
            <CardTitle className="font-medium">Daily Gate Pass Activity (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dailyTrendData.slice(-14)} // Show last 14 days for better visibility
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis dataKey="formattedDate" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="count"
                    name="Gate Passes"
                    fill="#82ca9d"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution Chart */}
        <Card className="bg-white rounded-lg shadow-sm">
          <CardHeader className="p-6 border-b border-neutral-medium">
            <CardTitle className="font-medium">Gate Pass Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                    nameKey="status"
                    label={({ status, count }) => `${status}: ${count}`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name, props) => [`${value} passes`, props.payload.status]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Department Distribution Chart */}
        <Card className="bg-white rounded-lg shadow-sm">
          <CardHeader className="p-6 border-b border-neutral-medium">
            <CardTitle className="font-medium">Department Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={departmentData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                >
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="department" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="Gate Passes" fill="#0088FE" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency, formatE8s } from '../lib/utils';
import { TrendingUp, Users, Target, Clock } from 'lucide-react';

interface DashboardProps {
  campaigns: Array<{
    id: bigint;
    title: string;
    goal: bigint;
    amount_raised: bigint;
    end_date: bigint;
    days_left: bigint;
    category: string;
    idea_id: bigint;
  }>;
}

export const Dashboard: React.FC<DashboardProps> = ({ campaigns }) => {
  // Calculate statistics
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.days_left > 0).length;
  const totalGoal = campaigns.reduce((sum, c) => sum + Number(c.goal), 0);
  const totalRaised = campaigns.reduce((sum, c) => sum + Number(c.amount_raised), 0);
  const fundedCampaigns = campaigns.filter(c => c.amount_raised >= c.goal).length;

  // Prepare data for charts
  const categoryData = campaigns.reduce((acc, campaign) => {
    const category = campaign.category;
    if (!acc[category]) {
      acc[category] = { category, count: 0, raised: 0 };
    }
    acc[category].count += 1;
    acc[category].raised += Number(campaign.amount_raised);
    return acc;
  }, {} as Record<string, { category: string; count: number; raised: number }>);

  const chartData = Object.values(categoryData).map(item => ({
    ...item,
    raised: Number(item.raised) / 100_000_000, // Convert to ICP
  }));

  const pieData = [
    { name: 'Funded', value: fundedCampaigns, color: '#10b981' },
    { name: 'Active', value: activeCampaigns - fundedCampaigns, color: '#3b82f6' },
    { name: 'Ended', value: totalCampaigns - activeCampaigns, color: '#6b7280' },
  ];

  const COLORS = ['#10b981', '#3b82f6', '#6b7280'];

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCampaigns}</div>
            <p className="text-xs text-muted-foreground">
              {activeCampaigns} active campaigns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Raised</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalRaised / 100_000_000)}
            </div>
            <p className="text-xs text-muted-foreground">
              of {formatCurrency(totalGoal / 100_000_000)} goal
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Funded Projects</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fundedCampaigns}</div>
            <p className="text-xs text-muted-foreground">
              {totalCampaigns > 0 ? Math.round((fundedCampaigns / totalCampaigns) * 100) : 0}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCampaigns}</div>
            <p className="text-xs text-muted-foreground">
              {totalCampaigns - activeCampaigns} ended
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Funding Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Funding by Category</CardTitle>
            <CardDescription>
              Total ICP raised per project category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="category" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={12}
                />
                <YAxis 
                  tickFormatter={(value) => `${value.toFixed(2)} ICP`}
                  fontSize={12}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(2)} ICP`, 'Raised']}
                  labelFormatter={(label) => `Category: ${label}`}
                />
                <Bar dataKey="raised" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Campaign Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Status</CardTitle>
            <CardDescription>
              Distribution of campaign statuses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [value, 'Campaigns']}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Campaigns</CardTitle>
          <CardDescription>
            Latest campaigns and their funding progress
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {campaigns.slice(0, 5).map((campaign) => (
              <div key={campaign.id.toString()} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">{campaign.title}</h4>
                  <p className="text-sm text-muted-foreground">{campaign.category}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {formatCurrency(Number(campaign.amount_raised) / 100_000_000)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    of {formatCurrency(Number(campaign.goal) / 100_000_000)}
                  </p>
                </div>
                <div className="ml-4">
                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full"
                      style={{ 
                        width: `${Math.min((Number(campaign.amount_raised) / Number(campaign.goal)) * 100, 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;

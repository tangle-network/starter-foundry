import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ArrowUpRight, ArrowDownRight, TrendingUp, Users, DollarSign, Activity, MoreHorizontal } from "lucide-react"

const kpis = [
  { label: "Total Revenue", value: "$45,231.89", change: "+20.1%", trend: "up", icon: DollarSign },
  { label: "Active Users", value: "2,350", change: "+180.1%", trend: "up", icon: Users },
  { label: "Conversion Rate", value: "3.2%", change: "-4.5%", trend: "down", icon: TrendingUp },
  { label: "Active Sessions", value: "573", change: "+12.4%", trend: "up", icon: Activity },
]

const recentActivity = [
  { user: "Sarah Chen", action: "Created new project", time: "2 min ago" },
  { user: "Marcus Johnson", action: "Completed onboarding", time: "5 min ago" },
  { user: "Emily Rodriguez", action: "Upgraded to Pro", time: "12 min ago" },
  { user: "David Kim", action: "Invited 3 team members", time: "24 min ago" },
  { user: "Lisa Wang", action: "Published API documentation", time: "1 hour ago" },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your project metrics and recent activity.</p>
        </div>
        <Button>
          Download Report
          <ArrowUpRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-sm font-medium">{kpi.label}</CardDescription>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <div className="flex items-center gap-1 text-xs">
                {kpi.trend === "up" ? (
                  <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                )}
                <span className={kpi.trend === "up" ? "text-emerald-500" : "text-red-500"}>
                  {kpi.change}
                </span>
                <span className="text-muted-foreground">from last month</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        {/* Chart placeholder */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
            <CardDescription>Monthly revenue for the current year</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed bg-muted/50">
              <div className="text-center text-muted-foreground">
                <TrendingUp className="mx-auto mb-2 h-8 w-8" />
                <p className="text-sm font-medium">Chart Area</p>
                <p className="text-xs">Add recharts, tremor, or nivo for interactive charts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Activity</CardTitle>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((item, i) => (
                <div key={i}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {item.user.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div className="flex-1 truncate">
                      <p className="text-sm font-medium">{item.user}</p>
                      <p className="text-xs text-muted-foreground">{item.action}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</span>
                  </div>
                  {i < recentActivity.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  useServices, useTokens, useStaff,
  type Service, type Token
} from "@/hooks/useQueue";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft, Clock, Users, TrendingUp, Filter, Download, BarChart3, 
  Calendar, Search, CheckCircle, AlertCircle, XCircle, Hourglass
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TokenStats {
  totalWaitTime: number;
  avgWaitTime: number;
  maxWaitTime: number;
  minWaitTime: number;
  completionRate: number;
  totalTokens: number;
  completedTokens: number;
  cancelledTokens: number;
  waitingTokens: number;
}

export default function StaffTokens() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterService, setFilterService] = useState<string | null>(null);
  const [filterDateRange, setFilterDateRange] = useState<"today" | "week" | "month" | "all">("all");

  const { data: services } = useServices();
  const { data: allTokens } = useTokens();
  const { data: staffList } = useStaff();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/staff/login");
        return;
      }

      const { data: staffData, error } = await supabase
        .from("staff")
        .select("id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error || !staffData) {
        toast.error("Unauthorized access");
        await supabase.auth.signOut();
        navigate("/staff/login");
        return;
      }

      setUser(session.user);
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  // Filter tokens based on all criteria
  const filteredTokens = useMemo(() => {
    let filtered = allTokens || [];

    // Filter by search term (token number or customer name)
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(t => {
        const tokenMatch = String(t.token_number).includes(searchTerm);
        return tokenMatch;
      });
    }

    // Filter by status
    if (filterStatus) {
      filtered = filtered.filter(t => t.status === filterStatus);
    }

    // Filter by service
    if (filterService) {
      filtered = filtered.filter(t => t.service_id === filterService);
    }

    // Filter by date range
    if (filterDateRange !== "all") {
      const now = new Date();
      let startDate = new Date();

      if (filterDateRange === "today") {
        startDate.setHours(0, 0, 0, 0);
      } else if (filterDateRange === "week") {
        startDate.setDate(now.getDate() - 7);
      } else if (filterDateRange === "month") {
        startDate.setMonth(now.getMonth() - 1);
      }

      filtered = filtered.filter(t => new Date(t.created_at) >= startDate);
    }

    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [allTokens, searchTerm, filterStatus, filterService, filterDateRange]);

  // Calculate statistics
  const stats: TokenStats = useMemo(() => {
    const tokens = filteredTokens;
    const completed = tokens.filter(t => t.status === "completed");
    const cancelled = tokens.filter(t => t.status === "cancelled");
    const waiting = tokens.filter(t => t.status === "waiting");

    const waitTimes = tokens
      .filter(t => t.started_at && t.created_at)
      .map(t => (new Date(t.started_at!).getTime() - new Date(t.created_at).getTime()) / 1000);

    return {
      totalWaitTime: waitTimes.reduce((a, b) => a + b, 0),
      avgWaitTime: waitTimes.length ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0,
      maxWaitTime: waitTimes.length ? Math.max(...waitTimes) : 0,
      minWaitTime: waitTimes.length ? Math.min(...waitTimes) : 0,
      completionRate: tokens.length ? (completed.length / tokens.length) * 100 : 0,
      totalTokens: tokens.length,
      completedTokens: completed.length,
      cancelledTokens: cancelled.length,
      waitingTokens: waiting.length,
    };
  }, [filteredTokens]);

  const getWaitTimeColor = (seconds: number): string => {
    if (seconds < 60) return "text-green-600";
    if (seconds < 300) return "text-yellow-600";
    if (seconds < 900) return "text-orange-600";
    return "text-red-600";
  };

  const getWaitTimeLabel = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const downloadTokenReport = async () => {
    try {
      const rows = filteredTokens.map(t => ({
        "Token #": t.token_number,
        "Service": services?.find(s => s.id === t.service_id)?.name || t.service_id,
        "Status": t.status.toUpperCase(),
        "Created": new Date(t.created_at).toLocaleString(),
        "Started": t.started_at ? new Date(t.started_at).toLocaleString() : "-",
        "Ended": t.ended_at ? new Date(t.ended_at).toLocaleString() : "-",
        "Wait Time": t.started_at ? `${Math.round((new Date(t.started_at).getTime() - new Date(t.created_at).getTime()) / 1000)}s` : "-",
      }));

      const header = ["Token #", "Service", "Status", "Created", "Started", "Ended", "Wait Time"];
      const csv = [header.join(",")].concat(rows.map(row => header.map(h => `"${String(row[h as keyof typeof row] ?? '')}"`).join(","))).join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tokens_report_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    } catch (e) {
      toast.error("Failed to download report");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading tokens...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 font-sans pb-8">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => navigate("/staff")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-neutral-900">Tokens Analytics</h1>
              <p className="text-sm text-neutral-600">Detailed token history and wait time statistics</p>
            </div>
            <Button
              size="sm"
              className="gap-2"
              onClick={downloadTokenReport}
            >
              <Download className="h-4 w-4" />
              Export Report
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-neutral-400" />
              <Input
                placeholder="Search token number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Filter className="h-4 w-4" />
                    {filterStatus ? `Status: ${filterStatus}` : "Status"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setFilterStatus(null)}>
                    All Statuses
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("waiting")}>
                    <Hourglass className="h-4 w-4 mr-2" />
                    Waiting
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("serving")}>
                    <Users className="h-4 w-4 mr-2" />
                    Serving
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("completed")}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Completed
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("cancelled")}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelled
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Building2Icon className="h-4 w-4" />
                    {filterService ? services?.find(s => s.id === filterService)?.name : "Service"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setFilterService(null)}>
                    All Services
                  </DropdownMenuItem>
                  {services?.map(service => (
                    <DropdownMenuItem key={service.id} onClick={() => setFilterService(service.id)}>
                      {service.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Calendar className="h-4 w-4" />
                    {filterDateRange === "all" ? "Date" : filterDateRange}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setFilterDateRange("today")}>
                    Today
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterDateRange("week")}>
                    Last 7 Days
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterDateRange("month")}>
                    Last 30 Days
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterDateRange("all")}>
                    All Time
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-6 border-blue-200 bg-gradient-to-br from-blue-50 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 font-medium">Total Tokens</p>
                <p className="text-3xl font-bold text-neutral-900 mt-2">{stats.totalTokens}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border-green-200 bg-gradient-to-br from-green-50 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 font-medium">Completion Rate</p>
                <p className="text-3xl font-bold text-neutral-900 mt-2">{stats.completionRate.toFixed(1)}%</p>
                <p className="text-xs text-neutral-500 mt-1">{stats.completedTokens} completed</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border-orange-200 bg-gradient-to-br from-orange-50 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 font-medium">Avg Wait Time</p>
                <p className="text-3xl font-bold text-neutral-900 mt-2">{getWaitTimeLabel(stats.avgWaitTime)}</p>
                <p className="text-xs text-neutral-500 mt-1">per token</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border-red-200 bg-gradient-to-br from-red-50 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 font-medium">Max Wait Time</p>
                <p className="text-3xl font-bold text-neutral-900 mt-2">{getWaitTimeLabel(stats.maxWaitTime)}</p>
                <p className="text-xs text-neutral-500 mt-1">longest wait</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Token Cards Grid */}
        <div>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            Token Details ({filteredTokens.length})
          </h2>

          {filteredTokens.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="h-16 w-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-neutral-400" />
              </div>
              <p className="text-neutral-600 font-medium">No tokens found</p>
              <p className="text-sm text-neutral-500 mt-1">Try adjusting your filters</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTokens.map(token => {
                const waitTime = token.started_at
                  ? (new Date(token.started_at).getTime() - new Date(token.created_at).getTime()) / 1000
                  : 0;
                const service = services?.find(s => s.id === token.service_id);
                const statusColor = {
                  waiting: "border-blue-200 bg-blue-50",
                  serving: "border-green-200 bg-green-50",
                  completed: "border-emerald-200 bg-emerald-50",
                  cancelled: "border-red-200 bg-red-50"
                }[token.status] || "border-neutral-200";

                const statusIcon = {
                  waiting: <Hourglass className="h-4 w-4" />,
                  serving: <Users className="h-4 w-4" />,
                  completed: <CheckCircle className="h-4 w-4" />,
                  cancelled: <XCircle className="h-4 w-4" />
                }[token.status];

                return (
                  <Card key={token.id} className={`p-4 border-2 transition-all hover:shadow-lg ${statusColor}`}>
                    <div className="space-y-3">
                      {/* Token Number & Service */}
                      <div>
                        <p className="text-xs text-neutral-500 font-medium uppercase">
                          {service?.name || "Unknown"}
                        </p>
                        <p className="text-3xl font-mono font-bold text-neutral-900 mt-1">
                          #{String(token.token_number).padStart(3, "0")}
                        </p>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${
                          token.status === "completed" ? "bg-emerald-500" :
                          token.status === "serving" ? "bg-green-500" :
                          token.status === "waiting" ? "bg-blue-500" :
                          "bg-red-500"
                        }`}></div>
                        <span className="text-sm font-semibold capitalize text-neutral-700">
                          {token.status}
                        </span>
                      </div>

                      {/* Wait Time */}
                      {waitTime > 0 && (
                        <div className="pt-2 border-t border-current border-opacity-20">
                          <p className="text-xs text-neutral-600 font-medium mb-1">Wait Time</p>
                          <p className={`text-lg font-bold ${getWaitTimeColor(waitTime)}`}>
                            {getWaitTimeLabel(waitTime)}
                          </p>
                        </div>
                      )}

                      {/* Timestamps */}
                      <div className="pt-2 border-t border-current border-opacity-20 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-neutral-600">Created:</span>
                          <span className="font-mono text-neutral-700">
                            {new Date(token.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        {token.started_at && (
                          <div className="flex justify-between text-xs">
                            <span className="text-neutral-600">Started:</span>
                            <span className="font-mono text-neutral-700">
                              {new Date(token.started_at).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                        {token.ended_at && (
                          <div className="flex justify-between text-xs">
                            <span className="text-neutral-600">Ended:</span>
                            <span className="font-mono text-neutral-700">
                              {new Date(token.ended_at).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Date */}
                      <div className="pt-2 border-t border-current border-opacity-20">
                        <p className="text-xs text-neutral-600 font-medium">Date</p>
                        <p className="text-sm font-mono text-neutral-700 mt-1">
                          {new Date(token.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Icon component for service filter
function Building2Icon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
  );
}

import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  useServices, useStaff,
  type Service
} from "@/hooks/useQueue";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft, Clock, Users, Download, Calendar, Search, CheckCircle, 
  AlertCircle, Bookmark, Filter, FileText, TrendingUp, Activity
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SessionLog {
  id: string;
  session_id: string;
  service_id: string;
  staff_id: string;
  marked: boolean;
  marked_at: string | null;
  created_at: string;
  ended_at: string | null;
  tokens_count?: number;
  staff_name?: string;
}

interface SessionStats {
  totalSessions: number;
  markedSessions: number;
  activeSessions: number;
  endedSessions: number;
  avgSessionDuration: number;
  totalConsultations: number;
}

export default function StaffSessionHistory() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterService, setFilterService] = useState<string | null>(null);
  const [filterMarked, setFilterMarked] = useState<boolean | null>(null);
  const [filterDateRange, setFilterDateRange] = useState<"today" | "week" | "month" | "all">("all");

  const { data: services } = useServices();
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
      loadSessions();
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select(`
          id,
          session_id,
          service_id,
          staff_id,
          marked,
          marked_at,
          created_at,
          ended_at,
          tokens(id)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const sessionsWithData: SessionLog[] = (data || []).map((s: any) => ({
        id: s.id,
        session_id: s.session_id,
        service_id: s.service_id,
        staff_id: s.staff_id,
        marked: s.marked,
        marked_at: s.marked_at,
        created_at: s.created_at,
        ended_at: s.ended_at,
        tokens_count: s.tokens?.length || 0,
        staff_name: staffList?.find(st => st.id === s.staff_id)?.name || "Unknown Staff"
      }));

      setSessions(sessionsWithData);
    } catch (e: any) {
      console.error("Error loading sessions:", e);
      // Detect missing sessions table (PostgREST cache error)
      const msg = e?.message || e?.toString() || "";
      if (e?.code === "PGRST205" || /Could not find the table \'public\.sessions\'/.test(msg)) {
        toast.warn("Sessions table not found; building session history from tokens as a fallback.");
        try {
          const { data: tokens, error: tokensError } = await supabase
            .from("tokens")
            .select("id, service_id, staff_id, created_at, started_at, ended_at")
            .order("created_at", { ascending: false });

          if (tokensError) throw tokensError;

          // Group tokens by staff + service + day to derive sessions
          const groups: Record<string, any[]> = {};
          (tokens || []).forEach((t: any) => {
            const day = new Date(t.created_at).toISOString().split("T")[0];
            const key = `${t.staff_id || 'unknown'}|${t.service_id || 'unknown'}|${day}`;
            groups[key] = groups[key] || [];
            groups[key].push(t);
          });

          const derived: SessionLog[] = Object.keys(groups).map((k, idx) => {
            const parts = k.split("|");
            const staff_id = parts[0] === 'unknown' ? null : parts[0];
            const service_id = parts[1] === 'unknown' ? null : parts[1];
            const tokensArr = groups[k];
            const created_at = tokensArr.reduce((a: string, b: any) => a < b.created_at ? a : b.created_at, tokensArr[0].created_at);
            const ended_at = tokensArr.reduce((a: string | null, b: any) => {
              if (!b.ended_at) return a;
              if (!a) return b.ended_at;
              return a > b.ended_at ? a : b.ended_at;
            }, null);

            return {
              id: `derived-${idx}`,
              session_id: `DERIVED-${staff_id || 'anon'}-${service_id || 'svc'}-${created_at.split('T')[0]}`,
              service_id: service_id || '',
              staff_id: staff_id || '',
              marked: false,
              marked_at: null,
              created_at,
              ended_at,
              tokens_count: tokensArr.length,
              staff_name: staffList?.find(st => st.id === staff_id)?.name || "Unknown Staff"
            } as SessionLog;
          }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          setSessions(derived);
          return;
        } catch (inner) {
          console.error('Fallback building sessions failed', inner);
          toast.error('Failed to build session history fallback. Please run the sessions migration.');
          return;
        }
      }

      toast.error("Failed to load session history");
    }
  };

  // Filter sessions
  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    // Filter by search term (session ID)
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.session_id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by service
    if (filterService) {
      filtered = filtered.filter(s => s.service_id === filterService);
    }

    // Filter by marked status
    if (filterMarked !== null) {
      filtered = filtered.filter(s => s.marked === filterMarked);
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

      filtered = filtered.filter(s => new Date(s.created_at) >= startDate);
    }

    return filtered;
  }, [sessions, searchTerm, filterService, filterMarked, filterDateRange]);

  // Calculate statistics
  const stats: SessionStats = useMemo(() => {
    const filtered = filteredSessions;
    const marked = filtered.filter(s => s.marked);
    const active = filtered.filter(s => !s.ended_at);
    const ended = filtered.filter(s => s.ended_at);

    const durations = ended
      .filter(s => s.ended_at)
      .map(s => (new Date(s.ended_at!).getTime() - new Date(s.created_at).getTime()) / 1000);

    return {
      totalSessions: filtered.length,
      markedSessions: marked.length,
      activeSessions: active.length,
      endedSessions: ended.length,
      avgSessionDuration: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      totalConsultations: filtered.reduce((sum, s) => sum + (s.tokens_count || 0), 0)
    };
  }, [filteredSessions]);

  const getSessionDuration = (session: SessionLog): string => {
    const endTime = session.ended_at ? new Date(session.ended_at) : new Date();
    const startTime = new Date(session.created_at);
    const diff = (endTime.getTime() - startTime.getTime()) / 1000;

    if (diff < 60) return `${Math.round(diff)}s`;
    if (diff < 3600) return `${Math.round(diff / 60)}m`;
    return `${Math.round(diff / 3600)}h`;
  };

  const downloadSessionReport = async () => {
    try {
      const rows = filteredSessions.map(s => ({
        "Session ID": s.session_id,
        "Service": services?.find(srv => srv.id === s.service_id)?.name || s.service_id,
        "Staff": s.staff_name,
        "Status": s.ended_at ? "Ended" : "Active",
        "Marked": s.marked ? "Yes" : "No",
        "Consultations": s.tokens_count,
        "Created": new Date(s.created_at).toLocaleString(),
        "Ended": s.ended_at ? new Date(s.ended_at).toLocaleString() : "-",
        "Duration": getSessionDuration(s),
        "Marked At": s.marked_at ? new Date(s.marked_at).toLocaleString() : "-"
      }));

      const header = ["Session ID", "Service", "Staff", "Status", "Marked", "Consultations", "Created", "Ended", "Duration", "Marked At"];
      const csv = [header.join(",")].concat(rows.map(row => header.map(h => `"${String(row[h as keyof typeof row] ?? '')}"`).join(","))).join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sessions_report_${new Date().toISOString().split("T")[0]}.csv`;
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
          <p className="text-neutral-600">Loading sessions...</p>
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
              <h1 className="text-2xl font-bold text-neutral-900">Session History</h1>
              <p className="text-sm text-neutral-600">Complete log of all consultancy sessions with data and timestamps</p>
            </div>
            <Button
              size="sm"
              className="gap-2"
              onClick={downloadSessionReport}
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
                placeholder="Search session ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>

            <div className="flex flex-wrap gap-2">
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
                    <Bookmark className="h-4 w-4" />
                    {filterMarked === null ? "Marked" : filterMarked ? "Marked Only" : "Unmarked Only"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setFilterMarked(null)}>
                    All Sessions
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterMarked(true)}>
                    <Bookmark className="h-4 w-4 mr-2" />
                    Marked
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterMarked(false)}>
                    Unmarked
                  </DropdownMenuItem>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card className="p-6 border-blue-200 bg-gradient-to-br from-blue-50 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 font-medium">Total Sessions</p>
                <p className="text-3xl font-bold text-neutral-900 mt-2">{stats.totalSessions}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border-purple-200 bg-gradient-to-br from-purple-50 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 font-medium">Marked Sessions</p>
                <p className="text-3xl font-bold text-neutral-900 mt-2">{stats.markedSessions}</p>
                <p className="text-xs text-neutral-500 mt-1">for audit</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Bookmark className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border-green-200 bg-gradient-to-br from-green-50 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 font-medium">Active Sessions</p>
                <p className="text-3xl font-bold text-neutral-900 mt-2">{stats.activeSessions}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border-orange-200 bg-gradient-to-br from-orange-50 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 font-medium">Avg Duration</p>
                <p className="text-3xl font-bold text-neutral-900 mt-2">
                  {stats.avgSessionDuration < 60 
                    ? `${Math.round(stats.avgSessionDuration)}s` 
                    : `${Math.round(stats.avgSessionDuration / 60)}m`}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border-cyan-200 bg-gradient-to-br from-cyan-50 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 font-medium">Total Consultations</p>
                <p className="text-3xl font-bold text-neutral-900 mt-2">{stats.totalConsultations}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-cyan-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-cyan-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Session Logs Table */}
        <div>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            Session Logs ({filteredSessions.length})
          </h2>

          {filteredSessions.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="h-16 w-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-neutral-400" />
              </div>
              <p className="text-neutral-600 font-medium">No sessions found</p>
              <p className="text-sm text-neutral-500 mt-1">Try adjusting your filters</p>
            </Card>
          ) : (
            <div className="space-y-3 overflow-x-auto">
              {/* Desktop Table */}
              <div className="hidden md:block border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-neutral-100 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700">Session ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700">Service</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700">Staff</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700">Consultations</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700">Duration</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700">Marked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredSessions.map(session => (
                      <tr key={session.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-4 py-3">
                          <code className="text-xs font-mono bg-neutral-100 px-2 py-1 rounded text-neutral-700">
                            {session.session_id.substring(0, 12)}...
                          </code>
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-700">
                          {services?.find(s => s.id === session.service_id)?.name || session.service_id}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-700">
                          {session.staff_name}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            session.ended_at 
                              ? "bg-gray-100 text-gray-700" 
                              : "bg-green-100 text-green-700"
                          }`}>
                            <span className={`h-2 w-2 rounded-full ${session.ended_at ? "bg-gray-400" : "bg-green-500"}`}></span>
                            {session.ended_at ? "Ended" : "Active"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-neutral-700">
                          {session.tokens_count || 0}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-700 font-mono">
                          {getSessionDuration(session)}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-600">
                          {new Date(session.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {session.marked ? (
                            <div className="flex items-center gap-1.5">
                              <Bookmark className="h-4 w-4 text-purple-600" />
                              <span className="text-purple-600 font-medium">Yes</span>
                            </div>
                          ) : (
                            <span className="text-neutral-500">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {filteredSessions.map(session => (
                  <Card key={session.id} className="p-4 border border-neutral-200">
                    <div className="space-y-3">
                      {/* Session ID & Status */}
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs text-neutral-500 font-medium uppercase">Session</p>
                          <code className="text-xs font-mono bg-neutral-100 px-2 py-1 rounded text-neutral-700 mt-1 inline-block">
                            {session.session_id.substring(0, 12)}...
                          </code>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          session.ended_at 
                            ? "bg-gray-100 text-gray-700" 
                            : "bg-green-100 text-green-700"
                        }`}>
                          <span className={`h-2 w-2 rounded-full ${session.ended_at ? "bg-gray-400" : "bg-green-500"}`}></span>
                          {session.ended_at ? "Ended" : "Active"}
                        </span>
                      </div>

                      {/* Service & Staff */}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                        <div>
                          <p className="text-xs text-neutral-500 font-medium">Service</p>
                          <p className="text-sm font-medium text-neutral-700 mt-1">
                            {services?.find(s => s.id === session.service_id)?.name || session.service_id}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-500 font-medium">Staff</p>
                          <p className="text-sm font-medium text-neutral-700 mt-1">
                            {session.staff_name}
                          </p>
                        </div>
                      </div>

                      {/* Duration & Consultations */}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                        <div>
                          <p className="text-xs text-neutral-500 font-medium">Duration</p>
                          <p className="text-sm font-mono font-bold text-neutral-700 mt-1">
                            {getSessionDuration(session)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-500 font-medium">Consultations</p>
                          <p className="text-sm font-bold text-neutral-700 mt-1">
                            {session.tokens_count || 0}
                          </p>
                        </div>
                      </div>

                      {/* Created & Marked */}
                      <div className="pt-2 border-t space-y-2">
                        <div>
                          <p className="text-xs text-neutral-500 font-medium">Created</p>
                          <p className="text-xs font-mono text-neutral-700 mt-1">
                            {new Date(session.created_at).toLocaleString()}
                          </p>
                        </div>
                        {session.ended_at && (
                          <div>
                            <p className="text-xs text-neutral-500 font-medium">Ended</p>
                            <p className="text-xs font-mono text-neutral-700 mt-1">
                              {new Date(session.ended_at).toLocaleString()}
                            </p>
                          </div>
                        )}
                        {session.marked && (
                          <div className="flex items-center gap-1.5 pt-2 border-t">
                            <Bookmark className="h-4 w-4 text-purple-600" />
                            <span className="text-xs font-medium text-purple-600">
                              Marked on {session.marked_at ? new Date(session.marked_at).toLocaleString() : "—"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
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

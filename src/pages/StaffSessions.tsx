import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Check, X, Copy, Calendar, Clock, CheckCircle2,
  Filter, Search, LogOut
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

interface Session {
  id?: number;
  session_id: string;
  service_id: string;
  staff_id: string;
  marked: boolean;
  marked_at: string | null;
  created_at: string;
  ended_at: string | null;
}

interface Service {
  id: string;
  name: string;
}

export default function StaffSessions() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [services, setServices] = useState<Record<string, string>>({});
  const [filterService, setFilterService] = useState<string>("");
  const [filterMarked, setFilterMarked] = useState<"all" | "marked" | "unmarked">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [serviceList, setServiceList] = useState<Service[]>([]);

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
      await loadData();
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const loadData = async () => {
    try {
      // Load services
      const { data: servicesData, error: servicesError } = await supabase
        .from("services")
        .select("id, name");

      if (servicesError) throw servicesError;
      setServiceList(servicesData || []);
      const serviceMap: Record<string, string> = {};
      (servicesData || []).forEach(s => {
        serviceMap[s.id] = s.name;
      });
      setServices(serviceMap);

      // Load sessions (with fallback if sessions table missing)
      try {
        const { data: sessionsData, error: sessionsError } = await supabase
          .from("sessions")
          .select("*")
          .order("created_at", { ascending: false });

        if (sessionsError) throw sessionsError;
        setSessions(sessionsData || []);
      } catch (se: any) {
        console.warn("Sessions table load error:", se);
        const msg = se?.message || se?.toString() || "";
        if (se?.code === "PGRST205" || /Could not find the table \'public\.sessions\'/.test(msg)) {
          toast.warn("Sessions table not found; deriving sessions from tokens as fallback.");
          try {
            const { data: tokens, error: tokensError } = await supabase
              .from("tokens")
              .select("id, service_id, staff_id, created_at, started_at, ended_at")
              .order("created_at", { ascending: false });

            if (tokensError) throw tokensError;

            const groups: Record<string, any[]> = {};
            (tokens || []).forEach((t: any) => {
              const day = new Date(t.created_at).toISOString().split("T")[0];
              const key = `${t.staff_id || 'unknown'}|${t.service_id || 'unknown'}|${day}`;
              groups[key] = groups[key] || [];
              groups[key].push(t);
            });

            const derived: Session[] = Object.keys(groups).map((k, idx) => {
              const parts = k.split("|");
              const staff_id = parts[0] === 'unknown' ? '' : parts[0];
              const service_id = parts[1] === 'unknown' ? '' : parts[1];
              const tokensArr = groups[k];
              const created_at = tokensArr.reduce((a: string, b: any) => a < b.created_at ? a : b.created_at, tokensArr[0].created_at);
              const ended_at = tokensArr.reduce((a: string | null, b: any) => {
                if (!b.ended_at) return a;
                if (!a) return b.ended_at;
                return a > b.ended_at ? a : b.ended_at;
              }, null);

              return {
                session_id: `DERIVED-${staff_id || 'anon'}-${service_id || 'svc'}-${created_at.split('T')[0]}`,
                service_id: service_id,
                staff_id: staff_id,
                marked: false,
                marked_at: null,
                created_at,
                ended_at,
              } as Session;
            }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            setSessions(derived);
          } catch (inner) {
            console.error("Failed to build sessions fallback from tokens:", inner);
            toast.error("Failed to load sessions");
          }
        } else {
          throw se;
        }
      }
    } catch (e: any) {
      console.error("Error loading data:", e);
      toast.error("Failed to load sessions");
    }
  };

  const handleMarkToggle = async (sessionId: string, currentMarked: boolean) => {
    try {
      const { error } = await supabase
        .from("sessions")
        .update({
          marked: !currentMarked,
          marked_at: !currentMarked ? new Date().toISOString() : null,
        })
        .eq("session_id", sessionId);

      if (error) throw error;
      
      // Update local state
      setSessions(sessions.map(s =>
        s.session_id === sessionId
          ? {
              ...s,
              marked: !currentMarked,
              marked_at: !currentMarked ? new Date().toISOString() : null,
            }
          : s
      ));

      toast.success(!currentMarked ? "Session marked" : "Session unmarked");
    } catch (e: any) {
      toast.error("Failed to update session");
    }
  };

  const handleCreateSession = async (serviceId: string) => {
    if (!serviceId) {
      toast.error("Please select a service");
      return;
    }

    try {
      const sessionId = `SES-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const { error } = await supabase.from("sessions").insert({
        session_id: sessionId,
        service_id: serviceId,
        staff_id: user?.id,
      });

      if (error) throw error;

      toast.success(`Session created: ${sessionId}`, {
        action: {
          label: "Copy",
          onClick: () => {
            navigator.clipboard.writeText(sessionId);
            toast.success("Session ID copied!");
          }
        }
      });

      await loadData();
    } catch (e: any) {
      toast.error("Failed to create session: " + e.message);
    }
  };

  const handleEndSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from("sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("session_id", sessionId);

      if (error) throw error;
      
      setSessions(sessions.map(s =>
        s.session_id === sessionId
          ? { ...s, ended_at: new Date().toISOString() }
          : s
      ));

      toast.success("Session ended");
    } catch (e: any) {
      toast.error("Failed to end session");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const filteredSessions = sessions.filter(session => {
    if (filterService && session.service_id !== filterService) return false;
    if (filterMarked === "marked" && !session.marked) return false;
    if (filterMarked === "unmarked" && session.marked) return false;
    if (searchTerm && !session.session_id.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

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
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 md:px-6 md:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/staff")}
                className="hover:bg-neutral-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-neutral-900">
                  Session Management
                </h1>
                <p className="text-sm text-neutral-500 mt-1">
                  Manage and track all your working sessions
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                supabase.auth.signOut();
                navigate("/staff/login");
              }}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 md:px-6 md:py-8">
        {/* Create New Session Card */}
        <Card className="mb-8 border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-blue-50">
          <div className="p-6">
            <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Create New Session
            </h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                onChange={(e) => handleCreateSession(e.target.value)}
                value=""
                className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a service to start session...</option>
                {serviceList.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Filters */}
        <Card className="mb-6 border-neutral-200">
          <div className="p-6">
            <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Service
                </label>
                <select
                  value={filterService}
                  onChange={(e) => setFilterService(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Services</option>
                  {serviceList.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Status
                </label>
                <select
                  value={filterMarked}
                  onChange={(e) => setFilterMarked(e.target.value as any)}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Sessions</option>
                  <option value="marked">Marked Only</option>
                  <option value="unmarked">Unmarked Only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  <Search className="h-4 w-4 inline mr-2" />
                  Search
                </label>
                <Input
                  placeholder="Search by session ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Sessions List */}
        {filteredSessions.length === 0 ? (
          <Card className="border-neutral-200 text-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-16 w-16 rounded-full bg-neutral-100 flex items-center justify-center">
                <Clock className="h-8 w-8 text-neutral-400" />
              </div>
              <p className="text-neutral-600 font-medium">No sessions found</p>
              <p className="text-sm text-neutral-500">
                {sessions.length === 0
                  ? "Create a new session to get started"
                  : "Try adjusting your filters"}
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredSessions.map((session) => (
              <Card
                key={session.session_id}
                className={`border-2 transition-all duration-200 ${
                  session.marked
                    ? "border-green-300 bg-green-50"
                    : "border-neutral-200 hover:border-neutral-300 hover:shadow-md"
                }`}
              >
                <div className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Session Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-3">
                        <code className="text-lg md:text-xl font-mono font-bold text-neutral-900 break-all">
                          {session.session_id}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(session.session_id)}
                          className="flex-shrink-0"
                        >
                          <Copy className="h-4 w-4 text-neutral-500" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-neutral-600">
                          <span className="font-medium">Service:</span>
                          <span>{services[session.service_id] || "Unknown"}</span>
                        </div>

                        <div className="flex items-center gap-2 text-neutral-600">
                          <Calendar className="h-4 w-4 flex-shrink-0" />
                          <span>
                            {new Date(session.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-neutral-600">
                          <Clock className="h-4 w-4 flex-shrink-0" />
                          <span>
                            Started: {new Date(session.created_at).toLocaleTimeString()}
                          </span>
                        </div>

                        {session.ended_at && (
                          <div className="flex items-center gap-2 text-neutral-600">
                            <X className="h-4 w-4 flex-shrink-0 text-red-500" />
                            <span>
                              Ended: {new Date(session.ended_at).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                      </div>

                      {session.marked && session.marked_at && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-green-700 bg-green-100 px-3 py-2 rounded-lg">
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                          <span>
                            Marked on {new Date(session.marked_at).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                      <Button
                        variant={session.marked ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleMarkToggle(session.session_id, session.marked)}
                        className={
                          session.marked
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : ""
                        }
                      >
                        {session.marked ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Marked
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Mark
                          </>
                        )}
                      </Button>

                      {!session.ended_at && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEndSession(session.session_id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        >
                          <X className="h-4 w-4 mr-2" />
                          End
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Stats Footer */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-neutral-900">
              {sessions.length}
            </div>
            <div className="text-xs text-neutral-500 mt-1">Total Sessions</div>
          </Card>

          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {sessions.filter(s => s.marked).length}
            </div>
            <div className="text-xs text-neutral-500 mt-1">Marked</div>
          </Card>

          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {sessions.filter(s => !s.ended_at).length}
            </div>
            <div className="text-xs text-neutral-500 mt-1">Active</div>
          </Card>

          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-neutral-600">
              {sessions.filter(s => s.ended_at).length}
            </div>
            <div className="text-xs text-neutral-500 mt-1">Ended</div>
          </Card>
        </div>
      </main>
    </div>
  );
}

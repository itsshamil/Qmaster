import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Html5QrcodeScanner } from "html5-qrcode";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  useServices, useTokens, useStaff, useUpdateToken, useToggleStaffAvailability, useRealtimeSync,
  type Service, type Token
} from "@/hooks/useQueue";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  LogOut, PhoneCall, CheckCircle, Users, QrCode, Play, Clock, LayoutGrid, Download,
  Menu, X, ChevronRight, MoreVertical, AlertCircle, PauseCircle, PlayCircle, User,
  Plus, Trash2, Edit3, Save, FileText, Settings, TrendingUp, BarChart3
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function StaffDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeService, setActiveService] = useState<string | null>(null);

  // Token Management State
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [editingToken, setEditingToken] = useState<Token | null>(null);
  const [tokenFormData, setTokenFormData] = useState({ token_number: "", status: "waiting" });

  // Session Management State (removed - now on dedicated page)
  // Daily Limit State
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [limitFormData, setLimitFormData] = useState<Record<string, number>>({});

  useRealtimeSync();

  const { data: services } = useServices();
  const { data: allTokens } = useTokens();
  const { data: staffList } = useStaff();
  const updateToken = useUpdateToken();
  const toggleAvailability = useToggleStaffAvailability();

  const [pauseStates, setPauseStates] = useState<Record<string, { is_paused: boolean; comment: string; editing: boolean }>>({});

  useEffect(() => {
    if (!services) return;
    const map: Record<string, { is_paused: boolean; comment: string; editing: boolean }> = {};
    services.forEach(s => {
      map[s.id] = { is_paused: (s as any).is_paused || false, comment: (s as any).pause_comment || "", editing: false };
    });
    setPauseStates(map);

    // Initialize limit form data
    const limitMap: Record<string, number> = {};
    services.forEach(s => {
      limitMap[s.id] = (s as any).daily_limit || 100;
    });
    setLimitFormData(limitMap);
  }, [services]);

  // Token Management Functions
  const handleAddToken = async (serviceId: string) => {
    if (!tokenFormData.token_number) {
      toast.error("Please enter a token number");
      return;
    }

    try {
      const { error } = await supabase.from("tokens").insert({
        token_number: parseInt(tokenFormData.token_number),
        service_id: serviceId,
        status: tokenFormData.status,
        estimated_wait: 0,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
      toast.success("Token added successfully");
      setTokenFormData({ token_number: "", status: "waiting" });
      setShowTokenDialog(false);
    } catch (e: any) {
      toast.error("Failed to add token: " + (e.message || "Unknown error"));
    }
  };

  const handleEditToken = async (tokenId: string) => {
    if (!tokenFormData.token_number) {
      toast.error("Please enter a token number");
      return;
    }

    try {
      const { error } = await supabase
        .from("tokens")
        .update({
          token_number: parseInt(tokenFormData.token_number),
          status: tokenFormData.status,
        })
        .eq("id", tokenId);

      if (error) throw error;
      toast.success("Token updated successfully");
      setEditingToken(null);
      setTokenFormData({ token_number: "", status: "waiting" });
      setShowTokenDialog(false);
    } catch (e: any) {
      toast.error("Failed to update token: " + (e.message || "Unknown error"));
    }
  };

  const handleDeleteToken = async (tokenId: string) => {
    toast.warning("Delete token?", {
      description: "This action cannot be undone",
      action: {
        label: "Confirm",
        onClick: async () => {
          try {
            const { error } = await supabase.from("tokens").delete().eq("id", tokenId);
            if (error) throw error;
            toast.success("Token deleted successfully");
          } catch (e: any) {
            toast.error("Failed to delete token: " + (e.message || "Unknown error"));
          }
        }
      }
    });
  };

  // Session Management Functions (moved to StaffSessions page)
  const generateSessionId = () => {
    return `SES-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  };

  // Daily Limit Management
  const handleUpdateDailyLimit = async (serviceId: string) => {
    const newLimit = limitFormData[serviceId];
    if (!newLimit || newLimit < 1) {
      toast.error("Daily limit must be at least 1");
      return;
    }

    try {
      const { error } = await supabase
        .from("services")
        .update({ daily_limit: newLimit })
        .eq("id", serviceId);

      if (error) throw error;
      toast.success("Daily limit updated successfully");
    } catch (e: any) {
      toast.error("Failed to update daily limit: " + (e.message || "Unknown error"));
    }
  };

  // PDF Export Function
  const exportToPDF = async (serviceId: string, opts: { todayOnly?: boolean }) => {
    try {
      let q = supabase
        .from("tokens")
        .select("token_number,service_id,status,created_at,started_at,ended_at,customer_id,profiles:customer_id(full_name,email,masked_name)")
        .eq("service_id", serviceId)
        .order("created_at", { ascending: true });

      if (opts.todayOnly) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        q = q.gte("created_at", todayStart.toISOString());
      }

      const { data, error } = await q;
      if (error) throw error;

      const doc = new jsPDF();
      const service = services?.find(s => s.id === serviceId);
      const pageTitle = `${service?.name || "Service"} - Token Report`;
      const timestamp = new Date().toLocaleString();

      // Title and metadata
      doc.setFontSize(16);
      doc.text(pageTitle, 14, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${timestamp}`, 14, 30);
      if (opts.todayOnly) {
        doc.text(`Period: Today`, 14, 37);
      }

      // Table data
      const rows = (data || []).map((r: any) => {
        const waitTime = r.started_at ? Math.round((new Date(r.started_at).getTime() - new Date(r.created_at).getTime()) / 1000) : 0;
        return [
          r.token_number,
          r.status.toUpperCase(),
          new Date(r.created_at).toLocaleTimeString(),
          r.started_at ? new Date(r.started_at).toLocaleTimeString() : "-",
          r.ended_at ? new Date(r.ended_at).toLocaleTimeString() : "-",
          `${waitTime}s`,
          r.profiles?.full_name || r.profiles?.masked_name || "-",
        ];
      });

      autoTable(doc, {
        startY: 45,
        head: [["Token #", "Status", "Created", "Started", "Ended", "Wait Time", "Customer"]],
        body: rows,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });

      // Summary
      const completed = rows.filter(r => r[1] === "COMPLETED").length;
      const cancelled = rows.filter(r => r[1] === "CANCELLED").length;
      const waiting = rows.filter(r => r[1] === "WAITING").length;

      const finalY = (doc as any).lastAutoTable.finalY || 45;
      doc.setFontSize(10);
      doc.text(`Summary: ${completed} Completed | ${cancelled} Cancelled | ${waiting} Waiting`, 14, finalY + 15);

      doc.save(`tokens_${serviceId}_${opts.todayOnly ? 'today' : 'all'}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("PDF exported successfully");
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to export PDF: " + (e.message || "Unknown error"));
    }
  };

  const loadSessions = async (serviceId: string) => {
    // Removed - now managed on dedicated /staff/sessions page
  };

  const markSession = async (sessionId: string, marked: boolean) => {
    // Removed - now managed on dedicated /staff/sessions page
  };

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

      if (error) {
        console.error("Staff query error:", error);
        toast.error("Error checking staff status. Please contact admin.");
        await supabase.auth.signOut();
        navigate("/staff/login");
        return;
      }

      if (!staffData) {
        toast.error("Staff record not found. Please sign up as staff first.");
        await supabase.auth.signOut();
        navigate("/staff/login");
        return;
      }

      setUser(session.user);
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    let timerId: any = null;
    let cameraStream: MediaStream | null = null;

    const initScanner = async () => {
      if (showScanner) {
        // Double check permissions first to avoid silent failures
        try {
          cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (err: any) {
          console.error("Camera permission error:", err);
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            toast.error("Camera access denied. Please enable camera permissions in your browser settings.");
          } else {
            toast.error("Could not access camera: " + err.message);
          }
          setShowScanner(false);
          return;
        }

        timerId = setTimeout(() => {
          const element = document.getElementById("reader");
          if (!element) return;

          scanner = new Html5QrcodeScanner("reader", {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
            showTorchButtonIfSupported: true,
            rememberLastUsedCamera: true,
          }, false);

          scanner.render(async (decodedText) => {
            // Parse Token ID from URL or Legacy format
            let tokenId = null;
            if (decodedText.startsWith("TOKEN:")) {
              tokenId = decodedText.split("TOKEN:")[1];
            } else {
              // Look for UUID in URL (e.g., .../queue/uuid)
              const uuidMatch = decodedText.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
              if (uuidMatch) tokenId = uuidMatch[0];
            }

            if (tokenId) {
              // Find token in pre-loaded list or fetch from DB
              let token = allTokens?.find(t => t.id === tokenId);

              if (!token) {
                // Try fetching from database directly if not in current view
                const { data } = await supabase
                  .from("tokens")
                  .select("*, services(name)")
                  .eq("id", tokenId)
                  .maybeSingle();
                if (data) token = data as any;
              }

              if (token) {
                scanner?.clear();
                setShowScanner(false);

                if (token.status === 'waiting') {
                  toast.success(`Scanned Ticket #${token.token_number}`, {
                    description: `Status: Waiting for ${token.services?.name || 'Service'}`,
                    action: {
                      label: 'Start Serving',
                      onClick: async () => {
                        await updateToken.mutateAsync({
                          id: token!.id,
                          status: "serving",
                          started_at: new Date().toISOString(),
                          staff_id: user?.id
                        });
                        toast.success(`Now serving #${token!.token_number}`);
                      }
                    }
                  });
                } else if (token.status === 'serving') {
                  toast.info(`Scanned Ticket #${token.token_number}`, {
                    description: "This ticket is currently being served.",
                    action: {
                      label: 'Mark Completed',
                      onClick: async () => {
                        await updateToken.mutateAsync({
                          id: token!.id,
                          status: "completed",
                          ended_at: new Date().toISOString()
                        });
                        toast.success(`Ticket #${token!.token_number} completed`);
                      }
                    }
                  });
                } else {
                  toast.info(`Ticket #${token.token_number}`, {
                    description: `This ticket is already ${token.status}.`
                  });
                }
              } else {
                toast.error("Invalid QR Code", {
                  description: "The scanned token could not be found."
                });
              }
            } else {
              toast.error("Unrecognized Format", {
                description: "This QR code doesn't look like a valid ticket."
              });
            }
          }, (errorMessage) => {
            // Silent error for scanner frame fails
          });
        }, 300);
      }
    };

    initScanner();

    return () => {
      if (timerId) clearTimeout(timerId);
      if (scanner) {
        try { scanner.clear(); } catch (e) { }
      }
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [showScanner, allTokens, updateToken, user]);

  const currentStaff = useMemo(() => staffList?.find((s) => s.id === user?.id), [staffList, user]);

  const tokensByService = useMemo(() => {
    const map: Record<string, typeof allTokens> = {};
    (services || []).forEach(s => { map[s.id] = []; });
    (allTokens || []).forEach(t => {
      if (!map[t.service_id]) map[t.service_id] = [];
      map[t.service_id].push(t);
    });
    Object.keys(map).forEach(k => {
      map[k].sort((a: any, b: any) => (a.token_number || 0) - (b.token_number || 0));
    });
    return map;
  }, [allTokens, services]);

  const nextTokenMap = useMemo(() => {
    const map: Record<string, any> = {};
    Object.keys(tokensByService || {}).forEach(sid => {
      const waiting = (tokensByService[sid] || []).filter((t: any) => t.status === 'waiting');
      map[sid] = waiting.length ? waiting[0] : null;
    });
    return map;
  }, [tokensByService]);

  const handleCallNext = async (serviceId: string) => {
    if ((pauseStates[serviceId]?.is_paused)) {
      toast.error("Queue is paused", {
        description: pauseStates[serviceId].comment || "Please resume the queue to call next ticket"
      });
      return;
    }

    const waiting = (tokensByService[serviceId] || []).filter((t: any) => t.status === 'waiting');
    if (!waiting.length) {
      toast.info("No tickets waiting");
      return;
    }
    const next = waiting[0];
    await updateToken.mutateAsync({
      id: next.id,
      status: "serving",
      started_at: new Date().toISOString(),
      staff_id: user?.id
    });
    toast.success(`Called #${next.token_number}`, {
      description: "Ticket is now being served"
    });
  };

  const handleEndSession = async (serviceId: string) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const waitingCount = (tokensByService[serviceId] || []).filter((t: any) => t.status === 'waiting').length;

    toast.warning(`End session?`, {
      description: `This will cancel ${waitingCount} waiting tickets`,
      action: {
        label: 'Confirm',
        onClick: async () => {
          try {
            const { error } = await supabase
              .from('tokens')
              .update({ status: 'cancelled', ended_at: new Date().toISOString() })
              .eq('service_id', serviceId)
              .in('status', ['waiting'])
              .gte('created_at', todayStart.toISOString());
            if (error) throw error;
            toast.success('Session ended', {
              description: `${waitingCount} waiting tickets cancelled`
            });
          } catch (e) {
            console.error(e);
            toast.error('Failed to end session');
          }
        }
      },
    });
  };

  const handleStartSession = async (serviceId: string) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const servingCount = (tokensByService[serviceId] || []).filter((t: any) => t.status === 'serving').length;
    const waitingCount = (tokensByService[serviceId] || []).filter((t: any) => t.status === 'waiting').length;

    toast.warning(`Start new session?`, {
      description: `This will complete ${servingCount} serving tickets and cancel ${waitingCount} waiting tickets`,
      action: {
        label: 'Proceed',
        onClick: async () => {
          try {
            // Complete serving tokens
            const { error: e1 } = await supabase
              .from('tokens')
              .update({ status: 'completed', ended_at: new Date().toISOString() })
              .eq('service_id', serviceId)
              .eq('status', 'serving')
              .gte('created_at', todayStart.toISOString());
            if (e1) throw e1;

            // Cancel waiting tokens
            const { error: e2 } = await supabase
              .from('tokens')
              .update({ status: 'cancelled', ended_at: new Date().toISOString() })
              .eq('service_id', serviceId)
              .eq('status', 'waiting')
              .gte('created_at', todayStart.toISOString());
            if (e2) throw e2;

            toast.success('New session started');
          } catch (e) {
            console.error(e);
            toast.error('Failed to start new session');
          }
        }
      },
    });
  };

  const downloadCSV = async (serviceId: string, opts: { todayOnly?: boolean, lifetime?: boolean }) => {
    try {
      let q = supabase
        .from('tokens')
        .select('token_number,service_id,status,created_at,started_at,ended_at,customer_id,profiles:customer_id(full_name,email,masked_name)')
        .eq('service_id', serviceId)
        .order('created_at', { ascending: true });

      if (opts.todayOnly) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        q = q.gte('created_at', todayStart.toISOString());
      }

      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []).map((r: any) => ({
        token_number: r.token_number,
        status: r.status,
        created_at: r.created_at,
        started_at: r.started_at,
        ended_at: r.ended_at,
        full_name: r.profiles?.full_name || r.profiles?.masked_name || '',
        email: r.profiles?.email || '',
        waited_seconds: r.started_at ? (new Date(r.started_at).getTime() - new Date(r.created_at).getTime()) / 1000 : ''
      }));

      const header = ['token_number', 'status', 'created_at', 'started_at', 'ended_at', 'full_name', 'email', 'waited_seconds'];
      const csv = [header.join(',')].concat(rows.map((row: any) => header.map(h => `"${String(row[h] ?? '')}"`).join(','))).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tokens_${serviceId}_${opts.todayOnly ? 'today' : 'lifetime'}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('CSV download started');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate CSV');
    }
  };

  const updateServicePause = async (serviceId: string, is_paused: boolean, comment?: string) => {
    try {
      const updates: any = { is_paused };
      if (typeof comment !== 'undefined') updates.pause_comment = comment;
      const { error } = await supabase.from('services').update(updates).eq('id', serviceId);
      if (error) throw error;
      toast.success(is_paused ? 'Queue paused' : 'Queue resumed');
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to update queue state');
    }
  };

  const handleTogglePause = async (serviceId: string) => {
    const prev = pauseStates[serviceId];
    if (!prev) return;
    const nextState = !prev.is_paused;
    setPauseStates(s => ({ ...s, [serviceId]: { ...prev, is_paused: nextState } }));
    await updateServicePause(serviceId, nextState, prev.comment);
  };

  const handleSaveComment = async (serviceId: string) => {
    const prev = pauseStates[serviceId];
    if (!prev) return;
    try {
      await updateServicePause(serviceId, prev.is_paused, prev.comment);
      setPauseStates(s => ({ ...s, [serviceId]: { ...prev, editing: false } }));
      toast.success('Comment saved');
    } catch (e) { }
  };

  const handleComplete = async (token: Token) => {
    await updateToken.mutateAsync({
      id: token.id,
      status: "completed",
      ended_at: new Date().toISOString()
    });
    toast.success(`Ticket #${token.token_number} completed`);
  };

  const getServiceStats = (service: Service) => {
    const sTokens = tokensByService[service.id] || [];
    return {
      waiting: sTokens.filter((t: any) => t.status === "waiting").length,
      serving: sTokens.filter((t: any) => t.status === "serving"),
      completed: sTokens.filter((t: any) => t.status === "completed").length,
      staff: staffList?.filter((s) => s.service_id === service.id && s.is_available).length || 0
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 font-sans">
      {/* Mobile Header */}
      <header className="bg-white border-b border-neutral-200 px-4 py-3 sticky top-0 z-50 md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-bold text-neutral-900 text-sm">Staff Portal</h1>
              <p className="text-[10px] text-neutral-500 truncate max-w-[150px]">
                {currentStaff?.name || user?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 relative"
              onClick={() => setShowScanner(!showScanner)}
            >
              <QrCode className="h-5 w-5" />
              {showScanner && (
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse"></span>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => toggleAvailability.mutate({
                  id: currentStaff?.id || '',
                  is_available: !currentStaff?.is_available
                })}>
                  {currentStaff?.is_available ? (
                    <>
                      <div className="h-2 w-2 rounded-full bg-neutral-400 mr-2"></div>
                      Set as Away
                    </>
                  ) : (
                    <>
                      <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                      Set as Online
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { supabase.auth.signOut(); navigate("/staff/login"); }}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Desktop Header */}
      <nav className="hidden md:block bg-white border-b border-neutral-200 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
              <LayoutGrid className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-bold text-neutral-900">Staff Dashboard</h1>
              <p className="text-xs text-neutral-500 flex items-center gap-2">
                <User className="h-3 w-3" />
                {currentStaff?.name || user?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-neutral-100 px-4 py-2 rounded-full">
                <div className={`h-2.5 w-2.5 rounded-full ${currentStaff?.is_available ? 'bg-green-500 animate-pulse' : 'bg-neutral-400'}`} />
                <span className="text-sm font-medium text-neutral-700">
                  {currentStaff?.is_available ? 'Active' : 'Away'}
                </span>
                <Switch
                  checked={currentStaff?.is_available}
                  onCheckedChange={(v) => toggleAvailability.mutate({ id: currentStaff?.id || '', is_available: v })}
                  className="scale-90"
                />
              </div>

              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowScanner(!showScanner)}
              >
                <QrCode className="h-4 w-4" />
                {showScanner ? "Close Scanner" : "Scan Ticket"}
              </Button>

              <Button
                variant="outline"
                className="gap-2"
                onClick={() => navigate("/staff/tokens")}
              >
                <BarChart3 className="h-4 w-4" />
                Tokens
              </Button>

              <Button
                variant="outline"
                className="gap-2"
                onClick={() => navigate("/staff/session-history")}
              >
                <FileText className="h-4 w-4" />
                Sessions
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => { supabase.auth.signOut(); navigate("/staff/login"); }}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="p-6 border-b">
            <SheetTitle className="text-left">Menu</SheetTitle>
          </SheetHeader>
          <div className="p-4">
            <div className="space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => setShowScanner(true)}
              >
                <QrCode className="h-4 w-4 mr-3" />
                Scan Ticket
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  navigate("/staff/tokens");
                  setMobileMenuOpen(false);
                }}
              >
                <BarChart3 className="h-4 w-4 mr-3" />
                Tokens Analytics
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  navigate("/staff/session-history");
                  setMobileMenuOpen(false);
                }}
              >
                <FileText className="h-4 w-4 mr-3" />
                Session History
              </Button>
              {services?.map(service => (
                <Button
                  key={service.id}
                  variant="ghost"
                  className="w-full justify-between"
                  onClick={() => {
                    setActiveService(service.id);
                    setMobileMenuOpen(false);
                    document.getElementById(`service-${service.id}`)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <span className="truncate">{service.name}</span>
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <main className="max-w-7xl mx-auto px-4 py-4 md:px-6 md:py-8">
        {/* Scanner Section */}
        {showScanner && (
          <Card className="mb-6 md:mb-8 border-2 border-blue-200 rounded-2xl overflow-hidden shadow-lg">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-bold text-lg">Scan Ticket QR Code</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={() => setShowScanner(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-4 bg-white">
              <div className="bg-black p-2 rounded-lg max-w-sm mx-auto">
                <div id="reader" className="w-full"></div>
              </div>
              <p className="text-center text-sm text-neutral-600 mt-3">
                Point camera at ticket QR code to scan
              </p>
            </div>
          </Card>
        )}

        {/* Service Cards Grid */}
        <div className="space-y-4 md:space-y-6">
          {services?.map((service) => {
            const stats = getServiceStats(service);
            const isPaused = pauseStates[service.id]?.is_paused;

            return (
              <Card
                key={service.id}
                id={`service-${service.id}`}
                className={`border rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg ${isPaused ? 'border-orange-300 bg-orange-50' : 'border-neutral-200'
                  }`}
              >
                {/* Service Header - Mobile Optimized */}
                <div className="p-4 md:p-6 border-b bg-white">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 md:gap-3 mb-2">
                        <h2 className="text-lg md:text-xl font-bold text-neutral-900 truncate">
                          {service.name}
                        </h2>
                        {isPaused && (
                          <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                            <PauseCircle className="h-3 w-3" />
                            Paused
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3 md:gap-4">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                          <span className="text-xs md:text-sm text-neutral-600 font-medium">
                            {stats.waiting} Waiting
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full bg-green-500"></div>
                          <span className="text-xs md:text-sm text-neutral-600 font-medium">
                            {stats.completed} Completed
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-neutral-500" />
                          <span className="text-xs md:text-sm text-neutral-600 font-medium">
                            {stats.staff} Staff
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Next Token & Call Button - Mobile Stacked */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                      <div className="flex items-center justify-between sm:justify-start gap-4 sm:gap-3 bg-neutral-50 p-3 rounded-xl">
                        <div>
                          <div className="text-xs text-neutral-500">Next</div>
                          <div className="text-2xl md:text-3xl font-mono font-bold text-neutral-900">
                            {nextTokenMap[service.id]?.token_number
                              ? String(nextTokenMap[service.id].token_number).padStart(3, '0')
                              : '—'
                            }
                          </div>
                        </div>
                        <Button
                          size="lg"
                          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 flex-1 sm:flex-none sm:px-6"
                          disabled={stats.waiting === 0 || isPaused}
                          onClick={() => handleCallNext(service.id)}
                        >
                          <PhoneCall className="h-5 w-5 mr-2" />
                          <span className="hidden sm:inline">Call Next</span>
                          <span className="sm:hidden">Call</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Bar - Mobile Bottom Sheet Style */}
                <div className="px-4 py-3 bg-neutral-50 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Queue Status</span>
                      <Button
                        variant={isPaused ? "default" : "outline"}
                        size="sm"
                        className={`gap-2 ${isPaused ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                        onClick={() => handleTogglePause(service.id)}
                      >
                        {isPaused ? (
                          <>
                            <PlayCircle className="h-4 w-4" />
                            Resume
                          </>
                        ) : (
                          <>
                            <PauseCircle className="h-4 w-4" />
                            Pause
                          </>
                        )}
                      </Button>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => handleStartSession(service.id)}>
                          <Play className="h-4 w-4 mr-2" />
                          Start New Session
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEndSession(service.id)}>
                          <AlertCircle className="h-4 w-4 mr-2" />
                          End Session
                        </DropdownMenuItem>
                        {/* <DropdownMenuItem onClick={() => navigate("/staff/sessions")}>
                          <FileText className="h-4 w-4 mr-2" />
                          Manage Sessions
                        </DropdownMenuItem> */}
                        {/* <DropdownMenuItem onClick={() => {
                          setShowTokenDialog(true);
                          setEditingToken(null);
                          setTokenFormData({ token_number: "", status: "waiting" });
                        }}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Token
                        </DropdownMenuItem> */}
                        <DropdownMenuItem onClick={() => {
                          setShowLimitDialog(true);
                        }}>
                          <TrendingUp className="h-4 w-4 mr-2" />
                          Set Daily Limit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportToPDF(service.id, { todayOnly: true })}>
                          <FileText className="h-4 w-4 mr-2" />
                          Export Today (PDF)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportToPDF(service.id, {})}>
                          <Download className="h-4 w-4 mr-2" />
                          Export All (PDF)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => downloadCSV(service.id, { todayOnly: true })}>
                          <Clock className="h-4 w-4 mr-2" />
                          Export Today (CSV)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => downloadCSV(service.id, { lifetime: true })}>
                          <Download className="h-4 w-4 mr-2" />
                          Export All (CSV)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Pause Comment Section */}
                {isPaused && (
                  <div className="px-4 py-3 bg-orange-50 border-b">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <span className="text-sm font-medium text-orange-800">Queue Paused</span>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={pauseStates[service.id]?.comment || ''}
                          onChange={(e) => setPauseStates(s => ({
                            ...s,
                            [service.id]: {
                              ...(s[service.id] || { is_paused: false, comment: '', editing: true }),
                              comment: e.target.value
                            }
                          }))}
                          placeholder="Reason for pause (visible to visitors)"
                          className="flex-1 text-sm"
                        />
                        <Button size="sm" onClick={() => handleSaveComment(service.id)}>
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Currently Serving Section */}
                <div className="p-4 md:p-6">
                  <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    Currently Serving ({stats.serving.length})
                  </h3>

                  {stats.serving.length === 0 ? (
                    <div className="text-center py-8 bg-neutral-50 rounded-xl">
                      <div className="h-12 w-12 bg-neutral-200 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Users className="h-6 w-6 text-neutral-400" />
                      </div>
                      <p className="text-neutral-500 text-sm">No tickets being served</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {stats.serving.map(token => (
                        <div
                          key={token.id}
                          className="bg-white border border-green-100 rounded-xl p-4 flex items-center justify-between shadow-sm"
                        >
                          <div>
                            <div className="text-2xl md:text-3xl font-mono font-bold text-neutral-900">
                              #{String(token.token_number).padStart(3, '0')}
                            </div>
                            <div className="text-xs text-neutral-500 mt-1">
                              Started at {new Date(token.started_at!).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                            onClick={() => handleComplete(token)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1.5" />
                            Complete
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Queue Preview */}
                {stats.waiting > 0 && (
                  <div className="px-4 py-3 bg-neutral-50 border-t">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-neutral-500 whitespace-nowrap">
                        Next in Line:
                      </span>
                      <div className="flex-1 overflow-x-auto">
                        <div className="flex gap-2 pb-2">
                          {(tokensByService[service.id] || [])
                            .filter((t: any) => t.status === 'waiting')
                            .slice(0, 8)
                            .map((t: any) => (
                              <div
                                key={t.id}
                                className="px-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-neutral-700 font-mono font-bold text-sm min-w-[60px] text-center"
                              >
                                #{t.token_number}
                              </div>
                            ))}
                          {stats.waiting > 8 && (
                            <div className="px-3 py-1.5 bg-neutral-200 rounded-lg text-neutral-600 text-sm font-medium">
                              +{stats.waiting - 8}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Mobile Call to Action */}
        <div className="fixed bottom-6 right-6 md:hidden z-40">
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-xl bg-blue-600 hover:bg-blue-700"
            onClick={() => {
              const firstService = services?.[0];
              if (firstService) handleCallNext(firstService.id);
            }}
          >
            <PhoneCall className="h-6 w-6" />
          </Button>
        </div>

        {/* Token Management Dialog */}
        <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingToken ? "Edit Token" : "Add Token"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Token Number</label>
                <Input
                  type="number"
                  value={tokenFormData.token_number}
                  onChange={(e) => setTokenFormData({ ...tokenFormData, token_number: e.target.value })}
                  placeholder="Enter token number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={tokenFormData.status}
                  onChange={(e) => setTokenFormData({ ...tokenFormData, status: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2"
                >
                  <option value="waiting">Waiting</option>
                  <option value="serving">Serving</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setShowTokenDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (editingToken) {
                      handleEditToken(editingToken.id);
                    } else {
                      handleAddToken(activeService || "");
                    }
                  }}
                >
                  {editingToken ? "Update" : "Add"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Daily Limit Dialog */}
        <Dialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Manage Daily Limits</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {services?.map((service) => (
                <div key={service.id} className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-700">
                    {service.name}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="1"
                      value={limitFormData[service.id] || 100}
                      onChange={(e) => setLimitFormData({
                        ...limitFormData,
                        [service.id]: parseInt(e.target.value) || 100
                      })}
                      placeholder="Daily token limit"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleUpdateDailyLimit(service.id)}
                    >
                      Save
                    </Button>
                  </div>
                  <div className="text-xs text-neutral-500">
                    Current limit: {limitFormData[service.id] || 100} tokens/day
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowLimitDialog(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
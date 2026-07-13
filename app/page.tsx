"use client";

import { useEffect, useState } from "react";

const fmtDate = (d: string | Date) => new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
}).format(new Date(d)).replace(',', '').replace(/am|pm/i, m => m.toUpperCase());
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Progress } from "@/components/ui/progress";
import { Folder, Activity, HardDrive, Cpu, Network, Menu, X, Key, Calendar, LayoutDashboard, LogOut, RefreshCw, Plus } from "lucide-react";
import axios from "axios";
import { motion, AnimatePresence } from "motion/react";

import Image from "next/image";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [videos, setVideos] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  
  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Import state
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Server stats state
  const [serverStats, setServerStats] = useState<any>(null);
  
  // Stream state
  const [selectedVideo, setSelectedVideo] = useState("");
  const [rtmpUrl, setRtmpUrl] = useState("rtmp://a.rtmp.youtube.com/live2");
  const [streamKey, setStreamKey] = useState("");
  const [broadcastId, setBroadcastId] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [selectedSavedKey, setSelectedSavedKey] = useState("");
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [youtubeAuthenticated, setYoutubeAuthenticated] = useState(false);

  // Create stream modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createScheduledTime, setCreateScheduledTime] = useState("");
  const [creatingStream, setCreatingStream] = useState(false);
  const [createThumbnail, setCreateThumbnail] = useState<string | null>(null);
  const [createThumbnailPreview, setCreateThumbnailPreview] = useState<string>("");
  const [createPrivacy, setCreatePrivacy] = useState<"private" | "unlisted" | "public">("private");
  const [createAutoStart, setCreateAutoStart] = useState(true);
  const [createAutoStop, setCreateAutoStop] = useState(false);
  const [createDvr, setCreateDvr] = useState(false);
  const [createLatency, setCreateLatency] = useState<"normal" | "low" | "ultraLow">("normal");
  const [modalRecentBroadcasts, setModalRecentBroadcasts] = useState<any[]>([]);
  const [selectedRecentForCopy, setSelectedRecentForCopy] = useState("");



  // Saved Keys state
  const [savedKeys, setSavedKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyRtmp, setNewKeyRtmp] = useState("rtmp://a.rtmp.youtube.com/live2");
  const [newKeyStream, setNewKeyStream] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  useEffect(() => {
    fetchUser();
    fetchStats();
    
    // Check for YouTube auth success
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'success') {
      checkYouTubeAuth();
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    const streamsInterval = setInterval(() => {
      fetchStreams();
      fetchVideos();
    }, 2000);

    return () => {
      clearInterval(streamsInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/system-stats");
      if (res.ok) {
        const data = await res.json();
        setServerStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch server stats", err);
    }
  };

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        fetchVideos();
        fetchStreams();
        fetchSavedKeys();
        checkYouTubeAuth();
      } else {
        router.push("/login");
      }
    } catch (err) {
      router.push("/login");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const fetchVideos = async () => {
    const res = await fetch("/api/videos");
    if (res.ok) {
      const data = await res.json();
      setVideos(data.videos);
    }
  };

  const fetchStreams = async () => {
    const res = await fetch("/api/streams");
    if (res.ok) {
      const data = await res.json();
      setStreams(data.streams);
    }
  };

  const fetchSavedKeys = async () => {
    const res = await fetch("/api/saved-keys");
    if (res.ok) {
      const data = await res.json();
      setSavedKeys(data.keys);
    }
  };

  const checkYouTubeAuth = async () => {
    const res = await fetch("/api/youtube/auth-status");
    if (res.ok) {
      const data = await res.json();
      setYoutubeAuthenticated(data.authenticated);
      if (data.authenticated) {
        fetchBroadcasts();
      }
    }
  };

  const fetchBroadcasts = async () => {
    const res = await fetch("/api/youtube/broadcasts");
    if (res.ok) {
      const data = await res.json();
      setBroadcasts(data.broadcasts || []);
    }
  };

  const loadModalRecentBroadcasts = async () => {
    if (!youtubeAuthenticated) {
      setModalRecentBroadcasts([]);
      return;
    }
    try {
      const [upcomingRes, liveRes, completedRes] = await Promise.all([
        fetch("/api/youtube/broadcasts?broadcastStatus=upcoming&maxResults=10"),
        fetch("/api/youtube/broadcasts?broadcastStatus=active&maxResults=10"),
        fetch("/api/youtube/broadcasts?broadcastStatus=completed&maxResults=10"),
      ]);
      const [upcoming, live, completed] = await Promise.all([
        upcomingRes.ok ? upcomingRes.json() : { broadcasts: [] },
        liveRes.ok ? liveRes.json() : { broadcasts: [] },
        completedRes.ok ? completedRes.json() : { broadcasts: [] },
      ]);
      const all = [
        ...(upcoming.broadcasts || []).map((b: any) => ({ ...b, _statusTag: 'UPCOMING' })),
        ...(live.broadcasts || []).map((b: any) => ({ ...b, _statusTag: 'LIVE' })),
        ...(completed.broadcasts || []).map((b: any) => ({ ...b, _statusTag: 'RECENT' })),
      ];
      const seen = new Set<string>();
      const deduped = all.filter((b: any) => {
        if (seen.has(b.id)) return false;
        seen.add(b.id);
        return true;
      });
      setModalRecentBroadcasts(deduped);
    } catch {
      setModalRecentBroadcasts([]);
    }
  };

  const handleYouTubeAuth = () => {
    window.location.href = "/api/youtube/auth";
  };

  const handleYouTubeDisconnect = async () => {
    try {
      const res = await fetch("/api/youtube/disconnect", { method: "POST" });
      if (res.ok) {
        setYoutubeAuthenticated(false);
        setBroadcasts([]);
        setBroadcastId("");
        toast.success("Disconnected from YouTube");
      } else {
        toast.error("Failed to disconnect");
      }
    } catch (error) {
      toast.error("Error disconnecting from YouTube");
    }
  };

  const handleCreateStream = async () => {
    if (!createTitle) {
      return toast.error("Title is required");
    }
    if (createTitle.length > 100) {
      return toast.error("Title must be 100 characters or less");
    }

    setCreatingStream(true);
    try {
      const res = await fetch("/api/youtube/create-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle,
          description: createDescription,
          scheduledStartTime: createScheduledTime || undefined,
          privacyStatus: createPrivacy,
          thumbnail: createThumbnail || undefined,
          enableAutoStart: createAutoStart,
          enableAutoStop: createAutoStop,
          enableDvr: createDvr,
          latencyPreference: createLatency,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success("YouTube stream created successfully");

        // Auto-populate schedule form
        setBroadcastId(data.broadcastId);
        setRtmpUrl(data.rtmpUrl);
        setStreamKey(data.streamKey);
        setScheduledFor(data.scheduledFor.replace('Z', '').slice(0, 16));

        setShowCreateModal(false);

        // Reset modal form
        setCreateTitle("");
        setCreateDescription("");
        setCreateScheduledTime("");
        setCreateThumbnail(null);
        setCreateThumbnailPreview("");
        setCreatePrivacy("private");
        setCreateAutoStart(true);
        setCreateAutoStop(false);
        setCreateDvr(false);
        setCreateLatency("normal");
        setSelectedRecentForCopy("");
        setModalRecentBroadcasts([]);

        if (data.thumbnailWarning) {
          toast.warning(data.thumbnailWarning);
        }

        // Optimistic insert + refresh
        const newBroadcast = {
          id: data.broadcastId,
          title: data.title,
          thumbnail: createThumbnailPreview || undefined,
          scheduledStartTime: data.scheduledFor,
        };
        setBroadcasts(prev => [newBroadcast, ...prev.filter(b => b.id !== data.broadcastId)]);
        fetchBroadcasts();
      } else {
        toast.error(data.error || "Failed to create stream");
      }
    } catch (error) {
      toast.error("An error occurred while creating the stream");
    } finally {
      setCreatingStream(false);
    }
  };

  const openCreateModal = () => {
    const dt = new Date(Date.now() + 30 * 60 * 1000);
    const defaultTime = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}T${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
    setCreateScheduledTime(defaultTime);
    setCreateTitle("My Live Stream");
    setCreateDescription("");
    setCreateThumbnail(null);
    setCreateThumbnailPreview("");
    setCreatePrivacy("private");
    setCreateAutoStart(true);
    setCreateAutoStop(false);
    setCreateDvr(false);
    setCreateLatency("normal");
    setSelectedRecentForCopy("");
    setModalRecentBroadcasts([]);
    setShowCreateModal(true);
    if (youtubeAuthenticated) {
      loadModalRecentBroadcasts();
    }
  };

  const handleSelectRecent = (id: string) => {
    const found = modalRecentBroadcasts.find((b: any) => b.id === id);
    if (!found) return;
    setCreateTitle(found.title || "My Live Stream");
    setCreateDescription(found.description || "");
    setCreatePrivacy((found.privacyStatus as any) || "private");
    const cd = found.contentDetails || {};
    setCreateAutoStart(cd.enableAutoStart !== false);
    setCreateAutoStop(!!cd.enableAutoStop);
    setCreateDvr(!!cd.enableDvr);
    setCreateLatency((cd.latencyPreference as any) || "normal");
    // Always force future time, never copy past
    const dt2 = new Date(Date.now() + 30 * 60 * 1000);
    const future = `${dt2.getFullYear()}-${String(dt2.getMonth()+1).padStart(2,'0')}-${String(dt2.getDate()).padStart(2,'0')}T${String(dt2.getHours()).padStart(2,'0')}:${String(dt2.getMinutes()).padStart(2,'0')}`;
    setCreateScheduledTime(future);
    setSelectedRecentForCopy(id);
  };

  const clearRecentSelection = () => {
    setSelectedRecentForCopy("");
    // Re-apply defaults
    setCreateTitle("My Live Stream");
    setCreateDescription("");
    setCreatePrivacy("private");
    setCreateAutoStart(true);
    setCreateAutoStop(false);
    setCreateDvr(false);
    setCreateLatency("normal");
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName || !newKeyRtmp || !newKeyStream) return toast.error("Please fill all fields");
    
    setSavingKey(true);
    try {
      const res = await fetch("/api/saved-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName, rtmp_url: newKeyRtmp, stream_key: newKeyStream }),
      });
      if (res.ok) {
        toast.success("Stream key saved");
        setNewKeyName("");
        setNewKeyStream("");
        fetchSavedKeys();
      } else {
        toast.error("Failed to save key");
      }
    } catch (err) {
      toast.error("Error saving key");
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteKey = async (id: number) => {
    if (!confirm("Are you sure you want to delete this key?")) return;
    try {
      const res = await fetch(`/api/saved-keys/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success("Key deleted");
        fetchSavedKeys();
      } else {
        toast.error("Failed to delete key");
      }
    } catch (err) {
      toast.error("Error deleting key");
    }
  };

  const handleUpload = async (selectedFile?: File) => {
    const fileToUpload = selectedFile || file;
    if (!fileToUpload) return toast.error("Please select a file");
    
    setUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append("video", fileToUpload);
    
    try {
      const res = await axios.post("/api/videos/upload", formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      });
      if (res.status === 200) {
        toast.success("Video uploaded successfully");
        setFile(null);
        fetchVideos();
      } else {
        toast.error("Upload failed");
      }
    } catch (err) {
      toast.error("An error occurred during upload");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl) return toast.error("Please enter a URL");
    
    setImporting(true);
    setImportProgress(0);
    try {
      const res = await fetch("/api/videos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        const importId = data.importId;
        
        // Poll for progress
        const pollInterval = setInterval(async () => {
          try {
            const progressRes = await fetch(`/api/videos/import-progress/${importId}`);
            if (progressRes.ok) {
              const progressData = await progressRes.json();
              setImportProgress(progressData.progress);
              
              if (progressData.status === 'completed') {
                clearInterval(pollInterval);
                toast.success("Video imported successfully");
                setImportUrl("");
                fetchVideos();
                setImporting(false);
                setTimeout(() => setImportProgress(0), 1000);
              } else if (progressData.status === 'failed') {
                clearInterval(pollInterval);
                toast.error(progressData.error || "Import failed");
                setImporting(false);
                setImportProgress(0);
              }
            }
          } catch (e) {
            // Ignore polling errors
          }
        }, 1000);
      } else {
        toast.error("Import failed");
        setImporting(false);
      }
    } catch (err) {
      toast.error("An error occurred during import");
      setImporting(false);
    }
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVideo || !rtmpUrl || !streamKey || !scheduledFor) {
      return toast.error("Please fill all fields");
    }
    
    setScheduling(true);
    try {
      const res = await fetch("/api/streams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: selectedVideo,
          rtmp_url: rtmpUrl,
          stream_key: streamKey,
          scheduled_for: scheduledFor,
           broadcast_id: broadcastId || null,
           broadcast_title: broadcastId ? broadcasts.find(b => b.id === broadcastId)?.title || null : null,
        }),
      });
      if (res.ok) {
        toast.success("Stream scheduled successfully");
        setSelectedVideo("");
        setStreamKey("");
        setScheduledFor("");
        setSelectedSavedKey("");
        setBroadcastId("");
        fetchStreams();
      } else {
        toast.error("Scheduling failed");
      }
    } catch (err) {
      toast.error("An error occurred while scheduling");
    } finally {
      setScheduling(false);
    }
  };

  const handleDeleteVideo = async (id: number) => {
    if (!confirm("Are you sure you want to delete this video?")) return;
    try {
      const res = await fetch(`/api/videos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success("Video deleted");
        fetchVideos();
        fetchStreams();
      } else {
        toast.error("Failed to delete video");
      }
    } catch (err) {
      toast.error("Error deleting video");
    }
  };

  const handleDeleteStream = async (id: number) => {
    if (!confirm("Are you sure you want to delete this stream?")) return;
    try {
      const res = await fetch(`/api/streams/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success("Stream deleted");
        fetchStreams();
      } else {
        toast.error("Failed to delete stream");
      }
    } catch (err) {
      toast.error("Error deleting stream");
    }
  };

  const handleAbortStream = async (id: number) => {
    if (!confirm("Are you sure you want to abort this live stream?")) return;
    try {
      const res = await fetch(`/api/streams/${id}/abort`, { method: 'POST' });
      if (res.ok) {
        toast.success("Stream aborted");
        fetchStreams();
      } else {
        toast.error("Failed to abort stream");
      }
    } catch (err) {
      toast.error("Error aborting stream");
    }
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center bg-background text-foreground"><div className="animate-pulse flex flex-col items-center"><Activity className="w-12 h-12 text-primary mb-4" /><span>Loading...</span></div></div>;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
          <Activity className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Stream<span className="text-primary">Scheduler</span></h1>
      </div>
      
      <div className="px-4 py-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">Menu</div>
        <nav className="space-y-1">
          {[
            { id: "dashboard", label: "Overview", icon: LayoutDashboard },
            { id: "schedule", label: "Schedule", icon: Calendar },
            { id: "keys", label: "Stream Keys", icon: Key },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === item.id 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-muted-foreground hover:bg-white/5 hover:text-white"
              }`}
            >
              <item.icon className={`w-5 h-5 ${activeTab === item.id ? "text-primary" : ""}`} />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-4">
        <div className="glass rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.username}</p>
            </div>
          </div>
          
          <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full text-muted-foreground hover:text-white hover:bg-white/5">
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden selection:bg-primary/30">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={`fixed inset-y-0 left-0 z-50 w-72 glass border-r border-white/5 transform lg:translate-x-0 lg:static lg:block transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent />
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-4 glass border-b border-white/5 z-30">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            <span className="font-bold text-white">StreamScheduler</span>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-muted-foreground hover:text-white">
            <Menu className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="max-w-6xl mx-auto space-y-8"
            >
              {activeTab === "dashboard" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold tracking-tight text-white">System Overview</h2>
                    <Button variant="outline" size="sm" onClick={fetchStats} className="border-white/10 text-white hover:bg-white/5">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="glass border-white/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-primary" /> CPU Usage
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-white">{serverStats?.cpu != null ? serverStats.cpu.toFixed(1) : 0}%</div>
                        <Progress value={serverStats?.cpu || 0} className="h-1 mt-3 bg-white/10" />
                      </CardContent>
                    </Card>
                    
                    <Card className="glass border-white/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-primary" /> Memory
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-white">
                          {serverStats?.memory ? (serverStats.memory.used / (1024 * 1024 * 1024)).toFixed(1) : 0} <span className="text-sm text-muted-foreground font-normal">/ {serverStats?.memory ? (serverStats.memory.total / (1024 * 1024 * 1024)).toFixed(1) : 0} GB</span>
                        </div>
                        <Progress value={serverStats ? (serverStats.memory.used / serverStats.memory.total) * 100 : 0} className="h-1 mt-3 bg-white/10" />
                      </CardContent>
                    </Card>

                    <Card className="glass border-white/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Folder className="w-4 h-4 text-primary" /> Storage
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-white">
                          {serverStats?.disk ? (serverStats.disk.used / (1024 * 1024 * 1024)).toFixed(1) : 0} <span className="text-sm text-muted-foreground font-normal">/ {serverStats?.disk ? (serverStats.disk.total / (1024 * 1024 * 1024)).toFixed(1) : 0} GB</span>
                        </div>
                        <Progress value={serverStats ? (serverStats.disk.used / serverStats.disk.total) * 100 : 0} className="h-1 mt-3 bg-white/10" />
                      </CardContent>
                    </Card>

                    <Card className="glass border-white/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Network className="w-4 h-4 text-primary" /> Network
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between items-end">
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Download</div>
                            <div className="text-lg font-bold text-green-400">{serverStats?.network ? (serverStats.network.rx_sec / (1024 * 1024)).toFixed(2) : 0} <span className="text-xs font-normal">MB/s</span></div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground mb-1">Upload</div>
                            <div className="text-lg font-bold text-blue-400">{serverStats?.network ? (serverStats.network.tx_sec / (1024 * 1024)).toFixed(2) : 0} <span className="text-xs font-normal">MB/s</span></div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="glass border-white/5">
                      <CardHeader>
                        <CardTitle className="text-lg text-white">Active Streams</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {streams.filter(s => s.status === 'streaming').length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground bg-white/5 rounded-xl border border-white/5">No active streams</div>
                          ) : (
                            streams.filter(s => s.status === 'streaming').map(s => (
                              <div key={s.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                  <span className="font-medium text-white">{s.video_name}</span>
                                </div>
                                <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-md">LIVE</span>
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="glass border-white/5">
                      <CardHeader>
                        <CardTitle className="text-lg text-white">Network Interfaces</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {serverStats?.network.interfaces.map((net: any) => (
                            <div key={net.iface} className="p-3 bg-white/5 rounded-xl border border-white/5">
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-medium text-white">{net.iface}</span>
                                <span className={`text-xs px-2 py-1 rounded-md ${net.operstate === 'up' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>{net.operstate.toUpperCase()}</span>
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>↓ {(net.rx_sec / (1024 * 1024)).toFixed(2)} MB/s</span>
                                <span>↑ {(net.tx_sec / (1024 * 1024)).toFixed(2)} MB/s</span>
                              </div>
                            </div>
                          ))}
                        </div>
                       </CardContent>
                     </Card>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <Card className="glass border-white/5">
                       <CardHeader>
                         <CardTitle className="text-lg text-white">Recent Videos</CardTitle>
                       </CardHeader>
                       <CardContent>
                         <div className="space-y-2">
                           {videos.length === 0 ? (
                             <div className="text-center py-4 text-muted-foreground text-sm">No videos yet</div>
                           ) : (
                             videos.slice(0, 3).map((v: any) => (
                               <div key={v.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                                 <div className="min-w-0">
                                   <div className="font-medium text-white truncate">{v.original_name}</div>
                                   <div className="text-xs text-muted-foreground">{(v.size / (1024 * 1024)).toFixed(1)} MB</div>
                                 </div>
                                 {v.encoding_status === 'encoding' && (
                                   <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">ENC {v.encoding_progress}%</span>
                                 )}
                               </div>
                             ))
                           )}
                         </div>
                         <Button variant="ghost" size="sm" className="mt-3" onClick={() => setActiveTab("schedule")}>
                           Manage →
                         </Button>
                       </CardContent>
                     </Card>

                     <Card className="glass border-white/5">
                       <CardHeader>
                         <CardTitle className="text-lg text-white">Upcoming Streams</CardTitle>
                       </CardHeader>
                       <CardContent>
                         <div className="space-y-2">
                           {streams.filter((s: any) => s.status === 'pending' || s.status === 'scheduled').length === 0 ? (
                             <div className="text-center py-4 text-muted-foreground text-sm">No upcoming streams</div>
                           ) : (
                             streams
                               .filter((s: any) => s.status === 'pending' || s.status === 'scheduled')
                               .slice(0, 3)
                               .map((s: any) => (
                                 <div key={s.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                                   <div className="min-w-0">
                                     <div className="font-medium text-white truncate">{s.video_name}</div>
                                     <div className="text-xs text-muted-foreground">{s.scheduled_for.replace('T', ' ')}</div>
                                   </div>
                                   <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">PENDING</span>
                                 </div>
                               ))
                           )}
                         </div>
                         <Button variant="ghost" size="sm" className="mt-3" onClick={() => setActiveTab("schedule")}>
                           Manage →
                         </Button>
                       </CardContent>
                     </Card>
                   </div>
                 </div>
               )}

                {activeTab === "schedule" && (
                 <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-3xl font-bold tracking-tight text-white">Schedule</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Card className="glass border-white/5">
                        <CardHeader>
                          <CardTitle className="text-white">Upload Video</CardTitle>
                        </CardHeader>
                        <CardContent>
                           <div className="space-y-4">
                             <div className="space-y-2">
                               <Label className="text-white/80">Select File</Label>
                               <div 
                                 className="flex flex-col items-center justify-center border-2 border-dashed border-white/20 rounded-xl p-8 hover:bg-white/5 hover:border-primary/50 transition-all cursor-pointer bg-black/20" 
                                 onClick={() => document.getElementById('file-upload')?.click()}
                               >
                                 <Folder className="w-12 h-12 text-white/40 mb-3" />
                                 <span className="text-sm text-white/70 text-center font-medium">
                                   {file ? file.name : "Click to select a video file"}
                                 </span>
                                 <Input 
                                   id="file-upload"
                                   type="file" 
                                   accept="video/*" 
                                   onChange={e => {
                                     const selected = e.target.files?.[0] || null;
                                     setFile(selected);
                                     if (selected) handleUpload(selected);
                                   }} 
                                   className="hidden"
                                   disabled={uploading}
                                 />
                               </div>
                             </div>
                             {uploading && (
                               <div className="space-y-2 pt-2">
                                 <div className="flex justify-between text-xs text-white/70 font-medium">
                                   <span>Uploading...</span>
                                   <span>{uploadProgress}%</span>
                                 </div>
                                 <Progress value={uploadProgress} className="h-1.5 bg-white/10" />
                               </div>
                             )}
                           </div>
                        </CardContent>
                      </Card>

                      <Card className="glass border-white/5">
                        <CardHeader>
                          <CardTitle className="text-white">Import from URL</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <form onSubmit={handleImport} className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-white/80">Direct Download URL</Label>
                              <Input 
                                type="url" 
                                value={importUrl} 
                                onChange={e => setImportUrl(e.target.value)} 
                                placeholder="https://..." 
                                required 
                              />
                              <p className="text-xs text-white/50">
                                For Google Drive, use a direct download link format.
                              </p>
                            </div>
                            <Button type="submit" disabled={importing || !importUrl} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl py-6 px-8 font-semibold transition-all">
                              {importing ? "Importing..." : "Import Video"}
                            </Button>
                            {importing && (
                              <div className="space-y-2 pt-2">
                                <div className="flex justify-between text-xs text-white/70 font-medium">
                                  <span>Importing...</span>
                                  <span>{importProgress}%</span>
                                </div>
                                <Progress value={importProgress} className="h-1.5 bg-white/10" />
                              </div>
                            )}
                          </form>
                        </CardContent>
                      </Card>

                      <Card className="glass border-white/5">
                        <CardHeader>
                          <CardTitle className="text-white">Create YouTube Stream</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <p className="text-sm text-white/70">Create a new live broadcast + stream key directly on YouTube without leaving the app.</p>
                            <Button onClick={openCreateModal} className="w-full" variant="outline">
                              <Plus className="h-4 w-4 mr-2" /> Create New Stream
                            </Button>
                            <p className="text-xs text-white/40">After creation, the schedule form will be auto-filled.</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                   
                   <Card className="glass border-white/5">
                     <CardHeader>
                       <CardTitle className="text-white">Schedule New Stream</CardTitle>
                     </CardHeader>
                     <CardContent>
                       <form onSubmit={handleSchedule} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 md:col-span-2">
                          <Label className="text-white/80">Use Saved Stream Key (Optional)</Label>
                          <Select value={selectedSavedKey || undefined} onValueChange={(val) => {
                            setSelectedSavedKey(val || "");
                            if (val) {
                              const key = savedKeys.find(k => k.id.toString() === val);
                              if (key) {
                                setRtmpUrl(key.rtmp_url);
                                setStreamKey(key.stream_key);
                              }
                            }
                          }}>
                            <SelectTrigger className="bg-black/50 border-white/10 text-white">
                              <SelectValue placeholder="Select a saved key to auto-fill">
                                {selectedSavedKey ? (savedKeys.find(k => k.id.toString() === selectedSavedKey)?.name || "Unknown Key") : "Select a saved key to auto-fill"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-background border-white/10">
                              {savedKeys.map(k => (
                                <SelectItem key={k.id} value={k.id.toString()}>{k.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                         <div className="space-y-2">
                           <Label className="text-white/80">Select Video</Label>
                           <p className="text-xs text-white/50 -mt-1">or upload more using the cards above</p>
                           <Select value={selectedVideo || undefined} onValueChange={(val) => setSelectedVideo(val || "")}>
                            <SelectTrigger className="bg-black/50 border-white/10 text-white">
                              <SelectValue placeholder="Select a video">
                                {selectedVideo ? (videos.find(v => v.id.toString() === selectedVideo)?.original_name || "Unknown Video") : "Select a video"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-background border-white/10">
                              {videos.map(v => (
                                <SelectItem key={v.id} value={v.id.toString()}>
                                  {v.original_name} {v.encoding_status === 'encoding' ? `(Encoding: ${v.encoding_progress}%)` : v.encoding_status === 'failed' ? '(Encoding Failed)' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white/80">RTMP URL</Label>
                          <Input 
                            value={rtmpUrl} 
                            onChange={e => setRtmpUrl(e.target.value)} 
                            placeholder="rtmp://a.rtmp.youtube.com/live2" 
                            required 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white/80">Stream Key</Label>
                          <Input 
                            type="password"
                            value={streamKey} 
                            onChange={e => setStreamKey(e.target.value)} 
                            placeholder="xxxx-xxxx-xxxx-xxxx" 
                            required 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white/80">Scheduled Start Time *</Label>
                          <Input 
                            type="datetime-local" 
                            value={scheduledFor} 
                            onChange={e => setScheduledFor(e.target.value)} 
                            required 
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-white/80">YouTube Broadcast (Optional)</Label>
                            {!youtubeAuthenticated ? (
                              <Button onClick={handleYouTubeAuth} variant="outline" className="w-full">
                                Connect YouTube Account
                              </Button>
                            ) : (
                              <div className="flex items-center gap-2">
                                 <Select value={broadcastId || undefined} onValueChange={(val) => {
                                   if (val === "__CREATE_NEW__") {
                                     openCreateModal();
                                     return;
                                   }
                                   setBroadcastId(val || "");
                                 }}>
                                  <SelectTrigger className="bg-black/50 border-white/10 text-white h-auto min-h-[72px] py-3">
                                    <SelectValue placeholder="Choose YouTube Broadcast">
                                      {broadcastId ? (
                                        <div className="flex items-center gap-3 text-left w-full">
                                          {broadcasts.find(b => b.id === broadcastId)?.thumbnail && (
                                            <Image src={broadcasts.find(b => b.id === broadcastId)!.thumbnail} alt="" width={64} height={48} className="w-16 h-12 object-cover rounded flex-shrink-0" />
                                          )}
                                          <div className="min-w-0 flex-1">
                                            <div className="font-medium text-white text-sm leading-tight line-clamp-2">
                                              {broadcasts.find(b => b.id === broadcastId)?.title}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                              {broadcasts.find(b => b.id === broadcastId)?.scheduledStartTime ? fmtDate(broadcasts.find(b => b.id === broadcastId)!.scheduledStartTime) : ""}
                                            </div>
                                          </div>
                                        </div>
                                      ) : "Choose YouTube Broadcast"}
                                    </SelectValue>
                                  </SelectTrigger>
                                   <SelectContent className="bg-background border-white/10 max-h-[400px]">
                                     <SelectItem value="__CREATE_NEW__" className="py-3 px-3 cursor-pointer text-primary font-medium">
                                       + Create new YouTube stream
                                     </SelectItem>
                                     {broadcasts.length === 0 && (
                                       <div className="px-3 py-4 text-sm text-muted-foreground">No broadcasts found.</div>
                                     )}
                                     {broadcasts.map((b: any) => (
                                      <SelectItem key={b.id} value={b.id} className="py-4 px-3 cursor-pointer">
                                        <div className="flex items-center gap-4 w-full">
                                          {b.thumbnail ? (
                                            <Image src={b.thumbnail} alt="" width={80} height={56} className="w-20 h-14 object-cover rounded flex-shrink-0" />
                                          ) : (
                                            <div className="w-20 h-14 bg-white/10 rounded flex items-center justify-center text-xs text-muted-foreground flex-shrink-0">No thumb</div>
                                          )}
                                          <div className="min-w-0 flex-1">
                                            <div className="font-medium text-white text-sm leading-tight line-clamp-3 pr-2">{b.title}</div>
                                            <div className="text-xs text-muted-foreground mt-1.5">
                                              {b.scheduledStartTime ? fmtDate(b.scheduledStartTime) : ""}
                                            </div>
                                          </div>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {broadcastId && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setBroadcastId("")}
                                    title="Clear selection"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button onClick={openCreateModal} variant="outline" size="sm" className="p-2" title="Create new YouTube stream">
                                  <Plus className="h-4 w-4" />
                                </Button>
                                <Button onClick={handleYouTubeDisconnect} variant="outline" size="sm" className="p-2" title="Disconnect YouTube Account">
                                  <LogOut className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        <div className="md:col-span-2 pt-2">
                          <Button type="submit" disabled={scheduling} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl py-6 px-8 font-semibold transition-all">
                            {scheduling ? "Scheduling..." : "Schedule Stream"}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                   </Card>



                   <Card className="glass border-white/5">
                     <CardHeader>
                       <CardTitle className="text-white">Scheduled Streams</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-xl border border-white/10 overflow-hidden bg-black/20">
                        <Table>
                          <TableHeader className="bg-white/5">
                            <TableRow className="border-white/10 hover:bg-transparent">
                              <TableHead className="text-white/70">Video</TableHead>
                              <TableHead className="text-white/70">Scheduled For</TableHead>
                              <TableHead className="text-white/70">Status</TableHead>
                               <TableHead className="text-white/70">Broadcast Title</TableHead>
                              <TableHead className="text-right text-white/70">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {streams.length === 0 ? (
                              <TableRow className="border-white/10 hover:bg-white/5">
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No streams scheduled</TableCell>
                              </TableRow>
                            ) : (
                              streams.map(s => (
                                <TableRow key={s.id} className="border-white/10 hover:bg-white/5">
                                  <TableCell className="font-medium text-white">{s.video_name}</TableCell>
                                   <TableCell className="text-white/80">{fmtDate(s.scheduled_for)}</TableCell>
                                  <TableCell>
                                    <span className={`px-2.5 py-1 rounded-md text-xs font-medium border
                                      ${s.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : ''}
                                      ${s.status === 'streaming' ? 'bg-primary/10 text-primary border-primary/20 animate-pulse' : ''}
                                      ${s.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' : ''}
                                      ${s.status === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/20' : ''}
                                    `}>
                                      {s.status.toUpperCase()}
                                    </span>
                                  </TableCell>
                                   <TableCell className="text-white/60 text-sm">{s.broadcast_title || s.video_name}</TableCell>
                                  <TableCell className="text-right">
                                    {s.status === 'streaming' ? (
                                      <Button variant="ghost" size="sm" onClick={() => handleAbortStream(s.id)} className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10">Abort</Button>
                                    ) : (
                                      <Button variant="ghost" size="sm" onClick={() => handleDeleteStream(s.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">Delete</Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                     </CardContent>
                   </Card>

                   <Card className="glass border-white/5">
                     <CardHeader>
                       <CardTitle className="text-white">Uploaded Videos</CardTitle>
                     </CardHeader>
                     <CardContent>
                       <div className="rounded-xl border border-white/10 overflow-hidden bg-black/20">
                         <Table>
                           <TableHeader className="bg-white/5">
                             <TableRow className="border-white/10 hover:bg-transparent">
                               <TableHead className="text-white/70">Filename</TableHead>
                               <TableHead className="text-white/70">Size</TableHead>
                               <TableHead className="text-white/70">Uploaded At</TableHead>
                               <TableHead className="text-right text-white/70">Actions</TableHead>
                             </TableRow>
                           </TableHeader>
                           <TableBody>
                             {videos.length === 0 ? (
                               <TableRow className="border-white/10 hover:bg-white/5">
                                 <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No videos uploaded</TableCell>
                               </TableRow>
                             ) : (
                               videos.map(v => (
                                 <TableRow key={v.id} className="border-white/10 hover:bg-white/5">
                                   <TableCell className="font-medium text-white">
                                     {v.original_name}
                                     {v.encoding_status === 'encoding' && (
                                       <div className="mt-2">
                                         <div className="text-xs text-muted-foreground mb-1">Encoding: {v.encoding_progress}%</div>
                                         <Progress value={v.encoding_progress} className="h-1.5 bg-white/10" />
                                       </div>
                                     )}
                                     {v.encoding_status === 'failed' && (
                                       <div className="text-xs text-red-400 mt-1">Encoding failed</div>
                                     )}
                                   </TableCell>
                                   <TableCell className="text-white/80">{(v.size / (1024 * 1024)).toFixed(2)} MB</TableCell>
                                    <TableCell className="text-white/60 text-sm">{fmtDate(v.created_at)}</TableCell>
                                   <TableCell className="text-right">
                                     <Button variant="ghost" size="sm" onClick={() => handleDeleteVideo(v.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">Delete</Button>
                                   </TableCell>
                                 </TableRow>
                               ))
                             )}
                           </TableBody>
                         </Table>
                       </div>
                     </CardContent>
                   </Card>
                 </div>
               )}

                {activeTab === "keys" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold tracking-tight text-white">Stream Keys</h2>
                  </div>
                  
                  <Card className="glass border-white/5">
                    <CardHeader>
                      <CardTitle className="text-white">Save New Stream Key</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSaveKey} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <Label className="text-white/80">Name (e.g. YouTube Main)</Label>
                          <Input 
                            value={newKeyName} 
                            onChange={e => setNewKeyName(e.target.value)} 
                            placeholder="My Channel" 
                            required 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white/80">RTMP URL</Label>
                          <Input 
                            value={newKeyRtmp} 
                            onChange={e => setNewKeyRtmp(e.target.value)} 
                            placeholder="rtmp://a.rtmp.youtube.com/live2" 
                            required 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white/80">Stream Key</Label>
                          <Input 
                            type="password"
                            value={newKeyStream} 
                            onChange={e => setNewKeyStream(e.target.value)} 
                            placeholder="xxxx-xxxx-xxxx-xxxx" 
                            required 
                          />
                        </div>
                        <div className="md:col-span-3 pt-2">
                          <Button type="submit" disabled={savingKey} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl py-6 px-8 font-semibold transition-all">
                            {savingKey ? "Saving..." : "Save Key"}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>

                  <Card className="glass border-white/5">
                    <CardHeader>
                      <CardTitle className="text-white">Saved Keys</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-xl border border-white/10 overflow-hidden bg-black/20">
                        <Table>
                          <TableHeader className="bg-white/5">
                            <TableRow className="border-white/10 hover:bg-transparent">
                              <TableHead className="text-white/70">Name</TableHead>
                              <TableHead className="text-white/70">RTMP URL</TableHead>
                              <TableHead className="text-white/70">Saved At</TableHead>
                              <TableHead className="text-right text-white/70">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {savedKeys.length === 0 ? (
                              <TableRow className="border-white/10 hover:bg-white/5">
                                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No keys saved</TableCell>
                              </TableRow>
                            ) : (
                              savedKeys.map(k => (
                                <TableRow key={k.id} className="border-white/10 hover:bg-white/5">
                                  <TableCell className="font-medium text-white">{k.name}</TableCell>
                                  <TableCell className="text-white/80 font-mono text-sm">{k.rtmp_url}</TableCell>
                                    <TableCell className="text-white/60 text-sm">{fmtDate(k.created_at)}</TableCell>
                                  <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteKey(k.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">Delete</Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Create YouTube Stream Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-background/95 backdrop-blur-sm border-white/10 w-[min(96vw,1260px)] max-w-none max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-white">Create New YouTube Stream</DialogTitle>
            <DialogDescription className="text-white/60">
              Create a new live broadcast and stream directly on YouTube
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0 pr-1">
            <div className="space-y-2">
              <Label className="text-white/80">Copy details from recent broadcast (optional)</Label>
              <div className="flex gap-2">
                <Select value={selectedRecentForCopy || undefined} onValueChange={(val) => { if (val) handleSelectRecent(val); }}>
                  <SelectTrigger className="bg-black/50 border-white/10 text-white">
                    <SelectValue placeholder="Select recent broadcast" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-white/10 max-h-[300px]">
                    {modalRecentBroadcasts.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No recent broadcasts</div>
                    )}
                    {modalRecentBroadcasts.map((b: any) => (
                       <SelectItem key={b.id} value={b.id} className="py-2">
                         <div>
                           {b._statusTag} • {b.title} {b.scheduledStartTime ? `(${fmtDate(b.scheduledStartTime)})` : ''}

                         </div>
                       </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedRecentForCopy && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearRecentSelection}>Clear</Button>
                )}
              </div>
              <p className="text-xs text-white/40">Selecting overwrites fields below. Scheduled time defaults to ~30 min from now.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Title *</Label>
              <Input
                value={createTitle}
                onChange={e => setCreateTitle(e.target.value)}
                placeholder="My Live Stream"
                maxLength={100}
                required
              />
              <div className="text-xs text-white/50 text-right">{createTitle.length} / 100</div>
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Description</Label>
              <textarea
                value={createDescription}
                onChange={e => setCreateDescription(e.target.value)}
                placeholder="Optional description"
                rows={4}
                className="w-full min-h-[96px] resize-y overflow-auto rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Scheduled Start Time *</Label>
              <Input
                type="datetime-local"
                value={createScheduledTime}
                onChange={e => setCreateScheduledTime(e.target.value)}
                required
                style={{ colorScheme: 'dark' }}
              />
              <p className="text-xs text-white/40">Leave empty to start in ~30 minutes</p>
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Thumbnail</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const reader = new FileReader();
                     reader.onload = () => {
                       const b64 = reader.result as string;
                       setCreateThumbnail(b64);
                       setCreateThumbnailPreview(b64);
                     };
                    reader.readAsDataURL(f);
                  }
                }}
              />
              {createThumbnailPreview && (
                <div className="flex items-center gap-2">
                  <img src={createThumbnailPreview} alt="thumb preview" className="w-24 h-14 object-cover rounded border border-white/20" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setCreateThumbnail(null); setCreateThumbnailPreview(""); }}>Clear</Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Privacy</Label>
              <Select value={createPrivacy} onValueChange={(v) => setCreatePrivacy(v as any)}>
                <SelectTrigger className="bg-black/50 border-white/10 text-white">
                  <SelectValue placeholder="Select privacy">
                    {createPrivacy ? createPrivacy.charAt(0).toUpperCase() + createPrivacy.slice(1) : "Select privacy"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-background border-white/10">
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="unlisted">Unlisted</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-white/80 text-sm">Stream Settings</Label>
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2 text-white/80">
                  <input type="checkbox" checked={createAutoStart} onChange={e=>setCreateAutoStart(e.target.checked)} className="accent-primary" /> Auto start
                </label>
                <label className="flex items-center gap-2 text-white/80">
                  <input type="checkbox" checked={createAutoStop} onChange={e=>setCreateAutoStop(e.target.checked)} className="accent-primary" /> Auto stop
                </label>
                <label className="flex items-center gap-2 text-white/80">
                  <input type="checkbox" checked={createDvr} onChange={e=>setCreateDvr(e.target.checked)} className="accent-primary" /> DVR
                </label>
              </div>
              <div className="space-y-1">
                <Label className="text-white/80 text-xs">Latency</Label>
                <Select value={createLatency} onValueChange={(v)=>setCreateLatency(v as any)}>
                  <SelectTrigger className="bg-black/50 border-white/10 text-white h-8">
                    <SelectValue  {createLatency ? createLatency.charAt(0).toUpperCase() + createLatency.slice(1) : "Select Latency"}
                  </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-background border-white/10">
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="ultraLow">Ultra low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-white/10">
            <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)} className="text-white/70 hover:text-white">
              Cancel
            </Button>
            <Button
              onClick={handleCreateStream}
              disabled={creatingStream}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {creatingStream ? "Creating..." : "Create Stream"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

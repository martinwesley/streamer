"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Folder, Activity, HardDrive, Cpu, Network, Menu, X, Video, Key, Calendar, LayoutDashboard, LogOut, Youtube, RefreshCw } from "lucide-react";
import axios from "axios";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";

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
  const [rtmpUrl, setRtmpUrl] = useState("");
  const [streamKey, setStreamKey] = useState("");
  const [selectedSavedKey, setSelectedSavedKey] = useState("");

  // Saved Keys state
  const [savedKeys, setSavedKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyRtmp, setNewKeyRtmp] = useState("");
  const [newKeyStream, setNewKeyStream] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  useEffect(() => {
    fetchUser();
    fetchStats();
    const streamsInterval = setInterval(() => {
      fetchStreams();
      fetchVideos();
    }, 2000);

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'YOUTUBE_AUTH_SUCCESS') {
        toast.success("YouTube connected!");
        fetchUser();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Please select a file");
    
    setUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append("video", file);
    
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
    if (!selectedVideo || (!rtmpUrl || !streamKey)) {
      return toast.error("Please fill all fields");
    }
    
    try {
      const res = await fetch("/api/streams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: selectedVideo,
          rtmp_url: rtmpUrl,
          stream_key: streamKey,
        }),
      });
      if (res.ok) {
        toast.success("Stream scheduled successfully");
        setSelectedVideo("");
        setStreamKey("");
        setSelectedSavedKey("");
        fetchStreams();
      } else {
        toast.error("Scheduling failed");
      }
    } catch (err) {
      toast.error("An error occurred while scheduling");
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
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "streams", label: "Streams", icon: Calendar },
            { id: "videos", label: "Videos", icon: Video },
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
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
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
                </div>
              )}

              {activeTab === "streams" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold tracking-tight text-white">Streams</h2>
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
                        <div className="md:col-span-2 pt-2">
                          <Button type="submit" className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl py-6 px-8 font-semibold transition-all">
                            Schedule Stream
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
                              <TableHead className="text-white/70">Created At</TableHead>
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
                                  <TableCell className="text-white/80">{s.scheduled_for.replace('T', ' ')}</TableCell>
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
                                  <TableCell className="text-white/60 text-sm">{new Date(s.created_at + 'Z').toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}</TableCell>
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
                </div>
              )}

              {activeTab === "videos" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold tracking-tight text-white">Videos</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="glass border-white/5 max-w-md mx-auto">
                      <CardHeader>
                        <CardTitle className="text-white">Upload Video</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={handleUpload} className="space-y-4">
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
                                onChange={e => setFile(e.target.files?.[0] || null)} 
                                className="hidden"
                                required 
                              />
                            </div>
                          </div>
                          <Button type="submit" disabled={uploading || !file} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl py-6 px-8 font-semibold transition-all">
                            {uploading ? "Uploading..." : "Upload Video"}
                          </Button>
                          {uploading && (
                            <div className="space-y-2 pt-2">
                              <div className="flex justify-between text-xs text-white/70 font-medium">
                                <span>Uploading...</span>
                                <span>{uploadProgress}%</span>
                              </div>
                              <Progress value={uploadProgress} className="h-1.5 bg-white/10" />
                            </div>
                          )}
                        </form>
                      </CardContent>
                    </Card>

                    <Card className="glass border-white/5 max-w-md mx-auto">
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
                  </div>

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
                                  <TableCell className="text-white/60 text-sm">{new Date(v.created_at + 'Z').toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}</TableCell>
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
                                  <TableCell className="text-white/60 text-sm">{new Date(k.created_at + 'Z').toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}</TableCell>
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
              {activeTab === "youtube" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight text-white">YouTube Integration</h2>
                  </div>

                  <Card className="glass border-white/5">
                    <CardHeader>
                      <CardTitle className="text-white">Connection Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {user.youtube_tokens ? (
                        <div className="space-y-6">
                          <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                            {youtubeLoading ? (
                              <div className="animate-pulse flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-white/10"></div>
                                <div className="space-y-2">
                                  <div className="h-4 w-32 bg-white/10 rounded"></div>
                                  <div className="h-3 w-24 bg-white/10 rounded"></div>
                                </div>
                              </div>
                            ) : youtubeChannel ? (
                              <>
                                {youtubeChannel.thumbnail ? (
                                  <img src={youtubeChannel.thumbnail} alt={youtubeChannel.title} className="w-16 h-16 rounded-full" />
                                ) : (
                                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                                    <Youtube className="w-8 h-8 text-white/50" />
                                  </div>
                                )}
                                <div>
                                  <h3 className="text-lg font-semibold text-white">{youtubeChannel.title}</h3>
                                  <p className="text-sm text-white/60">
                                    {parseInt(youtubeChannel.subscriberCount).toLocaleString()} subscribers
                                  </p>
                                </div>
                              </>
                            ) : (
                              <div className="text-white/70">Connected to YouTube, but channel info could not be loaded.</div>
                            )}
                          </div>
                          
                          <Button 
                            variant="destructive" 
                            onClick={handleDisconnectYouTube}
                            className="w-full sm:w-auto"
                          >
                            Disconnect YouTube
                          </Button>

                          <div className="pt-4 border-t border-white/10">
                            <h3 className="text-lg font-medium text-white mb-4">Upcoming Live Streams</h3>
                            {broadcasts.length === 0 ? (
                              <p className="text-white/60 text-sm">No upcoming streams found. Schedule one in YouTube Studio.</p>
                            ) : (
                              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {broadcasts.map(b => (
                                  <div key={b.id} className="bg-black/20 rounded-xl overflow-hidden border border-white/5">
                                    {b.thumbnail ? (
                                      <img src={b.thumbnail} alt={b.title} className="w-full aspect-video object-cover" />
                                    ) : (
                                      <div className="w-full aspect-video bg-white/5 flex items-center justify-center">
                                        <Video className="w-8 h-8 text-white/20" />
                                      </div>
                                    )}
                                    <div className="p-3">
                                      <h4 className="text-white font-medium truncate" title={b.title}>{b.title}</h4>
                                      <p className="text-xs text-white/60 mt-1">
                                        {new Date(b.scheduledStartTime).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 space-y-4">
                          <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                            <Youtube className="w-8 h-8 text-red-500" />
                          </div>
                          <h3 className="text-xl font-semibold text-white">Not Connected</h3>
                          <p className="text-white/60 max-w-md mx-auto">
                            Connect your YouTube account to schedule streams directly to your upcoming broadcasts.
                          </p>
                          <Link 
                            href="/youtube-connect" 
                            className={`mt-4 inline-flex ${buttonVariants({ variant: "default" })} bg-red-600 hover:bg-red-700 text-white`}
                          >
                            Connect YouTube
                          </Link>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
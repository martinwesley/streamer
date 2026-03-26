"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Folder } from "lucide-react";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  
  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Import state
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  
  // Stream state
  const [selectedVideo, setSelectedVideo] = useState("");
  const [rtmpUrl, setRtmpUrl] = useState("rtmp://a.rtmp.youtube.com/live2");
  const [streamKey, setStreamKey] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [selectedSavedKey, setSelectedSavedKey] = useState("");

  // Saved Keys state
  const [savedKeys, setSavedKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyRtmp, setNewKeyRtmp] = useState("rtmp://a.rtmp.youtube.com/live2");
  const [newKeyStream, setNewKeyStream] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

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
    const formData = new FormData();
    formData.append("video", file);
    
    try {
      const res = await fetch("/api/videos/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
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
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl) return toast.error("Please enter a URL");
    
    setImporting(true);
    try {
      const res = await fetch("/api/videos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl }),
      });
      if (res.ok) {
        toast.success("Video imported successfully");
        setImportUrl("");
        fetchVideos();
      } else {
        toast.error("Import failed");
      }
    } catch (err) {
      toast.error("An error occurred during import");
    } finally {
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
        }),
      });
      if (res.ok) {
        toast.success("Stream scheduled successfully");
        setSelectedVideo("");
        setStreamKey("");
        setScheduledFor("");
        setSelectedSavedKey("");
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

  if (!user) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">StreamScheduler</h1>
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">Welcome, {user.username}</span>
          <Button variant="outline" onClick={handleLogout}>Logout</Button>
        </div>
      </div>

      <Tabs defaultValue="streams" className="space-y-6">
        <TabsList>
          <TabsTrigger value="streams">Scheduled Streams</TabsTrigger>
          <TabsTrigger value="videos">My Videos</TabsTrigger>
          <TabsTrigger value="keys">Stream Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="streams" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Schedule New Stream</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSchedule} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Use Saved Stream Key (Optional)</Label>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Select a saved key to auto-fill" />
                    </SelectTrigger>
                    <SelectContent>
                      {savedKeys.map(k => (
                        <SelectItem key={k.id} value={k.id.toString()}>{k.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Select Video</Label>
                  <Select value={selectedVideo || undefined} onValueChange={(val) => setSelectedVideo(val || "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a video" />
                    </SelectTrigger>
                    <SelectContent>
                      {videos.map(v => (
                        <SelectItem key={v.id} value={v.id.toString()}>{v.original_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>RTMP URL</Label>
                  <Input 
                    value={rtmpUrl} 
                    onChange={e => setRtmpUrl(e.target.value)} 
                    placeholder="rtmp://a.rtmp.youtube.com/live2" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stream Key</Label>
                  <Input 
                    type="password"
                    value={streamKey} 
                    onChange={e => setStreamKey(e.target.value)} 
                    placeholder="xxxx-xxxx-xxxx-xxxx" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Schedule Time</Label>
                  <Input 
                    type="datetime-local" 
                    value={scheduledFor} 
                    onChange={e => setScheduledFor(e.target.value)} 
                    required 
                  />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" disabled={scheduling} className="w-full">
                    {scheduling ? "Scheduling..." : "Schedule Stream"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Streams</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Video</TableHead>
                    <TableHead>Scheduled For</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {streams.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">No streams scheduled</TableCell>
                    </TableRow>
                  ) : (
                    streams.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.video_name}</TableCell>
                        <TableCell>{s.scheduled_for.replace('T', ' ')}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold
                            ${s.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                            ${s.status === 'streaming' ? 'bg-blue-100 text-blue-800 animate-pulse' : ''}
                            ${s.status === 'completed' ? 'bg-green-100 text-green-800' : ''}
                            ${s.status === 'failed' ? 'bg-red-100 text-red-800' : ''}
                          `}>
                            {s.status.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell>{new Date(s.created_at + 'Z').toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}</TableCell>
                        <TableCell>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteStream(s.id)}>Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="videos" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload Video</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpload} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select File</Label>
                    <div 
                      className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 transition-colors cursor-pointer" 
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                      <Folder className="w-12 h-12 text-gray-400 mb-2" />
                      <span className="text-sm text-muted-foreground text-center">
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
                  <Button type="submit" disabled={uploading || !file} className="w-full">
                    {uploading ? "Uploading..." : "Upload Video"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Import from URL (e.g. Google Drive)</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleImport} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Direct Download URL</Label>
                    <Input 
                      type="url" 
                      value={importUrl} 
                      onChange={e => setImportUrl(e.target.value)} 
                      placeholder="https://..." 
                      required 
                    />
                    <p className="text-xs text-muted-foreground">
                      For Google Drive, use a direct download link format.
                    </p>
                  </div>
                  <Button type="submit" disabled={importing || !importUrl} className="w-full">
                    {importing ? "Importing..." : "Import Video"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Uploaded Videos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">No videos uploaded</TableCell>
                    </TableRow>
                  ) : (
                    videos.map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.original_name}</TableCell>
                        <TableCell>{(v.size / (1024 * 1024)).toFixed(2)} MB</TableCell>
                        <TableCell>{new Date(v.created_at + 'Z').toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}</TableCell>
                        <TableCell>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteVideo(v.id)}>Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keys" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Save New Stream Key</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveKey} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Name (e.g. YouTube Main)</Label>
                  <Input 
                    value={newKeyName} 
                    onChange={e => setNewKeyName(e.target.value)} 
                    placeholder="My Channel" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label>RTMP URL</Label>
                  <Input 
                    value={newKeyRtmp} 
                    onChange={e => setNewKeyRtmp(e.target.value)} 
                    placeholder="rtmp://a.rtmp.youtube.com/live2" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stream Key</Label>
                  <Input 
                    type="password"
                    value={newKeyStream} 
                    onChange={e => setNewKeyStream(e.target.value)} 
                    placeholder="xxxx-xxxx-xxxx-xxxx" 
                    required 
                  />
                </div>
                <div className="md:col-span-3">
                  <Button type="submit" disabled={savingKey} className="w-full">
                    {savingKey ? "Saving..." : "Save Key"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saved Keys</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>RTMP URL</TableHead>
                    <TableHead>Saved At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savedKeys.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">No keys saved</TableCell>
                    </TableRow>
                  ) : (
                    savedKeys.map(k => (
                      <TableRow key={k.id}>
                        <TableCell className="font-medium">{k.name}</TableCell>
                        <TableCell>{k.rtmp_url}</TableCell>
                        <TableCell>{new Date(k.created_at + 'Z').toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}</TableCell>
                        <TableCell>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteKey(k.id)}>Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
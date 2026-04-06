"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Youtube, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function YouTubeConnectPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/youtube/url");
      if (!res.ok) {
        throw new Error("Failed to get URL");
      }
      const { url } = await res.json();
      
      const authWindow = window.open(
        url,
        'oauth_popup',
        'width=600,height=700'
      );

      if (!authWindow) {
        toast.error('Please allow popups for this site to connect your account.');
        setLoading(false);
      }
    } catch (err) {
      toast.error("Failed to get YouTube authorization URL");
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'YOUTUBE_AUTH_SUCCESS') {
        toast.success("YouTube connected successfully!");
        router.push("/");
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4">
      <Card className="w-full max-w-md glass border-white/10">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
            <Youtube className="w-8 h-8 text-red-500" />
          </div>
          <CardTitle className="text-2xl text-white">Connect YouTube</CardTitle>
          <CardDescription className="text-white/70">
            Link your YouTube account to schedule and manage live streams directly from this app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-black/30 p-4 rounded-xl border border-white/5 text-sm text-white/80">
            <p className="mb-2 font-medium text-white">We need access to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Manage your YouTube live broadcasts</li>
              <li>View your upcoming streams</li>
              <li>Update stream status</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3">
          <Button 
            onClick={handleConnect} 
            disabled={loading} 
            className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl py-6 font-semibold transition-all"
          >
            {loading ? "Redirecting..." : "Authorize with YouTube"}
          </Button>
          <Link 
            href="/"
            className={`w-full text-white/70 hover:text-white hover:bg-white/5 ${buttonVariants({ variant: "ghost" })}`}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

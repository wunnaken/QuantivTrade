"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LiveKitRoom,
  VideoTrack,
  useParticipants,
  useLocalParticipant,
  useTracks,
  RoomAudioRenderer,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import type { TrackReference } from "@livekit/components-core";

// ─── Controls bar for the host ─────────────────────────────────────────────────

function HostControls() {
  const { localParticipant } = useLocalParticipant();
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);

  const toggleCamera = useCallback(async () => {
    await localParticipant.setCameraEnabled(!camOn);
    setCamOn(!camOn);
  }, [localParticipant, camOn]);

  const toggleMic = useCallback(async () => {
    await localParticipant.setMicrophoneEnabled(!micOn);
    setMicOn(!micOn);
  }, [localParticipant, micOn]);

  const toggleScreen = useCallback(async () => {
    await localParticipant.setScreenShareEnabled(!screenOn);
    setScreenOn(!screenOn);
  }, [localParticipant, screenOn]);

  // Sync state if tracks change externally
  useEffect(() => {
    setCamOn(localParticipant.isCameraEnabled);
    setMicOn(localParticipant.isMicrophoneEnabled);
    setScreenOn(localParticipant.isScreenShareEnabled);
  }, [localParticipant.isCameraEnabled, localParticipant.isMicrophoneEnabled, localParticipant.isScreenShareEnabled]);

  const btnClass = (active: boolean) =>
    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
      active
        ? "bg-[var(--accent-color)]/15 text-[var(--accent-color)] border border-[var(--accent-color)]/30"
        : "bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10 hover:text-zinc-200"
    }`;

  return (
    <div className="flex items-center gap-2">
      <button onClick={toggleCamera} className={btnClass(camOn)}>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {camOn ? (
            <><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></>
          ) : (
            <><path d="M16.5 7.5L23 7v10l-6.5-.5"/><rect x="1" y="5" width="15" height="14" rx="2"/><line x1="1" y1="1" x2="23" y2="23"/></>
          )}
        </svg>
        {camOn ? "Camera On" : "Camera Off"}
      </button>
      <button onClick={toggleMic} className={btnClass(micOn)}>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {micOn ? (
            <><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
          ) : (
            <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .76-.12 1.49-.34 2.18"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
          )}
        </svg>
        {micOn ? "Mic On" : "Mic Off"}
      </button>
      <button onClick={toggleScreen} className={btnClass(screenOn)}>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>
        </svg>
        {screenOn ? "Stop Share" : "Share Screen"}
      </button>
    </div>
  );
}

// ─── Viewer count ───────────────────────────────────────────────────────────────

function ViewerCount() {
  const participants = useParticipants();
  return (
    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
      {participants.length} watching
    </div>
  );
}

// ─── Video stage — shows the host's main video/screen share ────────────────────

function VideoStage() {
  const allTracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: false },
    ],
    { onlySubscribed: true }
  );

  // Filter to only concrete track references (not placeholders)
  const trackRefs = allTracks.filter((t): t is TrackReference => t.publication !== undefined);

  if (trackRefs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <svg className="mx-auto mb-3 h-10 w-10 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
          <p className="text-sm text-zinc-500">Waiting for host to start streaming...</p>
          <p className="mt-1 text-xs text-zinc-600">The host can share their camera or screen</p>
        </div>
      </div>
    );
  }

  // Prefer screen share, fallback to camera
  const screenTrack = trackRefs.find((t) => t.source === Track.Source.ScreenShare);
  const cameraTrack = trackRefs.find((t) => t.source === Track.Source.Camera);
  const primary = screenTrack || cameraTrack;

  return (
    <div className="relative h-full w-full">
      {primary && (
        <VideoTrack
          trackRef={primary}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      )}
      {/* Picture-in-picture: show camera if screen share is primary */}
      {screenTrack && cameraTrack && (
        <div className="absolute bottom-3 right-3 h-28 w-40 overflow-hidden rounded-lg border border-white/15 shadow-lg">
          <VideoTrack
            trackRef={cameraTrack}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main LiveStream component ─────────────────────────────────────────────────

type LiveStreamProps = {
  roomId: number;
  isHost: boolean;
  isLive: boolean;
};

export function LiveStream({ roomId, isHost, isLive }: LiveStreamProps) {
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string>("");
  const [lkRoom, setLkRoom] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to get stream token");
        return;
      }
      const data = await res.json();
      if (!data.url) {
        setError("LiveKit not configured — contact the admin");
        return;
      }
      setToken(data.token);
      setUrl(data.url);
      setLkRoom(data.room);
    } catch {
      setError("Failed to connect to stream");
    } finally {
      setConnecting(false);
    }
  }, [roomId]);

  // Auto-connect when room goes live
  useEffect(() => {
    if (isLive && !token) {
      connect();
    }
  }, [isLive, token, connect]);

  const disconnect = () => {
    setToken(null);
    setUrl("");
    setLkRoom("");
  };

  // Not live and not connected
  if (!isLive && !token) {
    return (
      <div className="flex h-full items-center justify-center bg-black/30 rounded-xl border border-white/[0.06]">
        <div className="text-center">
          <svg className="mx-auto mb-3 h-10 w-10 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
          <p className="text-sm text-zinc-500">Stream is offline</p>
          {isHost && <p className="mt-1 text-xs text-zinc-600">Click &quot;Go Live&quot; to start streaming</p>}
        </div>
      </div>
    );
  }

  // Loading
  if (connecting) {
    return (
      <div className="flex h-full items-center justify-center bg-black/30 rounded-xl border border-white/[0.06]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent-color)]" />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-black/30 rounded-xl border border-white/[0.06]">
        <div className="text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={connect}
            className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Connected
  if (!token || !url) return null;

  return (
    <div className="flex h-full flex-col rounded-xl border border-white/[0.06] overflow-hidden bg-black">
      <LiveKitRoom
        serverUrl={url}
        token={token}
        connect={true}
        audio={isHost}
        video={isHost}
        onDisconnected={disconnect}
        onError={(err) => { console.error("LiveKit error:", err); setError("Stream connection lost"); }}
        style={{ display: "flex", flexDirection: "column", flex: 1 }}
      >
        {/* Video area */}
        <div className="flex-1 min-h-0 bg-black">
          <VideoStage />
        </div>
        <RoomAudioRenderer />

        {/* Controls bar */}
        <div className="flex shrink-0 items-center justify-between border-t border-white/10 bg-[var(--app-card-alt)] px-4 py-2.5">
          <ViewerCount />
          {isHost ? (
            <HostControls />
          ) : (
            <button
              onClick={disconnect}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition"
            >
              Leave Stream
            </button>
          )}
        </div>
      </LiveKitRoom>
    </div>
  );
}

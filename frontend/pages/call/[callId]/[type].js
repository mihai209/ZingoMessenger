import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  Avatar,
  Box,
  Button,
  Container,
  IconButton,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import MicOffRoundedIcon from "@mui/icons-material/MicOffRounded";
import VideocamRoundedIcon from "@mui/icons-material/VideocamRounded";
import VideocamOffRoundedIcon from "@mui/icons-material/VideocamOffRounded";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

export default function CallPage() {
  const router = useRouter();
  const { callId, type } = router.query;
  const [me, setMe] = useState(null);
  const [call, setCall] = useState(null);
  const [status, setStatus] = useState("connecting");
  const [error, setError] = useState("");
  const [remoteStream, setRemoteStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [ringing, setRinging] = useState(false);
  const localStreamRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const pcRef = useRef(null);
  const esRef = useRef(null);

  const isVideo = type === "video";

  useEffect(() => {
    if (!callId || !type) return;
    let mounted = true;

    async function init() {
      try {
        const meRes = await fetch(`${apiBase}/auth/me`, { credentials: "include" });
        if (meRes.status === 401) {
          router.replace("/login");
          return;
        }
        const meData = await meRes.json();
        if (!mounted) return;
        setMe(meData);

        const callRes = await fetch(`${apiBase}/calls/${callId}`, { credentials: "include" });
        if (!callRes.ok) {
          setError("Call not found.");
          return;
        }
        const callData = await callRes.json();
        if (!mounted) return;
        setCall(callData.call);

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });
        pcRef.current = pc;

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            fetch(`${apiBase}/calls/${callId}/ice`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ candidate: event.candidate }),
              credentials: "include"
            });
          }
        };

        pc.ontrack = (event) => {
          const [stream] = event.streams;
          if (stream) {
            setRemoteStream(stream);
          }
        };

        const constraints = { audio: true, video: isVideo };
        const localStream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = localStream;
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
        if (localVideoRef.current && isVideo) {
          localVideoRef.current.srcObject = localStream;
        }

        const es = new EventSource(`${apiBase}/events`, { withCredentials: true });
        esRef.current = es;
        const isCaller =
          callData.call.fromId === meData.id || callData.call.from?.id === meData.id;
        if (isCaller) {
          setStatus("ringing");
          setRinging(true);
        } else {
          await fetch(`${apiBase}/calls/${callId}/accept`, {
            method: "POST",
            credentials: "include"
          });
        }

        es.addEventListener("call_accept", async (event) => {
          const payload = JSON.parse(event.data);
          if (payload.callId !== callId) return;
          if (!isCaller) return;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await fetch(`${apiBase}/calls/${callId}/offer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sdp: offer }),
            credentials: "include"
          });
          setStatus("connected");
          setRinging(false);
        });
        es.addEventListener("call_offer", async (event) => {
          const payload = JSON.parse(event.data);
          if (payload.callId !== callId) return;
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await fetch(`${apiBase}/calls/${callId}/answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sdp: answer }),
            credentials: "include"
          });
          setStatus("connected");
          setRinging(false);
        });
        es.addEventListener("call_answer", async (event) => {
          const payload = JSON.parse(event.data);
          if (payload.callId !== callId) return;
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          setStatus("connected");
          setRinging(false);
        });
        es.addEventListener("call_ice", async (event) => {
          const payload = JSON.parse(event.data);
          if (payload.callId !== callId) return;
          if (payload.candidate) {
            try {
              await pc.addIceCandidate(payload.candidate);
            } catch (_err) {
              // ignore
            }
          }
        });
        es.addEventListener("call_timeout", (event) => {
          const payload = JSON.parse(event.data);
          if (payload.callId !== callId) return;
          setStatus("timeout");
          setRinging(false);
          cleanup();
        });
        es.addEventListener("call_leave", (event) => {
          const payload = JSON.parse(event.data);
          if (payload.callId !== callId) return;
          setStatus("ended");
          setRinging(false);
          cleanup();
        });
        es.addEventListener("call_decline", (event) => {
          const payload = JSON.parse(event.data);
          if (payload.callId !== callId) return;
          setStatus("declined");
          setRinging(false);
          cleanup();
        });
      } catch (_err) {
        setError("Failed to start call.");
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [callId, type, router]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!ringing) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = 0.12;
    gain.connect(ctx.destination);
    let osc;
    let timer;
    const startTone = () => {
      osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 440;
      osc.connect(gain);
      osc.start();
      setTimeout(() => {
        if (osc) {
          osc.stop();
          osc.disconnect();
          osc = null;
        }
      }, 700);
    };
    startTone();
    timer = setInterval(startTone, 1400);
    return () => {
      clearInterval(timer);
      if (osc) {
        osc.stop();
        osc.disconnect();
      }
      ctx.close();
    };
  }, [ringing]);

  const cleanup = () => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  };

  const handleLeave = async () => {
    if (!callId) return;
    await fetch(`${apiBase}/calls/${callId}/leave`, {
      method: "POST",
      credentials: "include"
    });
    cleanup();
    router.replace("/@me");
  };

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setAudioEnabled(track.enabled);
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setVideoEnabled(track.enabled);
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (callId) {
        fetch(`${apiBase}/calls/${callId}/leave`, {
          method: "POST",
          credentials: "include",
          keepalive: true
        });
      }
      cleanup();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [callId]);

  const otherUser =
    call && me
      ? call.from?.id === me.id
        ? call.to
        : call.from
      : null;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: 6 }}>
      <Container maxWidth="md">
        <Stack spacing={3} alignItems="center">
          <Typography variant="h4">{isVideo ? "Video Call" : "Audio Call"}</Typography>
          {error && (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          )}
          {!error && (
            <>
              <Paper
                elevation={0}
                sx={{
                  width: "100%",
                  p: 2,
                  borderRadius: 2,
                  bgcolor: "rgba(255,255,255,0.04)",
                  display: "flex",
                  alignItems: "center",
                  gap: 2
                }}
              >
                <Avatar
                  src={
                    otherUser?.avatarUrl
                      ? otherUser.avatarUrl.startsWith("http")
                        ? otherUser.avatarUrl
                        : `${apiBase}${otherUser.avatarUrl}`
                      : undefined
                  }
                  sx={{ width: 48, height: 48 }}
                >
                  {otherUser?.username?.[0]}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1">
                    {otherUser?.username || "Unknown"}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.6 }}>
                    {status === "connected"
                      ? "Connected"
                      : status === "ringing"
                        ? "Ringing..."
                        : status === "declined"
                          ? "Declined"
                          : status === "timeout"
                            ? "No answer"
                            : "Connecting..."}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <IconButton onClick={toggleMic} color={audioEnabled ? "primary" : "error"}>
                    {audioEnabled ? <MicRoundedIcon /> : <MicOffRoundedIcon />}
                  </IconButton>
                  {isVideo && (
                    <IconButton onClick={toggleCamera} color={videoEnabled ? "primary" : "error"}>
                      {videoEnabled ? <VideocamRoundedIcon /> : <VideocamOffRoundedIcon />}
                    </IconButton>
                  )}
                </Stack>
              </Paper>
              {isVideo ? (
                <Box
                  sx={{
                    width: "100%",
                    borderRadius: 3,
                    overflow: "hidden",
                    bgcolor: "rgba(255,255,255,0.06)",
                    position: "relative"
                  }}
                >
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    style={{ width: "100%", height: "auto" }}
                  />
                  <Box
                    sx={{
                      position: "absolute",
                      bottom: 16,
                      right: 16,
                      width: 180,
                      borderRadius: 2,
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.2)",
                      bgcolor: "rgba(0,0,0,0.5)"
                    }}
                  >
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: "100%", height: "auto" }}
                    />
                  </Box>
                </Box>
              ) : (
                <Stack spacing={2} alignItems="center">
                  <Avatar
                    src={
                      otherUser?.avatarUrl
                        ? otherUser.avatarUrl.startsWith("http")
                          ? otherUser.avatarUrl
                          : `${apiBase}${otherUser.avatarUrl}`
                        : undefined
                    }
                    sx={{ width: 96, height: 96 }}
                  >
                    {otherUser?.username?.[0]}
                  </Avatar>
                  <Typography variant="body1">
                    {status === "connected" ? "Connected" : "Connecting..."}
                  </Typography>
                </Stack>
              )}
              <Button variant="contained" color="error" onClick={handleLeave}>
                End Call
              </Button>
            </>
          )}
        </Stack>
      </Container>
    </Box>
  );
}

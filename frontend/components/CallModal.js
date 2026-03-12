import { useEffect, useRef, useState } from "react";
import {
  Avatar,
  Box,
  Dialog,
  IconButton,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import MicOffRoundedIcon from "@mui/icons-material/MicOffRounded";
import VideocamRoundedIcon from "@mui/icons-material/VideocamRounded";
import VideocamOffRoundedIcon from "@mui/icons-material/VideocamOffRounded";
import CallEndRoundedIcon from "@mui/icons-material/CallEndRounded";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

export default function CallModal({ open, callId, type, role, onClose }) {
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
  const roleRef = useRef(role);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  const isVideo = type === "video";

  useEffect(() => {
    if (!open || !callId || !type) return undefined;
    let mounted = true;

    async function init() {
      try {
        const meRes = await fetch(`${apiBase}/auth/me`, { credentials: "include" });
        if (meRes.status === 401) {
          setError("Not authenticated.");
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

        if (roleRef.current === "caller") {
          setStatus("ringing");
          setRinging(true);
        } else {
          setStatus("connecting");
        }

        es.addEventListener("call_accept", async (event) => {
          const payload = JSON.parse(event.data);
          if (payload.callId !== callId) return;
          if (roleRef.current !== "caller") return;
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
          handleClose();
        });
        es.addEventListener("call_decline", (event) => {
          const payload = JSON.parse(event.data);
          if (payload.callId !== callId) return;
          setStatus("declined");
          setRinging(false);
          handleClose();
        });
        es.addEventListener("call_leave", (event) => {
          const payload = JSON.parse(event.data);
          if (payload.callId !== callId) return;
          setStatus("ended");
          setRinging(false);
          handleClose();
        });
      } catch (_err) {
        setError("Failed to start call.");
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [open, callId, type]);

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

  const handleClose = () => {
    cleanup();
    onClose?.();
  };

  const handleLeave = async () => {
    if (callId) {
      await fetch(`${apiBase}/calls/${callId}/leave`, {
        method: "POST",
        credentials: "include"
      });
    }
    handleClose();
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

  const otherUser =
    call && me
      ? call.from?.id === me.id
        ? call.to
        : call.from
      : null;

  if (!open) return null;

  return (
    <Dialog open={open} onClose={handleLeave} fullWidth maxWidth="md">
      <Box sx={{ bgcolor: "background.default", p: 3 }}>
        {error ? (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        ) : (
          <Stack spacing={3}>
            <Paper
              elevation={0}
              sx={{
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
                <IconButton onClick={handleLeave} color="error">
                  <CallEndRoundedIcon />
                </IconButton>
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
              <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
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
          </Stack>
        )}
      </Box>
    </Dialog>
  );
}

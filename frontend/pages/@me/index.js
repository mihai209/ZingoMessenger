import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Avatar,
  Badge,
  Box,
  Container,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Popover,
  Paper,
  Tab,
  Tabs,
  Select,
  Slider,
  Stack,
  Typography
} from "@mui/material";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import InsertEmoticonOutlinedIcon from "@mui/icons-material/InsertEmoticonOutlined";
import AttachFileOutlinedIcon from "@mui/icons-material/AttachFileOutlined";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import VolumeOffRoundedIcon from "@mui/icons-material/VolumeOffRounded";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import VideocamRoundedIcon from "@mui/icons-material/VideocamRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import emojiData from "@emoji-mart/data";
import CallModal from "../../components/CallModal";

const EmojiPicker = dynamic(() => import("@emoji-mart/react"), { ssr: false });

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function MediaPlayer({ type, src, tone = "light" }) {
  const mediaRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
    el.playbackRate = rate;
    const onTime = () => setCurrentTime(el.currentTime || 0);
    const onLoaded = () => setDuration(el.duration || 0);
    const onEnded = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("ended", onEnded);
    };
  }, [volume, muted, rate]);

  const togglePlay = async () => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) {
      try {
        await el.play();
        setPlaying(true);
      } catch (_err) {
        // ignore
      }
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const handleSeek = (_e, value) => {
    const el = mediaRef.current;
    if (!el) return;
    const next = Number(value);
    el.currentTime = next;
    setCurrentTime(next);
  };

  const handleVolume = (_e, value) => {
    const next = Number(value);
    setVolume(next);
    if (next > 0 && muted) setMuted(false);
  };

  const toggleMute = () => {
    setMuted((prev) => !prev);
  };

  const handleRate = (event) => {
    const next = Number(event.target.value);
    setRate(next);
  };

  const handleFullscreen = () => {
    const el = mediaRef.current;
    if (!el || !el.requestFullscreen) return;
    el.requestFullscreen().catch(() => {});
  };

  const commonMediaProps = {
    ref: mediaRef,
    src
  };
  const controlColor = tone === "dark" ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.9)";
  const sliderSx =
    tone === "dark"
      ? {
          color: "rgba(0,0,0,0.85)",
          "& .MuiSlider-rail": { opacity: 0.3 },
          "& .MuiSlider-thumb": { border: "2px solid rgba(0,0,0,0.85)" }
        }
      : {
          color: "rgba(255,255,255,0.9)",
          "& .MuiSlider-rail": { opacity: 0.4 }
        };

  return (
    <Box sx={{ width: "100%", maxWidth: type === "video" ? 420 : 320 }}>
      {type === "video" ? (
        <Box
          component="video"
          {...commonMediaProps}
          sx={{
            width: "100%",
            borderRadius: 1,
            bgcolor: "rgba(0,0,0,0.4)"
          }}
        />
      ) : (
        <Box component="audio" {...commonMediaProps} />
      )}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
        <IconButton size="small" onClick={togglePlay} sx={{ color: controlColor }}>
          {playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
        </IconButton>
        <Slider
          size="small"
          min={0}
          max={duration || 0}
          step={1}
          value={Math.min(currentTime, duration || 0)}
          onChange={handleSeek}
          sx={{ flex: 1, ...sliderSx }}
        />
        <Typography variant="caption" sx={{ opacity: 0.7, color: controlColor }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
        <IconButton size="small" onClick={toggleMute} sx={{ color: controlColor }}>
          {muted || volume === 0 ? <VolumeOffRoundedIcon /> : <VolumeUpRoundedIcon />}
        </IconButton>
        <Slider
          size="small"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={handleVolume}
          sx={{ width: 120, ...sliderSx }}
        />
        <Select
          size="small"
          value={rate}
          onChange={handleRate}
          sx={{ minWidth: 80, color: controlColor }}
        >
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((val) => (
            <MenuItem key={val} value={val}>
              {val}x
            </MenuItem>
          ))}
        </Select>
        {type === "video" && (
          <IconButton size="small" onClick={handleFullscreen} sx={{ color: controlColor }}>
            <FullscreenRoundedIcon />
          </IconButton>
        )}
      </Stack>
    </Box>
  );
}

export default function MePage() {
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("User");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [status, setStatus] = useState("online");
  const [inbox, setInbox] = useState([]);
  const [sent, setSent] = useState([]);
  const [friends, setFriends] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [addStatus, setAddStatus] = useState("");
  const [panel, setPanel] = useState("add");
  const [activeChat, setActiveChat] = useState(null);
  const [canChat, setCanChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [emojiAnchor, setEmojiAnchor] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [incomingCall, setIncomingCall] = useState(null);
  const [callInfo, setCallInfo] = useState("");
  const [ringing, setRinging] = useState(false);
  const [callSession, setCallSession] = useState(null);
  const messagesEndRef = useRef(null);
  const activeChatRef = useRef(null);
  const fileInputRef = useRef(null);
  const router = useRouter();
  const apiHeaders = {};

  useEffect(() => {
    let isMounted = true;
    let es;
    async function loadMe() {
      try {
        const res = await fetch(`/api/auth/me`, {
          credentials: "include",
          headers: apiHeaders
        });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const data = await res.json();
        if (isMounted && data?.id) {
          setUserId(data.id);
        }
        if (isMounted && data?.username) {
          setUsername(data.username);
        }
        if (isMounted && data?.avatarUrl) {
          setAvatarUrl(data.avatarUrl);
        }
        if (isMounted && data?.status) {
          setStatus(data.status);
        }

        const inboxRes = await fetch(`/api/friends/inbox`, {
          credentials: "include",
          headers: apiHeaders
        });
        const inboxData = await inboxRes.json().catch(() => ({ items: [] }));
        if (isMounted && inboxData?.items) {
          setInbox(inboxData.items);
        }

        const sentRes = await fetch(`/api/friends/sent`, {
          credentials: "include",
          headers: apiHeaders
        });
        const sentData = await sentRes.json().catch(() => ({ items: [] }));
        if (isMounted && sentData?.items) {
          setSent(sentData.items);
        }

        const friendsRes = await fetch(`/api/friends/list`, {
          credentials: "include",
          headers: apiHeaders
        });
        const friendsData = await friendsRes.json().catch(() => ({ items: [] }));
        if (isMounted && friendsData?.items) {
          setFriends(friendsData.items);
        }

        const callsRes = await fetch(`/api/calls/history`, {
          credentials: "include",
          headers: apiHeaders
        });
        const callsData = await callsRes.json().catch(() => ({ items: [] }));
        if (isMounted && callsData?.items) {
          setCallHistory(callsData.items);
        }

        es = new EventSource(`/api/proxy/events`, { withCredentials: true });
        es.addEventListener("friend_request", (event) => {
          try {
            const payload = JSON.parse(event.data);
            setInbox((prev) => {
              if (prev.find((r) => r.id === payload.id)) return prev;
              return [payload, ...prev];
            });
          } catch (_err) {
            // ignore
          }
        });
        es.addEventListener("friend_response", (event) => {
          try {
            const payload = JSON.parse(event.data);
            setSent((prev) => prev.filter((r) => r.id !== payload.id));
          } catch (_err) {
            // ignore
          }
        });
        es.addEventListener("friend_added", (event) => {
          try {
            const payload = JSON.parse(event.data);
            setFriends((prev) => {
              if (prev.find((f) => f.id === payload.id)) return prev;
              return [payload, ...prev];
            });
            const currentChat = activeChatRef.current;
            if (currentChat && currentChat.userId === payload.id) {
              setCanChat(true);
            }
          } catch (_err) {
            // ignore
          }
        });
        es.addEventListener("friend_status", (event) => {
          try {
            const payload = JSON.parse(event.data);
            setFriends((prev) =>
              prev.map((f) => (f.id === payload.id ? { ...f, status: payload.status } : f))
            );
          } catch (_err) {
            // ignore
          }
        });
        es.addEventListener("message", (event) => {
          try {
            const payload = JSON.parse(event.data);
            const currentChat = activeChatRef.current;
            if (currentChat && payload.chatId === currentChat.chatId) {
              setMessages((prev) => [
                ...prev,
                {
                  id: payload.id || payload.createdAt,
                  fromId: payload.from.id,
                  body: payload.body,
                  attachmentUrl: payload.attachmentUrl || null,
                  attachmentName: payload.attachmentName || null,
                  attachmentMime: payload.attachmentMime || null,
                  attachmentSize: payload.attachmentSize || null,
                  createdAt: payload.createdAt,
                  editedAt: null,
                  deletedAt: null
                }
              ]);
              fetch(`/api/chats/${currentChat.chatId}/read`, {
                method: "POST",
                credentials: "include",
                headers: apiHeaders
              });
              return;
            }
            setFriends((prev) =>
              prev.map((f) =>
                f.id === payload.from.id
                  ? { ...f, unreadCount: (f.unreadCount || 0) + 1 }
                  : f
              )
            );
          } catch (_err) {
            // ignore
          }
        });
        es.addEventListener("message_edit", (event) => {
          try {
            const payload = JSON.parse(event.data);
            const currentChat = activeChatRef.current;
            if (!currentChat || payload.chatId !== currentChat.chatId) return;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === payload.messageId
                  ? { ...m, body: payload.body, editedAt: payload.editedAt }
                  : m
              )
            );
          } catch (_err) {
            // ignore
          }
        });
        es.addEventListener("message_delete", (event) => {
          try {
            const payload = JSON.parse(event.data);
            const currentChat = activeChatRef.current;
            if (!currentChat || payload.chatId !== currentChat.chatId) return;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === payload.messageId
                  ? { ...m, body: "", deletedAt: payload.deletedAt }
                  : m
              )
            );
          } catch (_err) {
            // ignore
          }
        });
        es.addEventListener("friend_removed", (event) => {
          try {
            const payload = JSON.parse(event.data);
            setFriends((prev) => prev.filter((f) => f.id !== payload.id));
            const currentChat = activeChatRef.current;
            if (currentChat && currentChat.userId === payload.id) {
              setCanChat(false);
            }
          } catch (_err) {
            // ignore
          }
        });
        es.addEventListener("call_invite", (event) => {
          try {
            const payload = JSON.parse(event.data);
            setIncomingCall(payload);
            setRinging(true);
          } catch (_err) {
            // ignore
          }
        });
        es.addEventListener("call_decline", () => {
          setCallInfo("Call declined.");
          setRinging(false);
          setCallSession(null);
        });
        es.addEventListener("call_timeout", () => {
          setCallInfo("Call timed out.");
          setRinging(false);
          setCallSession(null);
        });
        es.addEventListener("call_busy", () => {
          setCallInfo("User is busy.");
          setRinging(false);
          setCallSession(null);
        });
        es.addEventListener("call_leave", () => {
          setCallInfo("Call ended.");
          setRinging(false);
          setCallSession(null);
        });
        es.addEventListener("call_history", async () => {
          const callsRes = await fetch(`/api/calls/history`, {
            credentials: "include",
            headers: apiHeaders
          });
          const callsData = await callsRes.json().catch(() => ({ items: [] }));
          setCallHistory(callsData.items || []);
        });
        es.addEventListener("friend_cancel", (event) => {
          try {
            const payload = JSON.parse(event.data);
            setInbox((prev) => prev.filter((r) => r.id !== payload.id));
          } catch (_err) {
            // ignore
          }
        });
        es.onerror = () => {
          es.close();
        };
      } catch (_err) {
        router.replace("/login");
      }
    }
    loadMe();
    return () => {
      isMounted = false;
      if (es) es.close();
    };
  }, [router]);

  const resolvedAvatar =
    avatarUrl && avatarUrl.startsWith("http")
      ? avatarUrl
      : avatarUrl
        ? `/api${avatarUrl}`
        : "/assets/images/default.png";

  const statusColors = {
    online: "#35d07f",
    offline: "#94a3b8",
    dnd: "#ff5d5d",
    sleepy: "#f6c945"
  };

  const resolveAttachmentUrl = (url) => {
    if (!url) return "";
    return url.startsWith("http") ? url : `/api${url}`;
  };

  const formatBytes = (value) => {
    if (!value && value !== 0) return "";
    const units = ["B", "KB", "MB", "GB"];
    let size = Number(value);
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  async function handleLogout() {
    await fetch(`/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: apiHeaders
    });
    router.replace("/login");
  }

  async function handleStatusChange(e) {
    const next = e.target.value;
    setStatus(next);
    await fetch(`/api/account/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...apiHeaders },
      body: JSON.stringify({ status: next }),
      credentials: "include"
    });
  }

  async function handleAddFriend(e) {
    e.preventDefault();
    setAddStatus("");
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const username = form.get("username");
    const res = await fetch(`/api/friends/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...apiHeaders },
      body: JSON.stringify({ username }),
      credentials: "include"
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAddStatus(data?.error || "Request failed");
      return;
    }
    setAddStatus(`Request sent to ${data.toUser}`);
    formEl.reset();
    setSent((prev) => [
      { id: data.id, to: { username: data.toUser, avatarUrl: null }, createdAt: data.createdAt },
      ...prev
    ]);
  }

  async function handleInboxAction(id, action) {
    await fetch(`/api/friends/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...apiHeaders },
      body: JSON.stringify({ requestId: id, action }),
      credentials: "include"
    });
    setInbox((prev) => {
      const current = prev.find((r) => r.id === id);
      if (action === "accept" && current) {
        setFriends((friendsPrev) => {
          if (friendsPrev.find((f) => f.id === current.from.id)) return friendsPrev;
          return [
            {
              id: current.from.id,
              username: current.from.username,
              avatarUrl: current.from.avatarUrl || null,
              status: "online"
            },
            ...friendsPrev
          ];
        });
      }
      return prev.filter((r) => r.id !== id);
    });
  }

  async function handleCancel(id) {
    await fetch(`/api/friends/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...apiHeaders },
      body: JSON.stringify({ requestId: id }),
      credentials: "include"
    });
    setSent((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleRemoveFriend(id) {
    await fetch(`/api/friends/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...apiHeaders },
      body: JSON.stringify({ friendId: id }),
      credentials: "include"
    });
    setFriends((prev) => prev.filter((f) => f.id !== id));
    if (activeChatRef.current && activeChatRef.current.userId === id) {
      setCanChat(false);
    }
  }

  async function openChat(friend) {
    const res = await fetch(`/api/chats/ensure`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...apiHeaders },
      body: JSON.stringify({ username: friend.username }),
      credentials: "include"
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.chatId) return;

    setActiveChat({ chatId: data.chatId, username: friend.username, userId: friend.id });
    activeChatRef.current = { chatId: data.chatId, username: friend.username, userId: friend.id };
    const msgsRes = await fetch(`/api/chats/${data.chatId}/messages`, {
      credentials: "include",
      headers: apiHeaders
    });
    const msgs = await msgsRes.json().catch(() => ({ items: [] }));
    setMessages(msgs.items || []);
    setCanChat(Boolean(msgs.canChat));
    await fetch(`/api/chats/${data.chatId}/read`, {
      method: "POST",
      credentials: "include",
      headers: apiHeaders
    });
    setFriends((prev) =>
      prev.map((f) => (f.id === friend.id ? { ...f, unreadCount: 0 } : f))
    );
  }

  function openContextMenu(e, message) {
    if (message.deletedAt) return;
    const isMine = message.fromId === userId;
    if (!isMine && !message.attachmentUrl) return;
    e.preventDefault();
    setContextMenu({
      mouseX: e.clientX - 2,
      mouseY: e.clientY - 4,
      message
    });
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  function openEmojiPicker(e) {
    setEmojiAnchor(e.currentTarget);
  }

  function closeEmojiPicker() {
    setEmojiAnchor(null);
  }

  async function handleAttachmentChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!activeChat || !canChat) return;
    setUploadError("");
    if (file.size > 400 * 1024 * 1024) {
      setUploadError("File too large (max 400MB).");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    setUploading(true);
    try {
      const res = await fetch(`/api/chats/${activeChat.chatId}/attachments`, {
        method: "POST",
        body: form,
        credentials: "include",
        headers: apiHeaders
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(data?.error || "Upload failed.");
        return;
      }
      if (data?.message) {
        setMessages((prev) => [...prev, data.message]);
      }
    } catch (_err) {
      setUploadError("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleEditSave() {
    if (!activeChat || !editingId || !editingValue.trim()) return;
    const body = editingValue.trim();
    const res = await fetch(
      `/api/chats/${activeChat.chatId}/messages/${editingId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...apiHeaders },
        body: JSON.stringify({ body }),
        credentials: "include"
      }
    );
    if (!res.ok) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === editingId ? { ...m, body, editedAt: new Date().toISOString() } : m
      )
    );
    setEditingId(null);
    setEditingValue("");
  }

  function handleEditCancel() {
    setEditingId(null);
    setEditingValue("");
  }

  async function handleDeleteMessage(messageId) {
    if (!activeChat) return;
    await fetch(`/api/chats/${activeChat.chatId}/messages/${messageId}`, {
      method: "DELETE",
      credentials: "include",
      headers: apiHeaders
    });
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, body: "", deletedAt: new Date().toISOString() } : m
      )
    );
  }

  function handleDownloadAttachment(message) {
    if (!message?.attachmentUrl) return;
    const url = resolveAttachmentUrl(message.attachmentUrl);
    fetch(url, { credentials: "include", headers: apiHeaders })
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = message.attachmentName || "attachment";
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => {});
  }

  async function handleStartCall(type) {
    if (!activeChat) return;
    setCallInfo("");
    const res = await fetch(`/api/calls/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...apiHeaders },
      body: JSON.stringify({ username: activeChat.username, type }),
      credentials: "include"
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.callId) {
      if (data?.error === "busy") {
        setCallInfo("User is busy.");
      } else {
        setCallInfo("Call failed to start.");
      }
      setRinging(false);
      return;
    }
    setCallSession({ callId: data.callId, type, role: "caller" });
  }

  async function acceptCall() {
    if (!incomingCall) return;
    await fetch(`/api/calls/${incomingCall.callId}/accept`, {
      method: "POST",
      credentials: "include",
      headers: apiHeaders
    });
    setCallSession({ callId: incomingCall.callId, type: incomingCall.type, role: "callee" });
    setIncomingCall(null);
    setRinging(false);
  }

  async function declineCall() {
    if (!incomingCall) return;
    await fetch(`/api/calls/${incomingCall.callId}/decline`, {
      method: "POST",
      credentials: "include",
      headers: apiHeaders
    });
    setIncomingCall(null);
    setRinging(false);
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!activeChat || !canChat || !messageInput.trim()) return;
    const body = messageInput.trim();
    setMessageInput("");

    const res = await fetch(`/api/chats/${activeChat.chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...apiHeaders },
      body: JSON.stringify({ body }),
      credentials: "include"
    });
    if (res.status === 403) {
      setCanChat(false);
      return;
    }
    if (!res.ok) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        fromId: userId || "me",
        body,
        createdAt: new Date().toISOString(),
        editedAt: null,
        deletedAt: null
      }
    ]);
  }

  useEffect(() => {
    activeChatRef.current = activeChat;
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const menuMessage = contextMenu?.message || null;
  const menuCanEdit =
    menuMessage && menuMessage.fromId === userId && !menuMessage.attachmentUrl;
  const menuCanDelete = menuMessage && menuMessage.fromId === userId;
  const menuCanDownload = Boolean(menuMessage?.attachmentUrl);

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

  return (
    <>
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Box
        component="nav"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(10px)",
          bgcolor: "rgba(11,13,18,0.8)"
        }}
      >
        <Container maxWidth="lg">
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ py: 1.5 }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ position: "relative" }}>
                <Avatar
                  src={resolvedAvatar}
                  sx={{
                    width: 44,
                    height: 44,
                    border: "2px solid rgba(255,255,255,0.12)"
                  }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 2,
                    right: 2,
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: statusColors[status],
                    border: "2px solid rgba(11,13,18,0.9)"
                  }}
                />
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {username}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                  @me
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Select
                value={status}
                onChange={handleStatusChange}
                size="small"
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="online">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: statusColors.online
                      }}
                    />
                    <span>Online</span>
                  </Stack>
                </MenuItem>
                <MenuItem value="offline">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: statusColors.offline
                      }}
                    />
                    <span>Offline</span>
                  </Stack>
                </MenuItem>
                <MenuItem value="dnd">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: statusColors.dnd
                      }}
                    />
                    <span>Do Not Disturb</span>
                  </Stack>
                </MenuItem>
                <MenuItem value="sleepy">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: statusColors.sleepy
                      }}
                    />
                    <span>Sleepy</span>
                  </Stack>
                </MenuItem>
              </Select>
              <IconButton color="inherit" component={Link} href="/@me/account">
                <SettingsOutlinedIcon />
              </IconButton>
              <IconButton color="inherit" onClick={handleLogout}>
                <LogoutOutlinedIcon />
              </IconButton>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "280px 1fr" } }}>
          <Paper sx={{ p: 2.5 }} elevation={6}>
            <Tabs
              value={panel}
              onChange={(_e, val) => setPanel(val)}
              variant="fullWidth"
              textColor="inherit"
              indicatorColor="secondary"
              sx={{ mb: 2 }}
            >
              <Tab value="add" label="Add" />
              <Tab
                value="inbox"
                label={
                  <Badge color="error" badgeContent={inbox.length}>
                    Inbox
                  </Badge>
                }
              />
              <Tab value="sent" label="Sent" />
              <Tab value="calls" label="Calls" />
            </Tabs>

            {panel === "add" && (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
                  Add friend
                </Typography>
                <Box component="form" onSubmit={handleAddFriend} sx={{ display: "grid", gap: 1.5 }}>
                  <TextField label="Username" name="username" size="small" required />
                  <Button type="submit" variant="contained" size="small">
                    Send request
                  </Button>
                  {addStatus && (
                    <Typography variant="caption" color="secondary">
                      {addStatus}
                    </Typography>
                  )}
                </Box>
              </Box>
            )}

            {panel === "inbox" && (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
                  Inbox
                </Typography>
                <Stack spacing={1.5}>
                  {inbox.length === 0 && (
                    <Typography variant="caption" sx={{ opacity: 0.6 }}>
                      No requests yet.
                    </Typography>
                  )}
                  {inbox.map((req) => (
                    <Stack key={req.id} direction="row" spacing={1.5} alignItems="center">
                      <Avatar
                        src={
                          req.from.avatarUrl
                            ? req.from.avatarUrl.startsWith("http")
                              ? req.from.avatarUrl
                              : `/api${req.from.avatarUrl}`
                            : "/assets/images/default.png"
                        }
                        sx={{ width: 32, height: 32 }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2">{req.from.username}</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.6 }}>
                          {new Date(req.createdAt).toLocaleString()}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" onClick={() => handleInboxAction(req.id, "accept")}>
                          Accept
                        </Button>
                        <Button size="small" onClick={() => handleInboxAction(req.id, "decline")}>
                          Decline
                        </Button>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            {panel === "sent" && (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
                  Sent requests
                </Typography>
                <Stack spacing={1.5}>
                  {sent.length === 0 && (
                    <Typography variant="caption" sx={{ opacity: 0.6 }}>
                      No outgoing requests.
                    </Typography>
                  )}
                  {sent.map((req) => (
                    <Stack key={req.id} direction="row" spacing={1.5} alignItems="center">
                      <Avatar
                        src={
                          req.to.avatarUrl
                            ? req.to.avatarUrl.startsWith("http")
                              ? req.to.avatarUrl
                              : `/api${req.to.avatarUrl}`
                            : "/assets/images/default.png"
                        }
                        sx={{ width: 32, height: 32 }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2">{req.to.username}</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.6 }}>
                          {new Date(req.createdAt).toLocaleString()}
                        </Typography>
                      </Box>
                      <Button size="small" onClick={() => handleCancel(req.id)}>
                        Cancel
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            {panel === "calls" && (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
                  Call history
                </Typography>
                <Stack spacing={1.5}>
                  {callHistory.length === 0 && (
                    <Typography variant="caption" sx={{ opacity: 0.6 }}>
                      No calls yet.
                    </Typography>
                  )}
                  {callHistory.map((call) => (
                    <Stack key={call.id} direction="row" spacing={1.5} alignItems="center">
                      <Avatar
                        src={
                          call.other.avatarUrl
                            ? call.other.avatarUrl.startsWith("http")
                              ? call.other.avatarUrl
                              : `/api${call.other.avatarUrl}`
                            : "/assets/images/default.png"
                        }
                        sx={{ width: 32, height: 32 }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2">
                          {call.other.username}
                          {call.type === "video" ? " • Video" : " • Audio"}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.6 }}>
                          {call.status}
                          {call.durationSeconds
                            ? ` • ${Math.floor(call.durationSeconds / 60)}:${String(
                                call.durationSeconds % 60
                              ).padStart(2, "0")}`
                            : ""}
                        </Typography>
                      </Box>
                      <HistoryRoundedIcon sx={{ opacity: 0.5 }} fontSize="small" />
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
              Friends
            </Typography>
            <Stack spacing={1.5}>
              {friends.length === 0 && (
                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                  No friends yet.
                </Typography>
              )}
              {friends.map((friend) => (
                <Stack key={friend.id} direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ position: "relative" }}>
                    <Avatar
                      src={
                        friend.avatarUrl
                          ? friend.avatarUrl.startsWith("http")
                            ? friend.avatarUrl
                            : `/api${friend.avatarUrl}`
                          : "/assets/images/default.png"
                      }
                      sx={{ width: 32, height: 32 }}
                    />
                    <Box
                      sx={{
                        position: "absolute",
                        bottom: 1,
                        right: 1,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: statusColors[friend.status || "offline"],
                        border: "2px solid rgba(11,13,18,0.9)"
                      }}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {friend.username}
                  </Typography>
                  {friend.unreadCount > 0 && (
                    <Badge color="error" badgeContent={friend.unreadCount} sx={{ mr: 1 }} />
                  )}
                  <Button size="small" onClick={() => openChat(friend)}>
                    Chat
                  </Button>
                  <Button size="small" onClick={() => handleRemoveFriend(friend.id)}>
                    Remove
                  </Button>
                </Stack>
              ))}
            </Stack>
          </Paper>

          <Paper sx={{ p: { xs: 3, sm: 4 } }} elevation={8}>
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h5">
                  {activeChat ? `Chat with ${activeChat.username}` : "Select a friend to chat"}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <IconButton
                    color="inherit"
                    onClick={() => handleStartCall("audio")}
                    disabled={!activeChat || !canChat}
                  >
                    <PhoneRoundedIcon />
                  </IconButton>
                  <IconButton
                    color="inherit"
                    onClick={() => handleStartCall("video")}
                    disabled={!activeChat || !canChat}
                  >
                    <VideocamRoundedIcon />
                  </IconButton>
                </Stack>
              </Stack>
              {incomingCall && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: "rgba(56,189,248,0.16)",
                    border: "1px solid rgba(56,189,248,0.5)"
                  }}
                >
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
                      <Avatar
                        src={
                          incomingCall.from?.avatarUrl
                            ? incomingCall.from.avatarUrl.startsWith("http")
                              ? incomingCall.from.avatarUrl
                              : `/api${incomingCall.from.avatarUrl}`
                            : "/assets/images/default.png"
                        }
                        sx={{ width: 36, height: 36 }}
                      />
                      <Typography variant="body2">
                        Incoming {incomingCall.type} call from {incomingCall.from?.username}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="contained" onClick={acceptCall}>
                        Accept
                      </Button>
                      <Button size="small" variant="outlined" onClick={declineCall}>
                        Decline
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              )}
              {callInfo && (
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  {callInfo}
                </Typography>
              )}
              {activeChat && !canChat && (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: "rgba(255,93,93,0.2)",
                    border: "1px solid rgba(255,93,93,0.7)"
                  }}
                >
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    Sorry you cant continue this chat you are on spectator mode, until this user
                    added you back in his friends list.
                  </Typography>
                </Box>
              )}
              <Box
                sx={{
                  height: { xs: 320, md: 420 },
                  overflowY: "auto",
                  p: 2,
                  borderRadius: 2,
                  bgcolor: "rgba(255,255,255,0.04)"
                }}
              >
                {messages.length === 0 && (
                  <Typography variant="body2" sx={{ opacity: 0.6 }}>
                    No messages yet.
                  </Typography>
                )}
                <Stack spacing={1.5}>
                  {messages.map((m) => {
                    const isMine = m.fromId === userId || m.fromId === "me";
                    const isDeleted = Boolean(m.deletedAt);
                    const isEditing = editingId === m.id;
                    const isAttachment = Boolean(m.attachmentUrl);
                    const attachmentUrl = isAttachment ? resolveAttachmentUrl(m.attachmentUrl) : "";
                    return (
                      <Box
                        key={m.id}
                        onContextMenu={(e) => openContextMenu(e, m)}
                        sx={{
                          alignSelf: isMine ? "flex-end" : "flex-start",
                          bgcolor: isMine ? "primary.main" : "rgba(255,255,255,0.08)",
                          color: isMine ? "#0b0d12" : "inherit",
                          px: 2,
                          py: 1,
                          borderRadius: 2,
                          maxWidth: "80%",
                          cursor:
                            !isDeleted && (isMine || isAttachment) ? "context-menu" : "default"
                        }}
                      >
                        {isDeleted ? (
                          <Typography variant="body2" sx={{ fontStyle: "italic", opacity: 0.8 }}>
                            Message deleted
                          </Typography>
                        ) : isEditing ? (
                          <Stack spacing={1}>
                            <TextField
                              size="small"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                            />
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Button size="small" onClick={handleEditCancel}>
                                Cancel
                              </Button>
                              <Button size="small" variant="contained" onClick={handleEditSave}>
                                Save
                              </Button>
                            </Stack>
                          </Stack>
                        ) : isAttachment ? (
                          <Stack spacing={1}>
                            {m.attachmentMime?.startsWith("image/") && (
                              <Box
                                component="img"
                                src={attachmentUrl}
                                alt={m.attachmentName || "image"}
                                sx={{ width: "100%", maxWidth: 320, borderRadius: 1 }}
                              />
                            )}
                            {m.attachmentMime?.startsWith("video/") && (
                              <MediaPlayer
                                type="video"
                                src={attachmentUrl}
                                tone={isMine ? "dark" : "light"}
                              />
                            )}
                            {m.attachmentMime?.startsWith("audio/") && (
                              <MediaPlayer
                                type="audio"
                                src={attachmentUrl}
                                tone={isMine ? "dark" : "light"}
                              />
                            )}
                            {!m.attachmentMime?.startsWith("image/") &&
                              !m.attachmentMime?.startsWith("video/") &&
                              !m.attachmentMime?.startsWith("audio/") && (
                                <Typography variant="body2">
                                  {m.attachmentName || "attachment"}
                                </Typography>
                              )}
                            <Typography variant="caption" sx={{ opacity: 0.7 }}>
                              {m.attachmentName || "attachment"}
                              {m.attachmentSize ? ` • ${formatBytes(m.attachmentSize)}` : ""}
                            </Typography>
                          </Stack>
                        ) : (
                          <>
                            <Typography variant="body2">{m.body}</Typography>
                            {m.editedAt && (
                              <Typography variant="caption" sx={{ opacity: 0.7, mt: 0.5 }}>
                                edited
                              </Typography>
                            )}
                          </>
                        )}
                      </Box>
                    );
                  })}
                </Stack>
                <div ref={messagesEndRef} />
              </Box>
              <Box component="form" onSubmit={sendMessage} sx={{ display: "flex", gap: 2 }}>
                <IconButton
                  onClick={openEmojiPicker}
                  disabled={!activeChat || !canChat}
                  color="inherit"
                >
                  <InsertEmoticonOutlinedIcon />
                </IconButton>
                <IconButton
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!activeChat || !canChat || uploading}
                  color="inherit"
                >
                  <AttachFileOutlinedIcon />
                </IconButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  onChange={handleAttachmentChange}
                />
                <TextField
                  fullWidth
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  disabled={!activeChat || !canChat || uploading}
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={!activeChat || !canChat || uploading}
                >
                  Send
                </Button>
              </Box>
              {uploadError && (
                <Typography variant="caption" color="error">
                  {uploadError}
                </Typography>
              )}
            </Stack>
          </Paper>
        </Box>
      </Container>
      </Box>
      <Menu
        open={Boolean(contextMenu)}
        onClose={closeContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        {menuCanEdit && (
          <MenuItem
            onClick={() => {
              if (!menuMessage) return;
              setEditingId(menuMessage.id);
              setEditingValue(menuMessage.body || "");
              closeContextMenu();
            }}
          >
            Edit message
          </MenuItem>
        )}
        {menuCanDownload && (
          <MenuItem
            onClick={() => {
              if (!menuMessage) return;
              handleDownloadAttachment(menuMessage);
              closeContextMenu();
            }}
          >
            Download attachment
          </MenuItem>
        )}
        {menuCanDelete && (
          <MenuItem
            onClick={() => {
              if (!menuMessage) return;
              handleDeleteMessage(menuMessage.id);
              closeContextMenu();
            }}
          >
            Delete message
          </MenuItem>
        )}
      </Menu>
      <Popover
        open={Boolean(emojiAnchor)}
        anchorEl={emojiAnchor}
        onClose={closeEmojiPicker}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <EmojiPicker
          data={emojiData}
          theme="dark"
          onEmojiSelect={(emoji) => {
            setMessageInput((prev) => `${prev}${emoji.native}`);
          }}
        />
      </Popover>
      {callSession && (
        <CallModal
          open={Boolean(callSession)}
          callId={callSession.callId}
          type={callSession.type}
          role={callSession.role}
          onClose={() => setCallSession(null)}
        />
      )}
    </>
  );
}

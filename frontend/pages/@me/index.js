import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Avatar,
  Badge,
  Box,
  Container,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  Select,
  Stack,
  Typography
} from "@mui/material";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";

export default function MePage() {
  const [username, setUsername] = useState("User");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [status, setStatus] = useState("online");
  const [inbox, setInbox] = useState([]);
  const [sent, setSent] = useState([]);
  const [friends, setFriends] = useState([]);
  const [addStatus, setAddStatus] = useState("");
  const [panel, setPanel] = useState("add");
  const router = useRouter();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

  useEffect(() => {
    let isMounted = true;
    let es;
    async function loadMe() {
      try {
        const res = await fetch(`${apiBase}/auth/me`, { credentials: "include" });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const data = await res.json();
        if (isMounted && data?.username) {
          setUsername(data.username);
        }
        if (isMounted && data?.avatarUrl) {
          setAvatarUrl(data.avatarUrl);
        }
        if (isMounted && data?.status) {
          setStatus(data.status);
        }

        const inboxRes = await fetch(`${apiBase}/friends/inbox`, { credentials: "include" });
        const inboxData = await inboxRes.json().catch(() => ({ items: [] }));
        if (isMounted && inboxData?.items) {
          setInbox(inboxData.items);
        }

        const sentRes = await fetch(`${apiBase}/friends/sent`, { credentials: "include" });
        const sentData = await sentRes.json().catch(() => ({ items: [] }));
        if (isMounted && sentData?.items) {
          setSent(sentData.items);
        }

        const friendsRes = await fetch(`${apiBase}/friends/list`, { credentials: "include" });
        const friendsData = await friendsRes.json().catch(() => ({ items: [] }));
        if (isMounted && friendsData?.items) {
          setFriends(friendsData.items);
        }

        es = new EventSource(`${apiBase}/events`, { withCredentials: true });
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
        es.addEventListener("friend_removed", (event) => {
          try {
            const payload = JSON.parse(event.data);
            setFriends((prev) => prev.filter((f) => f.id !== payload.id));
          } catch (_err) {
            // ignore
          }
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
        ? `${apiBase}${avatarUrl}`
        : "/assets/images/default.png";

  const statusColors = {
    online: "#35d07f",
    offline: "#94a3b8",
    dnd: "#ff5d5d",
    sleepy: "#f6c945"
  };

  async function handleLogout() {
    await fetch(`${apiBase}/auth/logout`, { method: "POST", credentials: "include" });
    router.replace("/login");
  }

  async function handleStatusChange(e) {
    const next = e.target.value;
    setStatus(next);
    await fetch(`${apiBase}/account/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const res = await fetch(`${apiBase}/friends/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    await fetch(`${apiBase}/friends/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    await fetch(`${apiBase}/friends/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: id }),
      credentials: "include"
    });
    setSent((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleRemoveFriend(id) {
    await fetch(`${apiBase}/friends/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendId: id }),
      credentials: "include"
    });
    setFriends((prev) => prev.filter((f) => f.id !== id));
  }

  return (
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
                              : `${apiBase}${req.from.avatarUrl}`
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
                              : `${apiBase}${req.to.avatarUrl}`
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
                            : `${apiBase}${friend.avatarUrl}`
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
                  <Button size="small" onClick={() => handleRemoveFriend(friend.id)}>
                    Remove
                  </Button>
                </Stack>
              ))}
            </Stack>
          </Paper>

          <Paper sx={{ p: { xs: 3, sm: 4 } }} elevation={8}>
            <Typography variant="h4" gutterBottom>
              @me
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              Logged in. More coming next.
            </Typography>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}

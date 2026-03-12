import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";

const API_BASE = "/api";

export default function ChatPage() {
  const router = useRouter();
  const { username, chatId } = router.query;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (!chatId) return;
    let es;
    let isMounted = true;

    async function load() {
      const res = await fetch(`${API_BASE}/chats/${chatId}/messages`, {
        credentials: "include"
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json().catch(() => ({ items: [] }));
      if (isMounted) setMessages(data.items || []);

      es = new EventSource(`/api/proxy/events`, { withCredentials: true });
      es.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.chatId === chatId) {
            setMessages((prev) => [
              ...prev,
              {
                id: payload.id || payload.createdAt,
                fromId: payload.from.id,
                body: payload.body,
                createdAt: payload.createdAt
              }
            ]);
            fetch(`${API_BASE}/chats/${chatId}/read`, {
              method: "POST",
              credentials: "include"
            });
          }
        } catch (_err) {
          // ignore
        }
      });
      es.onerror = () => es.close();
    }

    load();
    return () => {
      isMounted = false;
      if (es) es.close();
    };
  }, [chatId, router]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim()) return;
    const body = input.trim();
    setInput("");

    const res = await fetch(`${API_BASE}/chats/${chatId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ body }),
      credentials: "include"
    });

    if (!res.ok) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        fromId: "me",
        body,
        createdAt: new Date().toISOString()
      }
    ]);
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: 3 }}>
      <Container maxWidth="md">
        <Paper elevation={8} sx={{ p: 3, mb: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6">Chat with {username}</Typography>
              <Typography variant="caption" sx={{ opacity: 0.6 }}>
                <Link href="/@me">Back to /@me</Link>
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Paper elevation={6} sx={{ p: 3, minHeight: 320, mb: 2 }}>
          <Stack spacing={1.5}>
            {messages.length === 0 && (
              <Typography variant="body2" sx={{ opacity: 0.6 }}>
                No messages yet.
              </Typography>
            )}
            {messages.map((m) => (
              <Box
                key={m.id}
                sx={{
                  alignSelf: m.fromId === "me" ? "flex-end" : "flex-start",
                  bgcolor: m.fromId === "me" ? "primary.main" : "rgba(255,255,255,0.08)",
                  color: m.fromId === "me" ? "#0b0d12" : "inherit",
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  maxWidth: "80%"
                }}
              >
                <Typography variant="body2">{m.body}</Typography>
              </Box>
            ))}
          </Stack>
        </Paper>

        <Paper elevation={6} sx={{ p: 2 }}>
          <Box component="form" onSubmit={sendMessage} sx={{ display: "flex", gap: 2 }}>
            <TextField
              fullWidth
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <Button type="submit" variant="contained">
              Send
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

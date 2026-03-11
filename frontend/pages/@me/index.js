import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Avatar,
  Box,
  Container,
  IconButton,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";

export default function MePage() {
  const [username, setUsername] = useState("User");
  const [avatarUrl, setAvatarUrl] = useState("");
  const router = useRouter();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

  useEffect(() => {
    let isMounted = true;
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
      } catch (_err) {
        router.replace("/login");
      }
    }
    loadMe();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const resolvedAvatar =
    avatarUrl && avatarUrl.startsWith("http")
      ? avatarUrl
      : avatarUrl
        ? `${apiBase}${avatarUrl}`
        : "/assets/images/default.png";

  async function handleLogout() {
    await fetch(`${apiBase}/auth/logout`, { method: "POST", credentials: "include" });
    router.replace("/login");
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
              <Avatar
                src={resolvedAvatar}
                sx={{
                  width: 44,
                  height: 44,
                  border: "2px solid rgba(255,255,255,0.12)"
                }}
              />
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
        <Paper sx={{ p: { xs: 3, sm: 4 } }} elevation={8}>
          <Typography variant="h4" gutterBottom>
            @me
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Logged in. More coming next.
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}

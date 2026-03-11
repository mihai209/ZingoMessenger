import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Avatar,
  Box,
  Button,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState({
    username: "",
    email: "",
    phone: "",
    avatarUrl: "",
    status: "online"
  });
  const [status, setStatus] = useState("");
  const [avatarUrlInput, setAvatarUrlInput] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);

  useEffect(() => {
    async function loadMe() {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const data = await res.json();
        setProfile({
          username: data.username || "",
          email: data.email || "",
          phone: data.phone || "",
          avatarUrl: data.avatarUrl || "",
          status: data.status || "online"
        });
      } catch (_err) {
        router.replace("/login");
      }
    }
    loadMe();
  }, [router]);

  const resolvedAvatar = profile.avatarUrl
    ? profile.avatarUrl.startsWith("http")
      ? profile.avatarUrl
      : `${API_BASE}${profile.avatarUrl}`
    : "/assets/images/default.png";

  async function handlePassword(e) {
    e.preventDefault();
    setStatus("");

    const form = new FormData(e.currentTarget);
    const payload = {
      currentPassword: form.get("currentPassword"),
      newPassword: form.get("newPassword"),
      newPasswordConfirm: form.get("newPasswordConfirm")
    };

    const res = await fetch(`${API_BASE}/account/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include"
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data?.details?.join("; ") || data?.error || "Password change failed");
      return;
    }

    setStatus("Password updated. You were logged out.");
    router.replace("/login");
  }

  async function handleAvatarUrl(e) {
    e.preventDefault();
    setStatus("");

    const res = await fetch(`${API_BASE}/account/avatar/url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: avatarUrlInput }),
      credentials: "include"
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data?.error || "Avatar update failed");
      return;
    }

    setProfile((prev) => ({ ...prev, avatarUrl: data.avatarUrl }));
    setStatus("Avatar updated.");
  }

  async function handleAvatarUpload(e) {
    e.preventDefault();
    setStatus("");

    if (!avatarFile) {
      setStatus("Select a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", avatarFile);

    const res = await fetch(`${API_BASE}/account/avatar/upload`, {
      method: "POST",
      body: formData,
      credentials: "include"
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data?.error || "Avatar upload failed");
      return;
    }

    setProfile((prev) => ({ ...prev, avatarUrl: data.avatarUrl }));
    setStatus("Avatar updated.");
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
      <Container maxWidth="lg">
        <Paper elevation={8} sx={{ p: { xs: 2.5, md: 4 }, mb: 3 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={3}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar src={resolvedAvatar} sx={{ width: 64, height: 64 }} />
              <Box>
                <Typography variant="h5">Account settings</Typography>
                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  <Link href="/@me">Back to /@me</Link>
                </Typography>
              </Box>
            </Stack>
            {status && (
              <Typography color="secondary" sx={{ alignSelf: "center" }}>
                {status}
              </Typography>
            )}
          </Stack>
        </Paper>

        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 3 }} elevation={6}>
              <Typography variant="h6" gutterBottom>
                Profile
              </Typography>
              <Stack spacing={2}>
                <TextField label="Username" value={profile.username} InputProps={{ readOnly: true }} />
                <TextField label="Email" value={profile.email} InputProps={{ readOnly: true }} />
                <TextField label="Phone" value={profile.phone} InputProps={{ readOnly: true }} />
              </Stack>
            </Paper>

            <Paper sx={{ p: 3, mt: 3 }} elevation={6}>
              <Typography variant="h6" gutterBottom>
                Avatar
              </Typography>
              <Stack spacing={2}>
                <Box component="form" onSubmit={handleAvatarUrl} sx={{ display: "grid", gap: 2 }}>
                  <TextField
                    label="Avatar URL"
                    value={avatarUrlInput}
                    onChange={(e) => setAvatarUrlInput(e.target.value)}
                    placeholder="https://..."
                    required
                  />
                  <Button type="submit" variant="contained">
                    Save URL
                  </Button>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box component="form" onSubmit={handleAvatarUpload} sx={{ display: "grid", gap: 2 }}>
                  <Button variant="outlined" component="label">
                    Choose file
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                    />
                  </Button>
                  <Button type="submit" variant="contained">
                    Upload
                  </Button>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 3 }} elevation={6}>
              <Typography variant="h6" gutterBottom>
                Security
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.7, mb: 2 }}>
                Change your password. You will be logged out after updating it.
              </Typography>
              <Box component="form" onSubmit={handlePassword} sx={{ display: "grid", gap: 2 }}>
                <TextField label="Current password" name="currentPassword" type="password" required />
                <TextField label="New password" name="newPassword" type="password" required />
                <TextField
                  label="Confirm new password"
                  name="newPasswordConfirm"
                  type="password"
                  required
                />
                <Button type="submit" variant="contained">
                  Update password (logout after)
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

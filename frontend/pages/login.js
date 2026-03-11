import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Box,
  Button,
  Container,
  Paper,
  TextField,
  Typography
} from "@mui/material";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

export default function LoginPage() {
  const apiBase = API_BASE;
  const [status, setStatus] = useState("");
  const router = useRouter();

  useEffect(() => {
    console.log("API_BASE", apiBase);
  }, [apiBase]);

  async function handleLogin(e) {
    e.preventDefault();
    setStatus("");

    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const payload = {
      identifier: form.get("identifier"),
      password: form.get("password")
    };

    try {
      console.log("POST", `${apiBase}/auth/login`, payload);
      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Login status", res.status);
      const data = await res.json().catch(() => ({}));
      console.log("Login response", data);
      if (!res.ok) {
        setStatus(data?.error || "Login failed");
        return;
      }
      setStatus(`Signed in: ${data.username}`);
      formEl.reset();
      router.push("/@me");
    } catch (err) {
      console.error("Login error", err);
      setStatus(`Cannot reach backend: ${err?.message || "unknown error"}`);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: { xs: 3, sm: 4 } }} elevation={8}>
          <Typography variant="h4" gutterBottom>
            Login
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.7, mb: 3 }}>
            Welcome back. Sign in to continue.
          </Typography>
          <Box component="form" onSubmit={handleLogin} sx={{ display: "grid", gap: 2 }}>
            <TextField label="Username / Email / Phone" name="identifier" required fullWidth />
            <TextField label="Password" name="password" type="password" required fullWidth />
            <Button type="submit" variant="contained" size="large">
              Sign in
            </Button>
          </Box>
          {status && (
            <Typography sx={{ mt: 2 }} color="secondary">
              {status}
            </Typography>
          )}
          <Typography sx={{ mt: 3 }} variant="body2">
            No account? <Link href="/register">Create one</Link>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  Container,
  Paper,
  TextField,
  Typography
} from "@mui/material";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

export default function RegisterPage() {
  const apiBase = API_BASE;
  const [status, setStatus] = useState("");

  useEffect(() => {
    console.log("API_BASE", apiBase);
  }, [apiBase]);

  async function handleRegister(e) {
    e.preventDefault();
    setStatus("");

    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const payload = {
      username: form.get("username"),
      email: form.get("email") || null,
      phone: form.get("phone") || null,
      password: form.get("password"),
      passwordConfirm: form.get("passwordConfirm"),
      birthDate: form.get("birthDate")
    };

    try {
      console.log("POST", `${apiBase}/auth/register`, payload);
      const res = await fetch(`${apiBase}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Register status", res.status);
      const data = await res.json().catch(() => ({}));
      console.log("Register response", data);
      if (!res.ok) {
        setStatus(data?.details?.join("; ") || data?.error || "Register failed");
        return;
      }
      setStatus(`Created: ${data.username}`);
      formEl.reset();
    } catch (err) {
      console.error("Register error", err);
      setStatus(`Cannot reach backend: ${err?.message || "unknown error"}`);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: { xs: 3, sm: 4 } }} elevation={8}>
          <Typography variant="h4" gutterBottom>
            Register
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.7, mb: 3 }}>
            Create your account to start chatting.
          </Typography>
          <Box component="form" onSubmit={handleRegister} sx={{ display: "grid", gap: 2 }}>
            <TextField label="Username" name="username" required fullWidth />
            <TextField label="Email" name="email" type="email" fullWidth />
            <TextField label="Phone" name="phone" fullWidth />
            <TextField label="Password" name="password" type="password" required fullWidth />
            <TextField label="Confirm Password" name="passwordConfirm" type="password" required fullWidth />
            <TextField label="Birth date" name="birthDate" type="date" required fullWidth InputLabelProps={{ shrink: true }} />
            <Button type="submit" variant="contained" size="large">
              Create account
            </Button>
          </Box>
          {status && (
            <Typography sx={{ mt: 2 }} color="secondary">
              {status}
            </Typography>
          )}
          <Typography sx={{ mt: 3 }} variant="body2">
            Already have an account? <Link href="/login">Sign in</Link>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}

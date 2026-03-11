import { useEffect, useState } from "react";
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem("zingo_user");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.username) {
        setUsername(parsed.username);
      }
    } catch (_err) {
      // ignore parse errors
    }
  }, []);

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
                src="/assets/images/default.png"
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
              <IconButton color="inherit">
                <SettingsOutlinedIcon />
              </IconButton>
              <IconButton color="inherit">
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

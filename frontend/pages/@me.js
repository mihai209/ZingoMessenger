import { Box, Container, Paper, Typography } from "@mui/material";

export default function MePage() {
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <Container maxWidth="sm">
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

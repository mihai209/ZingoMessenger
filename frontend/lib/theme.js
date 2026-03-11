import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#00d4b5" },
    secondary: { main: "#f6c945" },
    background: {
      default: "#0b0d12",
      paper: "#161a22"
    }
  },
  shape: {
    borderRadius: 14
  },
  typography: {
    fontFamily: '"Space Grotesk", "IBM Plex Sans", "Segoe UI", sans-serif'
  }
});

export default theme;

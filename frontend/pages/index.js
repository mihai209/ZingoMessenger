import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

export default function Home() {
  const [apiBase, setApiBase] = useState(API_BASE);
  const [registerStatus, setRegisterStatus] = useState("");
  const [loginStatus, setLoginStatus] = useState("");

  async function handleRegister(e) {
    e.preventDefault();
    setRegisterStatus("");

    const form = new FormData(e.currentTarget);
    const payload = {
      username: form.get("username"),
      email: form.get("email") || null,
      phone: form.get("phone") || null,
      password: form.get("password"),
      passwordConfirm: form.get("passwordConfirm"),
      birthDate: form.get("birthDate")
    };

    try {
      const res = await fetch(`${apiBase}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRegisterStatus(data?.details?.join("; ") || data?.error || "Register failed");
        return;
      }
      setRegisterStatus(`Created: ${data.username}`);
      e.currentTarget.reset();
    } catch (_err) {
      setRegisterStatus("Cannot reach backend.");
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginStatus("");

    const form = new FormData(e.currentTarget);
    const payload = {
      identifier: form.get("identifier"),
      password: form.get("password")
    };

    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoginStatus(data?.error || "Login failed");
        return;
      }
      setLoginStatus(`Signed in: ${data.username}`);
      e.currentTarget.reset();
    } catch (_err) {
      setLoginStatus("Cannot reach backend.");
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="brand">
          <div className="logo">Z</div>
          <div>
            <h1>ZingoMessenger</h1>
            <p>Open-source chat. Web auth first.</p>
          </div>
        </div>
        <div className="api-box">
          <label>API Base</label>
          <input value={apiBase} onChange={(e) => setApiBase(e.target.value)} />
          <span className="hint">Default from NEXT_PUBLIC_API_BASE</span>
        </div>
      </header>

      <main className="grid">
        <section className="card">
          <h2>Register</h2>
          <form onSubmit={handleRegister}>
            <label>Username</label>
            <input name="username" required />

            <label>Email</label>
            <input name="email" type="email" />

            <label>Phone</label>
            <input name="phone" />

            <label>Password</label>
            <input name="password" type="password" required />

            <label>Confirm Password</label>
            <input name="passwordConfirm" type="password" required />

            <label>Birth date</label>
            <input name="birthDate" type="date" required />

            <button type="submit">Create account</button>
          </form>
          {registerStatus && <p className="status">{registerStatus}</p>}
        </section>

        <section className="card">
          <h2>Login</h2>
          <form onSubmit={handleLogin}>
            <label>Username / Email / Phone</label>
            <input name="identifier" required />

            <label>Password</label>
            <input name="password" type="password" required />

            <button type="submit">Sign in</button>
          </form>
          {loginStatus && <p className="status">{loginStatus}</p>}
        </section>
      </main>
    </div>
  );
}

import { Router } from "express";
import { createAuthClient } from "../supabase.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const supabase = createAuthClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const { refresh_token: refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    const supabase = createAuthClient();
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/session", requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
    },
  });
});

router.post("/logout", (req, res) => {
  res.status(204).end();
});

export default router;

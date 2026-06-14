import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const API_KEY = process.env.GROQ_API_KEY;
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

if (!API_KEY) {
  console.error("❌ GROQ_API_KEY is missing from .env");
  process.exit(1);
}

// In-memory user storage (for demo purposes - use a database in production)
const users = [];

// In-memory chat history storage (for demo purposes - use a database in production)
const chatHistory = {};

// In-memory mood storage (for demo purposes - use a database in production)
const moodHistory = {};

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
}

// Signup route
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if user already exists
    const existingUser = users.find((u) => u.email === email);
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "User with this email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      password: hashedPassword,
      createdAt: new Date(),
    };

    users.push(newUser);

    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login route
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user
    const user = users.find((u) => u.email === email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Forgot password route (demo - sends reset link simulation)
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    // Check if user exists
    const user = users.find((u) => u.email === email);

    // In production, you would send an email with a reset link
    // For demo purposes, we'll just return success if user exists
    if (user) {
      // Simulate sending email
      console.log(`Password reset link would be sent to: ${email}`);
      return res.json({ message: "Password reset link sent to your email" });
    }

    // For security, don't reveal if email exists or not
    res.json({
      message:
        "If an account exists with this email, a reset link has been sent",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Save chat message
app.post("/chat/save", authenticateToken, async (req, res) => {
  const { userId, message, type } = req.body;

  try {
    if (!chatHistory[userId]) {
      chatHistory[userId] = [];
    }

    chatHistory[userId].push({
      message,
      type,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Save chat error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get chat history
app.get("/chat/history/:userId", authenticateToken, async (req, res) => {
  const { userId } = req.params;

  try {
    const messages = chatHistory[userId] || [];
    res.json({ messages });
  } catch (error) {
    console.error("Get chat history error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Clear chat history
app.delete("/chat/clear/:userId", authenticateToken, async (req, res) => {
  const { userId } = req.params;

  try {
    chatHistory[userId] = [];
    res.json({ success: true });
  } catch (error) {
    console.error("Clear chat error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Save mood
app.post("/mood/save", authenticateToken, async (req, res) => {
  const { userId, mood } = req.body;

  try {
    if (!moodHistory[userId]) {
      moodHistory[userId] = [];
    }

    moodHistory[userId].push({
      mood,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Save mood error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get mood history
app.get("/mood/history/:userId", authenticateToken, async (req, res) => {
  const { userId } = req.params;

  try {
    const moods = moodHistory[userId] || [];
    res.json({ moods });
  } catch (error) {
    console.error("Get mood history error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/chat", async (req, res) => {
  const { message } = req.body;

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: `You are D-ONE AI, a calm and supportive mental health assistant.
- Be empathetic and human-like
- Keep responses short
- Do not give medical diagnosis
- Encourage professional help when necessary
- If user mentions self-harm → prioritize safety`,
            },
            { role: "user", content: message },
          ],
        }),
      },
    );

    const data = await response.json();
    console.log("Groq response:", JSON.stringify(data, null, 2)); // 👈 debug log
    const reply =
      data.choices?.[0]?.message?.content || "Sorry, I couldn't respond.";
    res.json({ reply }); // 👈 this was missing!
  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ reply: "Server error. Try again." });
  }
});

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});

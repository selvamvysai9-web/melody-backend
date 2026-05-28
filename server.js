require('dotenv').config();
const express = require('express');
const cors = require('cors');
const play = require('play-dl');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// --- SECURITY MIDDLEWARE: Admin Guard ---
const adminAuth = (req, res, next) => {
  const secret = req.headers['x-admin-secret'];
  if (secret && secret === process.env.ADMIN_SECRET_KEY) {
    next();
  } else {
    res.status(403).json({ error: "Access Denied: Unauthorized Admin Access" });
  }
};

// =====================================================================
// STREAMING ENDPOINTS (Public)
// =====================================================================
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!query) return res.status(400).json({ error: 'Missing search query' });
  
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    const results = data.items.map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.high.url
    }));
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'YouTube search failed' });
  }
});

app.get('/api/stream', async (req, res) => {
  const videoId = req.query.videoId;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });
  try {
    const info = await play.video_info(`https://www.youtube.com/watch?v=${videoId}`);
    const audioFormats = info.format.filter(f => f.hasAudio && !f.hasVideo);
    res.json({ url: audioFormats[0]?.url || info.format[0].url });
  } catch (error) {
    res.status(500).json({ error: 'Stream extraction failed' });
  }
});

// =====================================================================
// ADMIN ENDPOINTS (Protected)
// =====================================================================
app.post('/api/admin/add-song', adminAuth, (req, res) => {
  // Logic to save song to your database
  console.log("Admin Action: Song Added", req.body);
  res.json({ success: true, message: "Song successfully recorded in database" });
});

app.patch('/api/admin/user-role', adminAuth, (req, res) => {
  // Logic to update user roles
  console.log("Admin Action: Role Updated", req.body);
  res.json({ success: true, message: "User role updated successfully" });
});

// Server Startup
app.listen(PORT, () => {
  console.log(`\n=========================================`);
  console.log(`🚀 Melody Hub Backend is LIVE!`);
  console.log(`🔌 Listening on port: ${PORT}`);
  console.log(`🔒 Secure Mode: Admin Protection Enabled`);
  console.log(`=========================================\n`);
});

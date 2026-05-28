require('dotenv').config();
const express = require('express');
const cors = require('cors');
const play = require('play-dl');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- SECURITY MIDDLEWARE ---
// Only requests with the correct header 'x-admin-secret' can pass
const adminAuth = (req, res, next) => {
  const secret = req.headers['x-admin-secret'];
  if (secret && secret === process.env.ADMIN_SECRET_KEY) {
    next();
  } else {
    res.status(403).json({ error: "Access Denied: Unauthorized" });
  }
};

// --- STREAMING ENDPOINTS (Your working logic) ---

app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!query) return res.status(400).json({ error: 'Missing query' });
  
  try {
    const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&key=${apiKey}`;
    const response = await fetch(youtubeApiUrl);
    const data = await response.json();
    const videos = data.items.map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.high.url
    }));
    res.json({ results: videos });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
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
    res.status(500).json({ error: 'Stream failed' });
  }
});

// --- ADMIN ENDPOINTS (Protected) ---

app.post('/api/admin/add-song', adminAuth, (req, res) => {
  const { title, artist, lyrics } = req.body;
  // TODO: Add database logic here (Firestore/MongoDB)
  res.json({ success: true, message: `Song '${title}' added.` });
});

app.patch('/api/admin/user-role', adminAuth, (req, res) => {
  const { userId, role } = req.body;
  // TODO: Add user update logic here
  res.json({ success: true, message: `User ${userId} updated to ${role}.` });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Melody Hub Backend is LIVE!`);
  console.log(`🔌 Listening on: http://localhost:${PORT}`);
  console.log(`🔒 Secure Mode: Active (Admin routes protected)\n`);
});

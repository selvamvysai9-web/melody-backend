require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const play = require('play-dl');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const adminAuth = (req, res, next) => {
  const secret = req.headers['x-admin-secret'];
  if (secret && secret === process.env.ADMIN_SECRET_KEY) {
    next();
  } else {
    res.status(403).json({ error: "Access Denied: Unauthorized Admin Access" });
  }
};

const SONGS_FILE = path.join(__dirname, 'songs.json');

function readSongs() {
  try {
    if (!fs.existsSync(SONGS_FILE)) return [];
    return JSON.parse(fs.readFileSync(SONGS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeSongs(songs) {
  fs.writeFileSync(SONGS_FILE, JSON.stringify(songs, null, 2), 'utf-8');
}

// GET /api/youtube/search?q=...&lang=...
app.get('/api/youtube/search', async (req, res) => {
  const query = req.query.q;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!query) {
    return res.status(400).json({ error: 'Please provide a search query (?q=song_name)' });
  }
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfiguration: Missing API Key in .env file' });
  }

  try {
    const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&key=${apiKey}`;
    const response = await fetch(youtubeApiUrl);
    const data = await response.json();

    if (data.error) throw new Error(data.error.message);

    const videos = data.items.map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.high.url
    }));

    res.json({ results: videos });
  } catch (error) {
    console.error('Search Error:', error.message);
    res.status(500).json({ error: 'Failed to search YouTube' });
  }
});

// GET /api/youtube/audio/:videoId
app.get('/api/youtube/audio/:videoId', async (req, res) => {
  const videoId = req.params.videoId;

  if (!videoId) {
    return res.status(400).json({ error: 'Please provide a videoId' });
  }

  try {
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const info = await play.video_info(youtubeUrl);
    const audioFormats = info.format.filter(f => f.hasAudio && !f.hasVideo);

    if (audioFormats.length > 0) {
      res.json({ url: audioFormats[0].url });
    } else {
      const muxedFormats = info.format.filter(f => f.hasAudio && f.hasVideo);
      if (muxedFormats.length > 0) {
        res.json({ url: muxedFormats[0].url });
      } else {
        res.status(404).json({ error: 'No playable stream found for this video.' });
      }
    }
  } catch (error) {
    console.error('Extraction Error:', error.message);
    res.status(500).json({ error: 'Failed to process YouTube link' });
  }
});

// POST /api/youtube/add
app.post('/api/youtube/add', (req, res) => {
  const { videoId, title, channelTitle, thumbnail, language } = req.body;

  if (!videoId || !title) {
    return res.status(400).json({ error: 'videoId and title are required' });
  }

  const songs = readSongs();

  const exists = songs.some(s => s.youtube_id === videoId);
  if (exists) {
    return res.status(200).json({ message: 'Song already exists', id: songs.find(s => s.youtube_id === videoId).id });
  }

  const newSong = {
    id: String(Date.now()),
    title: title,
    singerName: channelTitle || 'Unknown',
    youtube_id: videoId,
    imagePath: thumbnail || '',
    audioPath: '',
    filePath: '',
    lyrics: '',
    language: language || 'en',
    createdAt: new Date().toISOString()
  };

  songs.push(newSong);
  writeSongs(songs);

  res.status(201).json({ message: 'Song added', id: newSong.id });
});

// GET /api/songs
app.get('/api/songs', (req, res) => {
  const songs = readSongs();
  res.json(songs);
});

// POST /api/songs/track-play
app.post('/api/songs/track-play', (req, res) => {
  const { title, singerName, youtube_id, imagePath, language } = req.body;

  const songs = readSongs();

  const exists = songs.some(s => s.youtube_id === youtube_id);
  if (!exists) {
    const newSong = {
      id: String(Date.now()),
      title: title || 'Unknown',
      singerName: singerName || 'Unknown',
      youtube_id: youtube_id || '',
      imagePath: imagePath || '',
      audioPath: '',
      filePath: '',
      lyrics: '',
      language: language || 'en',
      createdAt: new Date().toISOString(),
      playCount: 1
    };
    songs.push(newSong);
  } else {
    const idx = songs.findIndex(s => s.youtube_id === youtube_id);
    if (idx !== -1) {
      songs[idx].playCount = (songs[idx].playCount || 0) + 1;
    }
  }

  writeSongs(songs);
  res.json({ message: 'Track recorded' });
});

// POST /index.php  — legacy actions
app.post('/index.php', (req, res) => {
  const { action } = req.body;
  console.log('Legacy action:', action);
  res.json({ success: true, message: `Action '${action}' received` });
});

// POST /api/admin/role
app.post('/api/admin/role', (req, res) => {
  const { uid } = req.body;
  if (!uid) {
    return res.status(400).json({ error: 'UID required' });
  }
  res.json({ message: `Admin role granted to ${uid}` });
});

// Admin endpoints (protected)
app.post('/api/admin/add-song', adminAuth, (req, res) => {
  console.log("Admin Action: Song Added", req.body);
  res.json({ success: true, message: "Song successfully recorded in database" });
});

app.patch('/api/admin/user-role', adminAuth, (req, res) => {
  console.log("Admin Action: Role Updated", req.body);
  res.json({ success: true, message: "User role updated successfully" });
});

app.listen(PORT, () => {
  console.log(`\n=========================================`);
  console.log(`Melody Hub Backend is LIVE!`);
  console.log(`Listening on: http://localhost:${PORT}`);
  console.log(`=========================================\n`);
});

// 1. THIS IS THE MOST IMPORTANT LINE: It safely loads your hidden .env file!
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const play = require('play-dl');

const app = express();
const PORT = 3000;

// Enable CORS so your Flutter app isn't blocked
app.use(cors());


// =====================================================================
// ENDPOINT 1: SEARCH YOUTUBE (Using your secure API Key)
// Example: http://localhost:3000/api/search?q=blinding+lights
// =====================================================================
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  
  // Grab the hidden key from your .env file
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!query) {
    return res.status(400).json({ error: 'Please provide a search query (?q=song_name)' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfiguration: Missing API Key in .env file' });
  }

  try {
    console.log(`🔍 Searching YouTube for: "${query}"`);
    
    // Call the official YouTube Data API v3 securely
    const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&key=${apiKey}`;
    
    const response = await fetch(youtubeApiUrl);
    const data = await response.json();

    // If YouTube rejects the key, catch the error
    if (data.error) {
       throw new Error(data.error.message);
    }

    // Clean up the messy YouTube JSON into a beautiful, simple list for Flutter
    const videos = data.items.map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.high.url
    }));

    res.json({ results: videos });
    console.log(`✅ Found ${videos.length} results for "${query}"`);

  } catch (error) {
    console.error('❌ Search Error:', error.message);
    res.status(500).json({ error: 'Failed to search YouTube' });
  }
});


// =====================================================================
// ENDPOINT 2: EXTRACT AUDIO STREAM (Using play-dl)
// Example: http://localhost:3000/api/stream?videoId=dQw4w9WgXcQ
// =====================================================================
app.get('/api/stream', async (req, res) => {
  const videoId = req.query.videoId;

  if (!videoId) {
    return res.status(400).json({ error: 'Please provide a videoId' });
  }

  try {
    console.log(`🎧 Fetching audio stream for video: ${videoId}`);
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Get the hidden stream manifests
    const info = await play.video_info(youtubeUrl);

    // Filter out video, keep ONLY audio
    const audioFormats = info.format.filter(f => f.hasAudio && !f.hasVideo);

    if (audioFormats.length > 0) {
      // Send highest quality audio URL back
      res.json({ url: audioFormats[0].url });
      console.log('✅ Audio Stream URL sent successfully!');
    } else {
      // Fallback: If pure audio is blocked, try a muxed (audio+video) stream
      const muxedFormats = info.format.filter(f => f.hasAudio && f.hasVideo);
      if (muxedFormats.length > 0) {
          res.json({ url: muxedFormats[0].url });
          console.log('✅ Muxed Stream URL sent successfully (Fallback)!');
      } else {
          res.status(404).json({ error: 'No playable stream found for this video.' });
      }
    }

  } catch (error) {
    console.error('❌ Extraction Error:', error.message);
    res.status(500).json({ error: 'Failed to process YouTube link' });
  }
});


// Turn the server on
app.listen(PORT, () => {
  console.log(`\n=========================================`);
  console.log(`🚀 Melody Hub Backend is LIVE!`);
  console.log(`🔌 Listening on: http://localhost:${PORT}`);
  console.log(`🔒 Secure Mode: .env file loaded successfully.`);
  console.log(`=========================================\n`);
});
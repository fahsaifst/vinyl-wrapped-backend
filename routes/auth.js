const express = require('express');
const router = express.Router();
const axios = require('axios');
const querystring = require('querystring');
require('dotenv').config();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// 1. Redirect to Spotify login
router.get('/login', (req, res) => {
  const scope = 'user-top-read';
  const authURL = 'https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: scope,
      redirect_uri: REDIRECT_URI,
    });
  res.redirect(authURL);
});

// 2. Callback: Receive Spotify Code → get token → redirect to frontend
router.get('/callback', async (req, res) => {
  const code = req.query.code;

  try {
    const tokenRes = await axios.post(
      'https://accounts.spotify.com/api/token',
      querystring.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
      {
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

     const { access_token, refresh_token } = tokenRes.data;
    res.redirect(`https://vinyl-wrapped-dqrc.vercel.app/callback?access_token=${access_token}&refresh_token=${refresh_token}`);
  } catch (err) {
    console.error('Token Error:', err.response?.data || err);
    res.send('Authentication Failed');
  }
});

// 3. API: Get top tracks
// routes/auth.js

router.get('/top-tracks', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const topTracksRes = await axios.get(
      'https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=short_term',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const topTracks = topTracksRes.data.items;

    res.json({
      tracks: topTracks.map((track) => ({
        name: track.name,
        artist: track.artists.map((a) => a.name).join(', '),
        album: track.album.name,
        image: track.album.images[0]?.url,
        duration_ms: track.duration_ms, // Include duration
      })),
    });
  } catch (err) {
    console.error('Error fetching top tracks:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch top tracks' });
  }
});

//refresh token endpoint
router.post('/refresh-token', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Missing refresh token' });
  }

  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token,
      }),
      {
        headers: {
          Authorization:
            'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token } = response.data;
    res.json({ access_token });
  } catch (err) {
    console.error('Error refreshing token:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});




module.exports = router;

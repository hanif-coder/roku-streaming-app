const express = require('express');
const axios = require('axios');
const { execFile } = require('child_process');
const { promisify } = require('util');

const router = express.Router();
const MIN_QUERY_LENGTH = 2;
const execFileAsync = promisify(execFile);
const YTDLP_TIMEOUT_MS = 30000;

function mapInvidiousItem(item) {
  return {
    videoId: item.videoId || '',
    title: item.title || '',
    author: item.author || '',
    lengthSeconds: Number(item.lengthSeconds || 0) || 0,
    thumbnails: item.videoThumbnails || item.thumbnails || [],
  };
}

function mapYtDlpItem(item) {
  const videoId = item.id || item.videoId || '';
  return {
    videoId,
    title: item.title || '',
    author: item.uploader || item.channel || item.author || '',
    lengthSeconds: Number(item.duration || item.lengthSeconds || 0) || 0,
    thumbnails: item.thumbnail ? [{ url: item.thumbnail }] : [],
  };
}

async function searchWithInvidious(query) {
  const baseUrl = process.env.INVIDIOUS_BASE_URL;
  if (!baseUrl) return null;

  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/search`;
  const { data } = await axios.get(url, {
    params: { q: query, type: 'video' },
    timeout: 10000,
  });

  const items = Array.isArray(data) ? data : [];
  return items.slice(0, 10).map(mapInvidiousItem);
}

async function searchWithYtDlp(query) {
  const ytDlpPath = process.env.YTDLP_PATH || 'yt-dlp';
  const baseArgs = [
    '--dump-single-json',
    '--no-warnings',
    '--skip-download',
    '--flat-playlist',
  ];
  const primaryArgs = [
    ...baseArgs,
    `ytsearch10:${query}`,
  ];
  const fallbackArgs = [
    ...baseArgs,
    '--extractor-args',
    'youtube:player_client=android',
    `ytsearch10:${query}`,
  ];

  try {
    const { stdout } = await execFileAsync(ytDlpPath, primaryArgs, {
      timeout: YTDLP_TIMEOUT_MS,
      maxBuffer: 20 * 1024 * 1024,
    });
    const parsed = JSON.parse(stdout);
    const items = Array.isArray(parsed.entries) ? parsed.entries : [];
    return items.slice(0, 10).map(mapYtDlpItem);
  } catch (err) {
    const { stdout } = await execFileAsync(ytDlpPath, fallbackArgs, {
      timeout: YTDLP_TIMEOUT_MS,
      maxBuffer: 20 * 1024 * 1024,
    });
    const parsed = JSON.parse(stdout);
    const items = Array.isArray(parsed.entries) ? parsed.entries : [];
    return items.slice(0, 10).map(mapYtDlpItem);
  }
}

router.get('/', async (req, res, next) => {
  try {
    const q = req.query.q;
    if (q === undefined || q === null || String(q).trim() === '') {
      res.status(400).json({ success: false, message: 'Query parameter "q" is required' });
      return;
    }
    const query = String(q).trim();
    if (query.length < MIN_QUERY_LENGTH) {
      res.status(400).json({
        success: false,
        message: `Query "q" must be at least ${MIN_QUERY_LENGTH} characters`,
      });
      return;
    }

    let items = null;
    try {
      items = await searchWithInvidious(query);
    } catch (_) {
      items = null;
    }

    if (!items || items.length === 0) {
      items = await searchWithYtDlp(query);
    }

    res.json({
      success: true,
      total: items.length,
      data: items,
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.status(500).json({
        success: false,
        message: 'yt-dlp is not installed on server',
      });
      return;
    }
    if (err.killed || err.signal === 'SIGTERM') {
      res.status(500).json({
        success: false,
        message: 'Search request timed out',
      });
      return;
    }
    if (err.stderr) {
      console.error('Search extraction stderr:', err.stderr);
      res.status(500).json({
        success: false,
        message: 'Search extraction failed',
      });
      return;
    }
    next(err);
  }
});

module.exports = router;

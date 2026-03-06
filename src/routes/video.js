const express = require('express');
const { execFile } = require('child_process');
const { promisify } = require('util');

const router = express.Router();
const execFileAsync = promisify(execFile);
const YTDLP_TIMEOUT_MS = 30000;

function buildWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

function parseExpireFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    const expire = u.searchParams.get('expire');
    if (expire == null) return null;
    const n = parseInt(expire, 10);
    return Number.isNaN(n) ? null : n;
  } catch (_) {
    return null;
  }
}

function pickStreamUrl(meta) {
  if (typeof meta?.url === 'string' && meta.url.length > 0) return meta.url;
  if (Array.isArray(meta?.requested_formats)) {
    const first = meta.requested_formats.find((f) => typeof f?.url === 'string' && f.url.length > 0);
    if (first?.url) return first.url;
  }
  return null;
}

async function getVideoMetaFromYtDlp(videoId) {
  const ytDlpPath = process.env.YTDLP_PATH || 'yt-dlp';
  const args = [
    '--no-playlist',
    '--dump-single-json',
    '--no-warnings',
    '--skip-download',
    '--format',
    'best[ext=mp4][acodec!=none][vcodec!=none]/best[ext=mp4]/best',
    buildWatchUrl(videoId),
  ];

  const { stdout } = await execFileAsync(ytDlpPath, args, {
    timeout: YTDLP_TIMEOUT_MS,
    maxBuffer: 20 * 1024 * 1024,
  });

  return JSON.parse(stdout);
}

router.get('/', async (req, res, next) => {
  try {
    const id = req.query.id;
    if (id === undefined || id === null || String(id).trim() === '') {
      res.status(400).json({ success: false, message: 'Query parameter "id" is required' });
      return;
    }
    const videoId = String(id).trim();
    const meta = await getVideoMetaFromYtDlp(videoId);
    const streamUrl = pickStreamUrl(meta);
    if (!streamUrl) {
      res.status(502).json({
        success: false,
        message: 'No suitable stream found for this video',
      });
      return;
    }

    const expireAt = parseExpireFromUrl(streamUrl);

    res.json({
      success: true,
      videoId,
      title: meta.title ?? '',
      author: meta.uploader ?? meta.channel ?? '',
      lengthSeconds: Number(meta.duration ?? 0) || 0,
      streamUrl,
      expireAt,
    });
  } catch (err) {
    const stderr = String(err.stderr || '');
    if (err.code === 'ENOENT') {
      res.status(500).json({ success: false, message: 'yt-dlp is not installed on server' });
      return;
    }
    if (err.killed || err.signal === 'SIGTERM') {
      res.status(504).json({ success: false, message: 'Video extraction timed out' });
      return;
    }
    if (
      /video unavailable|private video|This video is unavailable|no longer available/i.test(stderr)
    ) {
      res.status(404).json({ success: false, message: 'Video not found' });
      return;
    }
    if (/sign in to confirm your age|login required|members-only/i.test(stderr)) {
      res.status(403).json({ success: false, message: 'Video requires authentication' });
      return;
    }
    if (stderr) {
      res.status(502).json({ success: false, message: 'Video extraction failed' });
      return;
    }
    next(err);
  }
});

module.exports = router;

const express = require('express');
const { execFile } = require('child_process');
const { promisify } = require('util');

const router = express.Router();
const MIN_QUERY_LENGTH = 2;
const execFileAsync = promisify(execFile);
const YTDLP_TIMEOUT_MS = 30000;

function mapItem(item) {
  const videoId = item.id || item.videoId || '';
  return {
    videoId,
    title: item.title || '',
    author: item.uploader || item.channel || item.author || '',
    lengthSeconds: Number(item.duration || item.lengthSeconds || 0) || 0,
    thumbnails: item.thumbnail ? [{ url: item.thumbnail }] : [],
  };
}

async function searchWithYtDlp(query) {
  const ytDlpPath = process.env.YTDLP_PATH || 'yt-dlp';
  const args = [
    '--dump-single-json',
    '--no-warnings',
    '--skip-download',
    `ytsearch10:${query}`,
  ];

  const { stdout } = await execFileAsync(ytDlpPath, args, {
    timeout: YTDLP_TIMEOUT_MS,
    maxBuffer: 20 * 1024 * 1024,
  });

  const parsed = JSON.parse(stdout);
  return Array.isArray(parsed.entries) ? parsed.entries : [];
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

    const items = await searchWithYtDlp(query);
    const top10 = items.slice(0, 10).map(mapItem);

    res.json({
      success: true,
      total: top10.length,
      data: top10,
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

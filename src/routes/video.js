const express = require('express');
const axios = require('axios');

const router = express.Router();

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

function pickStreamFromAdaptiveFormats(adaptiveFormats) {
  if (!Array.isArray(adaptiveFormats) || adaptiveFormats.length === 0) return null;

  const withHlsUrl = adaptiveFormats.find((f) => f.hlsUrl);
  if (withHlsUrl?.hlsUrl) return withHlsUrl.hlsUrl;

  const hlsFormat = adaptiveFormats.find(
    (f) => f.mimeType && String(f.mimeType).includes('application/x-mpegURL')
  );
  if (hlsFormat?.url) return hlsFormat.url;
  if (hlsFormat?.hlsUrl) return hlsFormat.hlsUrl;

  const mp4WithAudio = adaptiveFormats
    .filter(
      (f) =>
        f.mimeType &&
        (String(f.mimeType).includes('video/mp4') || String(f.mimeType).includes('audio/mp4'))
    )
    .sort((a, b) => (b.bitrate || b.qualityLabel || 0) - (a.bitrate || a.qualityLabel || 0));
  if (mp4WithAudio[0]?.url) return mp4WithAudio[0].url;

  const anyWithUrl = adaptiveFormats.find((f) => f.url);
  return anyWithUrl?.url || null;
}

function pickStreamFromFormatStreams(formatStreams) {
  if (!Array.isArray(formatStreams) || formatStreams.length === 0) return null;
  const mp4 = formatStreams
    .filter((f) => f.type && String(f.type).includes('video/mp4'))
    .sort((a, b) => (b.bitrate || b.quality || 0) - (a.bitrate || a.quality || 0));
  if (mp4[0]?.url) return mp4[0].url;
  const any = formatStreams.find((f) => f.url);
  return any?.url || null;
}

router.get('/', async (req, res, next) => {
  try {
    const id = req.query.id;
    if (id === undefined || id === null || String(id).trim() === '') {
      res.status(400).json({ success: false, message: 'Query parameter "id" is required' });
      return;
    }
    const videoId = String(id).trim();

    const baseUrl = process.env.INVIDIOUS_BASE_URL;
    if (!baseUrl) {
      res.status(500).json({ success: false, message: 'Video service is not configured' });
      return;
    }

    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/videos/${videoId}`;
    const { data } = await axios.get(url, {
      params: { local: 'true' },
      timeout: 15000,
    });

    const title = data.title ?? '';
    const description = data.description ?? '';
    const author = data.author ?? '';
    const lengthSeconds = data.lengthSeconds ?? 0;
    const adaptiveFormats = data.adaptiveFormats ?? [];
    const formatStreams = data.formatStreams ?? [];

    const streamUrl =
      pickStreamFromAdaptiveFormats(adaptiveFormats) ||
      pickStreamFromFormatStreams(formatStreams);
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
      title,
      author,
      lengthSeconds,
      streamUrl,
      expireAt,
    });
  } catch (err) {
    if (err.response?.status === 404) {
      res.status(404).json({ success: false, message: 'Video not found' });
      return;
    }
    if (err.response) {
      res.status(500).json({ success: false, message: 'Upstream video request failed' });
      return;
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
      res.status(503).json({ success: false, message: 'Video service unavailable' });
      return;
    }
    next(err);
  }
});

module.exports = router;

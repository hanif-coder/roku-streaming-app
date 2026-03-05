const express = require('express');
const axios = require('axios');

const router = express.Router();
const MIN_QUERY_LENGTH = 2;

function mapItem(item) {
  return {
    videoId: item.videoId,
    title: item.title,
    author: item.author,
    lengthSeconds: item.lengthSeconds,
    thumbnails: item.videoThumbnails || item.thumbnails || [],
  };
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

    const baseUrl = process.env.INVIDIOUS_BASE_URL;
    if (!baseUrl) {
      res.status(500).json({ success: false, message: 'Search service is not configured' });
      return;
    }

    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/search`;
    const { data } = await axios.get(url, {
      params: { q: query, type: 'video' },
      timeout: 10000,
    });

    const items = Array.isArray(data) ? data : [];
    const top10 = items.slice(0, 10).map(mapItem);

    res.json({
      success: true,
      total: top10.length,
      data: top10,
    });
  } catch (err) {
    if (err.response) {
      res.status(500).json({
        success: false,
        message: 'Upstream search failed',
      });
      return;
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
      res.status(500).json({
        success: false,
        message: 'Search service unavailable',
      });
      return;
    }
    next(err);
  }
});

module.exports = router;

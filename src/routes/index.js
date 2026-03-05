const express = require('express');
const searchRouter = require('./search');
const videoRouter = require('./video');

const router = express.Router();

router.use('/api/search', searchRouter);
router.use('/api/video', videoRouter);

module.exports = router;

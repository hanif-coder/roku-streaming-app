#!/usr/bin/env node
'use strict';

require('dotenv').config();
const { execSync } = require('child_process');
const port = process.env.PORT || 5001;

try {
  execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
} catch (_) {
  // Port was free or kill failed (e.g. no permission) — continue
}
process.exit(0);

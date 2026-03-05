require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try another port or stop the other process.`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});

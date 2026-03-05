const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API running' });
});

app.use('/', routes);

app.use(errorHandler);

module.exports = app;

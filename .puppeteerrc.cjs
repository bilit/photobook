const path = require('path');

/**
 * Ensure Puppeteer's Chrome cache is stored inside the project directory
 * so the browser is available at runtime on platforms like Render.
 */
module.exports = {
  cacheDirectory: path.join(__dirname, '.cache', 'puppeteer'),
};

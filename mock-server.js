// Minimal dev mock — satisfies /auth/status so the frontend editor loads
const http = require('http');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/auth/status') {
    res.end(JSON.stringify({
      loggedIn: true,
      user: { id: 'dev', displayName: 'Dev User', email: 'dev@localhost' },
    }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'mock server — endpoint not implemented' }));
  }
});

server.listen(3001, () => console.log('Mock backend running on http://localhost:3001'));

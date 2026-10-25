import http from 'node:http';
import handler from './api/webhook.js';

const port = Number(process.env.PORT || 8080);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, status: 'Bot is running' }));
      return;
    }

    let rawBody = '';

    req.on('data', (chunk) => {
      rawBody += chunk;
    });

    req.on('end', async () => {
      try {
        const parsedBody = rawBody ? JSON.parse(rawBody) : {};

        const fakeReq = {
          method: req.method,
          body: parsedBody,
          headers: req.headers,
          url: req.url
        };

        const fakeRes = {
          statusCode: 200,
          status(code) {
            this.statusCode = code;
            return this;
          },
          json(payload) {
            res.writeHead(this.statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(payload));
            return this;
          },
          end(payload) {
            const output = typeof payload === 'string' ? payload : JSON.stringify(payload);
            res.writeHead(this.statusCode, { 'Content-Type': 'application/json' });
            res.end(output);
            return this;
          }
        };

        await handler(fakeReq, fakeRes);
      } catch (error) {
        console.error('Server parse error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: error.message || 'Unknown error' }));
      }
    });
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: error.message || 'Unknown error' }));
  }
});

server.listen(port, () => {
  console.log(`Fly-compatible bot server listening on port ${port}`);
});

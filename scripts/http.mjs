import { createServer } from 'node:http';

export function serve(handler, { port = Number(process.env.PORT || 8787), host = process.env.HOST || '127.0.0.1' } = {}) {
  const server = createServer(async (incoming, outgoing) => {
    try {
      const request = new Request(`http://localhost${incoming.url}`, {
        method: incoming.method,
        headers: incoming.headers,
      });
      const ctx = { waitUntil: promise => promise.catch(error => console.error('Background task failed:', error.message)) };
      const response = await handler.fetch(request, {}, ctx);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.error('Request failed:', error.message);
      outgoing.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      outgoing.end(JSON.stringify({ error: '服务暂时不可用，请稍后重试' }));
    }
  });
  server.listen(port, host, () => console.log(`PAID Observatory: http://${host}:${server.address().port}`));
  return server;
}

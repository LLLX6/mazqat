import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'public');
const port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

createServer(async (request, response) => {
  try {
    const rawPath = new URL(request.url || '/', 'http://localhost').pathname;
    const relative = normalize(decodeURIComponent(rawPath)).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '') || 'demo.html';
    let filePath = join(root, relative);
    if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html');
    response.writeHead(200, { 'content-type': mime[extname(filePath)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));

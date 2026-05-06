const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const http = require('http');

const DIR = __dirname;
const THUMBS_DIR = path.join(DIR, '_thumbs');
const PORT = 9222;

// 获取所有需要截图的文件（所有分类都需要截图，用于首页封面）
function getTargetFiles() {
  const files = fs.readdirSync(DIR)
    .filter(f => /^\d{2}-.*\.html$/.test(f))
    .sort();
  return files;
}

// 启动简单 HTTP 服务器
function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(DIR, decodeURIComponent(req.url).slice(1));
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end();
        return;
      }
      if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
      const ext = path.extname(filePath);
      const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      res.end(fs.readFileSync(filePath));
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function main() {
  const targets = getTargetFiles();
  console.log(`📸 Need screenshots for ${targets.length} pages`);

  if (!fs.existsSync(THUMBS_DIR)) fs.mkdirSync(THUMBS_DIR);

  // 检查哪些已有截图（增量构建）
  const needScreenshot = targets.filter(f => {
    const thumbPath = path.join(THUMBS_DIR, f.replace('.html', '.png'));
    if (!fs.existsSync(thumbPath)) return true;
    const htmlMtime = fs.statSync(path.join(DIR, f)).mtimeMs;
    const thumbMtime = fs.statSync(thumbPath).mtimeMs;
    return htmlMtime > thumbMtime;
  });

  if (needScreenshot.length === 0) {
    console.log('✓ All thumbnails up to date');
    return;
  }

  console.log(`📷 Taking ${needScreenshot.length} screenshots...`);

  const server = await startServer();
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 800 });

  for (let i = 0; i < needScreenshot.length; i++) {
    const file = needScreenshot[i];
    const url = `http://localhost:${PORT}/${file}`;
    const outPath = path.join(THUMBS_DIR, file.replace('.html', '.png'));
    
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
      // 等待动画启动
      await new Promise(r => setTimeout(r, 1500));
      await page.screenshot({ path: outPath, type: 'png' });
      console.log(`  ✓ [${i + 1}/${needScreenshot.length}] ${file}`);
    } catch (e) {
      console.log(`  ✗ [${i + 1}/${needScreenshot.length}] ${file}: ${e.message}`);
      // 生成一个占位图
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 5000 });
        await new Promise(r => setTimeout(r, 500));
        await page.screenshot({ path: outPath, type: 'png' });
      } catch (e2) {
        // skip
      }
    }
  }

  await browser.close();
  server.close();
  console.log(`\n✅ Screenshots done: ${THUMBS_DIR}`);
}

main().catch(e => { console.error(e); process.exit(1); });

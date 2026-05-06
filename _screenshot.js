const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const http = require('http');

const DIR = __dirname;
const THUMBS_DIR = path.join(DIR, '_thumbs');
const PORT = 9222;

// 获取所有 HTML 文件
function getAllFiles() {
  return fs.readdirSync(DIR)
    .filter(f => /^\d{2}-.*\.html$/.test(f))
    .sort();
}

// 提取 iframe 分类中的 section ID（与 _build.js 逻辑一致）
function extractSectionIds(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const ids = [];

  // 模式1: <section ... id="xxx">
  const sectionRegex = /<section[^>]*id="([^"]*)"[^>]*>/g;
  let m;
  while ((m = sectionRegex.exec(html)) !== null) {
    ids.push(m[1]);
  }
  if (ids.length > 0) return ids;

  // 模式2: <div class="section ..." id="xxx">
  const divRegex = /<div class="section[^"]*"[^>]*id="([^"]*)"[^>]*>/g;
  while ((m = divRegex.exec(html)) !== null) {
    ids.push(m[1]);
  }
  if (ids.length > 0) return ids;

  // 模式3: <div class="section ..."> 无 id，按顺序索引
  const divNoIdRegex = /<div class="section[^"]*"[^>]*>/g;
  let count = 0;
  while (divNoIdRegex.exec(html) !== null) count++;
  if (count > 0) {
    for (let i = 0; i < count; i++) ids.push(`__index_${i}`);
  }

  return ids;
}

// 判断文件是否为 iframe 类（无 card 结构）
function isIframeFile(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const hasCardH3 = html.includes('<div class="card"><h3>');
  const hasGridCard = html.includes('<div class="grid">') && html.includes('<div class="card">');
  const hasStageCard = /<div class="card">\s*<div class="stage/.test(html);
  return !hasCardH3 && !hasGridCard && !hasStageCard;
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
  const files = getAllFiles();
  if (!fs.existsSync(THUMBS_DIR)) fs.mkdirSync(THUMBS_DIR);

  // 收集所有截图任务
  const tasks = [];

  for (const file of files) {
    const filePath = path.join(DIR, file);
    const catId = file.replace('.html', '');
    const num = parseInt(file.slice(0, 2), 10);

    // 每个文件的首页截图（用于首页分类卡片封面）
    const mainThumb = path.join(THUMBS_DIR, `${catId}.png`);
    const htmlMtime = fs.statSync(filePath).mtimeMs;
    if (!fs.existsSync(mainThumb) || htmlMtime > fs.statSync(mainThumb).mtimeMs) {
      tasks.push({ type: 'main', file, outPath: mainThumb });
    }

    // iframe 分类的子效果截图
    if (num < 46 && isIframeFile(filePath)) {
      const sectionIds = extractSectionIds(filePath);
      for (let i = 0; i < sectionIds.length; i++) {
        const subThumb = path.join(THUMBS_DIR, `${catId}_${i}.png`);
        if (!fs.existsSync(subThumb) || htmlMtime > fs.statSync(subThumb).mtimeMs) {
          tasks.push({ type: 'section', file, sectionId: sectionIds[i], index: i, outPath: subThumb });
        }
      }
    }
  }

  if (tasks.length === 0) {
    console.log('✓ All thumbnails up to date');
    return;
  }

  console.log(`📷 Taking ${tasks.length} screenshots...`);

  const server = await startServer();
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 800 });

  // 按文件分组，同一文件只加载一次
  let lastFile = null;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const url = `http://localhost:${PORT}/${task.file}`;

    try {
      if (task.type === 'main') {
        // 主截图：用 load 事件 + 固定等待，避免 networkidle0 卡死
        await page.goto(url, { waitUntil: 'load', timeout: 15000 });
        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({ path: task.outPath, type: 'png' });
        lastFile = task.file;
        console.log(`  ✓ [${i + 1}/${tasks.length}] ${task.file} (main)`);
      } else {
        // section 截图：如果同一文件已加载则不重新导航
        if (lastFile !== task.file) {
          await page.goto(url, { waitUntil: 'load', timeout: 15000 });
          await new Promise(r => setTimeout(r, 1500));
          lastFile = task.file;
        }

        if (task.sectionId.startsWith('__index_')) {
          const idx = parseInt(task.sectionId.replace('__index_', ''), 10);
          await page.evaluate((sectionIdx) => {
            const sections = document.querySelectorAll('[class*="section"]');
            if (sections[sectionIdx]) sections[sectionIdx].scrollIntoView({ behavior: 'instant' });
          }, idx);
        } else {
          await page.evaluate((id) => {
            const el = document.getElementById(id);
            if (el) el.scrollIntoView({ behavior: 'instant' });
          }, task.sectionId);
        }

        await new Promise(r => setTimeout(r, 800));
        await page.screenshot({ path: task.outPath, type: 'png' });
        console.log(`  ✓ [${i + 1}/${tasks.length}] ${task.file} #${task.sectionId}`);
      }
    } catch (e) {
      console.log(`  ✗ [${i + 1}/${tasks.length}] ${task.file}: ${e.message}`);
      // fallback: domcontentloaded + 短等待
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
        await new Promise(r => setTimeout(r, 1000));
        if (task.type === 'section') {
          if (task.sectionId.startsWith('__index_')) {
            const idx = parseInt(task.sectionId.replace('__index_', ''), 10);
            await page.evaluate((sectionIdx) => {
              const sections = document.querySelectorAll('[class*="section"]');
              if (sections[sectionIdx]) sections[sectionIdx].scrollIntoView({ behavior: 'instant' });
            }, idx);
          } else {
            await page.evaluate((id) => {
              const el = document.getElementById(id);
              if (el) el.scrollIntoView({ behavior: 'instant' });
            }, task.sectionId);
          }
          await new Promise(r => setTimeout(r, 500));
        }
        await page.screenshot({ path: task.outPath, type: 'png' });
        console.log(`  ✓ [${i + 1}/${tasks.length}] ${task.file} (fallback ok)`);
        lastFile = task.file;
      } catch (e2) {
        console.log(`  ✗✗ [${i + 1}/${tasks.length}] ${task.file}: SKIPPED`);
        lastFile = null; // 强制下次重新加载
      }
    }
  }

  await browser.close();
  server.close();
  console.log(`\n✅ Screenshots done: ${THUMBS_DIR}`);
}

main().catch(e => { console.error(e); process.exit(1); });

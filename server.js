const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ビルド後の静的ファイル配信
app.use(express.static(path.join(__dirname, 'dist')));

const DATA_DIR = path.join(__dirname, 'data');

/**
 * ディレクトリの存在を確認し、なければ作成します。
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * ユーザーごとのデータ保存先ディレクトリを取得します。
 */
function getUserDir(userId) {
  // 安全性のためのIDクリーニング
  const cleanId = (userId || 'local_user').replace(/[^a-zA-Z0-9_-]/g, '');
  const userDir = path.join(DATA_DIR, cleanId);
  ensureDir(userDir);
  return userDir;
}

/**
 * 安全にJSONを書き込みます（tmpファイルを経由したリネーム）。
 */
function safeWriteJson(filePath, data) {
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * 安全にJSONを読み込みます。
 */
function safeReadJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

// データ初期作成
ensureDir(DATA_DIR);

// ロードAPI
app.get('/api/load', (req, res) => {
  const userId = req.query.userId || 'local_user';
  const userDir = getUserDir(userId);

  const files = ['player', 'farm', 'inventory', 'shop', 'achievement'];
  const data = {};

  files.forEach(file => {
    const filePath = path.join(userDir, `${file}.json`);
    data[file] = safeReadJson(filePath);
  });

  const isNewUser = Object.values(data).every(val => val === null);

  if (isNewUser) {
    return res.json({ success: true, isNew: true, data: null });
  }

  res.json({ success: true, isNew: false, data });
});

// セーブAPI
app.post('/api/save', (req, res) => {
  const { userId, data } = req.body;
  if (!data) {
    return res.status(400).json({ success: false, error: 'Data is required' });
  }

  const userDir = getUserDir(userId);
  const files = ['player', 'farm', 'inventory', 'shop', 'achievement'];

  try {
    files.forEach(file => {
      if (data[file]) {
        const filePath = path.join(userDir, `${file}.json`);
        safeWriteJson(filePath, data[file]);
      }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Save failed:', error);
    res.status(500).json({ success: false, error: 'Save failed' });
  }
});

// SPA対応のルートハンドラ（静的アセットがないリクエストはすべて index.html を返す）
app.use((req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not Found (Please build front-end using `npm run build` first)');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

const express = require('express');
const { ZingMp3 } = require('zingmp3-api-full');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Helper: Proxy function để bypass Geo-blocking
async function streamUrl(url, res) {
    try {
        // Dùng dynamic import cho node-fetch v3+ hoặc v2 ESM
        const fetch = (await import('node-fetch')).default;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://zingmp3.vn/',
                'Origin': 'https://zingmp3.vn'
            }
        });

        if (!response.ok) throw new Error(`Stream failed: ${response.statusText}`);

        // Set headers cho browser hiểu đây là file nhạc
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Accept-Ranges', 'bytes');
        
        // Pipe dữ liệu trực tiếp từ Zing về Client
        response.body.pipe(res);
    } catch (error) {
        console.error('Stream Proxy Error:', error);
        res.redirect(url); // Fallback: Redirect nếu proxy lỗi
    }
}

// 1. API Tìm kiếm
app.get('/api/search', async (req, res) => {
    try {
        const q = req.query.q;
        if (!q) return res.status(400).json({ msg: "Thiếu từ khóa q" });
        
        const data = await ZingMp3.search(q);
        res.json({ data: data.data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. API Stream nhạc (Quan trọng nhất)
app.get('/api/song/stream', async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) return res.status(400).send("Thiếu ID");

        // Lấy thông tin bài hát để tìm link
        const data = await ZingMp3.getSong(id);
        
        if (data.err !== 0 || !data.data) {
            return res.status(404).send("Không tìm thấy bài hát hoặc lỗi API Zing");
        }

        // Ưu tiên lấy link 128kbps (nhẹ, dễ load) hoặc 320kbps
        const link = data.data['128'] || data.data['320'] || '';

        if (!link) {
            return res.status(404).send("Không tìm thấy link stream cho bài này (có thể là bài Premium)");
        }

        // Gọi hàm proxy
        await streamUrl(link, res);

    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

// 3. API Lấy thông tin bài hát
app.get('/api/info-song', async (req, res) => {
    try {
        const id = req.query.id;
        const data = await ZingMp3.getInfoSong(id);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. API Lời bài hát
app.get('/api/lyric', async (req, res) => {
    try {
        const id = req.query.id;
        const data = await ZingMp3.getLyric(id);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. API Lấy link gốc (JSON)
app.get('/api/song', async (req, res) => {
    try {
        const id = req.query.id;
        const data = await ZingMp3.getSong(id);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = app;

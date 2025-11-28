const express = require('express');
const { ZingMp3 } = require('zingmp3-api-full');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch'); // Dùng v2

const app = express();
app.use(cors());
app.use(express.json());

// 1. Phục vụ file HTML giao diện
app.get('/', (req, res) => {
    // Vercel: api/index.js nằm trong folder 'api', nên html ở '..'
    const htmlPath = path.join(__dirname, '../index.html');
    res.sendFile(htmlPath);
});

// 2. API Stream nhạc (Có xử lý Proxy & Redirect)
app.get('/api/stream', async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) return res.status(400).send("Thiếu ID bài hát");

        // Lấy link từ Zing
        const data = await ZingMp3.getSong(id);
        
        // Link ưu tiên: 128 -> 320 -> url
        const link = data?.data?.['128'] || data?.data?.['320'] || data?.data?.url;

        // Nếu không có link (VIP/Lỗi)
        if (!link) {
            return res.status(404).send("Không tìm thấy link nhạc (VIP?)");
        }

        // Nếu Client yêu cầu redirect (dự phòng)
        if (req.query.redirect === 'true') {
            return res.redirect(link);
        }

        // Cấu hình Header giả lập trình duyệt
        const range = req.headers.range;
        const fetchHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://zingmp3.vn/'
        };
        if (range) fetchHeaders['Range'] = range;

        // Fetch dữ liệu từ Zing
        const response = await fetch(link, { headers: fetchHeaders });

        if (!response.ok) {
            // Nếu fetch lỗi (403/404), redirect luôn cho người dùng tự tải
            return res.redirect(link);
        }

        // Forward headers về trình duyệt (để tua được nhạc)
        res.status(response.status);
        const headersToForward = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
        headersToForward.forEach(h => {
            const val = response.headers.get(h);
            if (val) res.setHeader(h, val);
        });

        response.body.pipe(res);

        response.body.on('error', (e) => {
            console.error('Stream Error:', e);
            res.end();
        });

    } catch (err) {
        console.error('Server Error:', err);
        if (!res.headersSent) res.status(500).send(err.message);
    }
});

// 3. API Tìm kiếm
app.get('/api/search', async (req, res) => {
    try {
        const q = req.query.q;
        const data = await ZingMp3.search(q || '');
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. API Thông tin bài hát (Info)
app.get('/api/info', async (req, res) => {
    try {
        const id = req.query.id;
        const data = await ZingMp3.getInfoSong(id);
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. API Lời bài hát
app.get('/api/lyric', async (req, res) => {
    try {
        const id = req.query.id;
        const data = await ZingMp3.getLyric(id);
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = app;

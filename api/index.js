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

// Helper function to set Vietnam headers
async function fetchWithVNHeaders(url) {
    const fetch = (await import('node-fetch')).default;
    return fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://zingmp3.vn/',
            'Origin': 'https://zingmp3.vn',
            'Accept': '*/*',
            'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        }
    });
}

// 1. API Tìm kiếm
app.get('/api/search', async (req, res) => {
    try {
        const q = req.query.q;
        if (!q) return res.status(400).json({ msg: "Thiếu từ khóa q" });
        
        console.log('Searching for:', q);
        const data = await ZingMp3.search(q);
        console.log('Search result:', data);
        
        res.json({ data: data.data });
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. API Stream nhạc - Proxy qua server để bypass geo-blocking
app.get('/api/song/stream', async (req, res) => {
    try {
        const id = req.query.id;
        console.log('Stream request for ID:', id);
        
        if (!id) {
            return res.status(400).send("Thiếu ID");
        }

        const data = await ZingMp3.getSong(id);
        console.log('Song data:', JSON.stringify(data, null, 2));
        
        // Kiểm tra error từ API
        if (data.err !== 0) {
            console.error('API Error:', data.msg);
            return res.status(403).json({ 
                error: data.msg || "Không thể lấy link nhạc",
                code: data.err
            });
        }
        
        // Thử nhiều quality khác nhau
        const link = data?.data?.['128'] || 
                     data?.data?.['320'] || 
                     data?.data?.url;

        if (link) {
            console.log('Streaming from:', link);
            
            // Proxy stream qua server để bypass geo-blocking
            try {
                const fetch = (await import('node-fetch')).default;
                const response = await fetch(link, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': 'https://zingmp3.vn/',
                        'Origin': 'https://zingmp3.vn',
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                // Copy headers
                res.set('Content-Type', response.headers.get('content-type') || 'audio/mpeg');
                res.set('Accept-Ranges', 'bytes');
                
                // Stream audio
                response.body.pipe(res);
                
            } catch (streamErr) {
                console.error('Stream error:', streamErr);
                // Fallback: redirect trực tiếp
                return res.redirect(link);
            }
            
        } else {
            console.error('No link found in data:', data);
            return res.status(404).json({ 
                error: "Không tìm thấy link nhạc",
                debug: data 
            });
        }
    } catch (err) {
        console.error('Stream error:', err);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

// 3. API Thông tin bài hát
app.get('/api/info-song', async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) return res.status(400).json({ msg: "Thiếu ID" });
        
        console.log('Getting info for:', id);
        
        // Thử cả getInfoSong và getInfo
        let data;
        try {
            data = await ZingMp3.getInfoSong(id);
        } catch (e) {
            console.log('getInfoSong failed, trying getInfo');
            data = await ZingMp3.getInfo(id);
        }
        
        console.log('Info result:', data);
        res.json(data);
    } catch (err) {
        console.error('Info error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 4. API Lời bài hát
app.get('/api/lyric', async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) return res.status(400).json({ msg: "Thiếu ID" });
        
        console.log('Getting lyric for:', id);
        const data = await ZingMp3.getLyric(id);
        console.log('Lyric result:', data);
        
        res.json(data);
    } catch (err) {
        console.error('Lyric error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 5. API Link stream JSON
app.get('/api/song', async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) return res.status(400).json({ msg: "Thiếu ID" });
        
        console.log('Getting song links for:', id);
        const data = await ZingMp3.getSong(id);
        console.log('Song links:', data);
        
        res.json(data);
    } catch (err) {
        console.error('Song error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Catch all để debug
app.use((req, res) => {
    console.log('404 Not Found:', req.method, req.path);
    res.status(404).json({ 
        error: 'Route not found',
        path: req.path,
        method: req.method
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({ 
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

module.exports = app;

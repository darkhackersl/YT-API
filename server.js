const express = require('express');
const axios = require("axios");
const yts = require("yt-search");
const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// YouTube Scraper Endpoints
const audio = [64, 96, 128, 192, 256, 320, 1000, 1411];
const video = [360, 480, 720, 1080, 1440];

function getYouTubeVideoId(url) {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|v\/|embed\/|user\/[^\/\n\s]+\/)?(?:watch\?v=|v%3D|embed%2F|video%2F)?|youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/|youtube\.com\/playlist\?list=)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

async function convert(id, quality) {
    try {
        const response = await axios.get(`https://ytdl.vreden.web.id/convert.php/${id}/${quality}`);
        let download;
        do {
            download = await axios.get(`https://ytdl.vreden.web.id/progress.php/${response.data.convert}`);
            if (download.data.status == "Error") return {
                status: false,
                message: "Progress error"
            };
        } while (download.data.status !== "Finished");

        return {
            status: true,
            quality: `${quality}${audio.includes(quality) ? "kbps" : "p"}`,
            availableQuality: audio.includes(quality) ? audio : video,
            url: download.data.url,
            filename: `${response.data.title} (${quality}${audio.includes(quality) ? "kbps).mp3" : "p).mp4"}`
        };
    } catch (error) {
        console.error("Converting error:", error);
        return {
            status: false,
            message: "Converting error"
        };
    }
}

// YouTube Search
app.get('/youtube/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ error: 'Search query is required' });
        }
        const data = await yts(q);
        res.json({
            status: true,
            creator: "@thenux-ai",
            results: data.all
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: error.message
        });
    }
});

// YouTube MP3 Download
app.get('/youtube/mp3', async (req, res) => {
    try {
        const { link, quality = 128 } = req.query;
        const videoId = getYouTubeVideoId(link);
        const format = audio.includes(Number(quality)) ? Number(quality) : 128;

        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        const data = await yts("https://youtube.com/watch?v=" + videoId);
        const response = await convert(videoId, format);

        res.json({
            status: true,
            creator: "@thenux-ai",
            metadata: data.all[0],
            download: response
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: error.response ? `HTTP Error: ${error.response.status}` : error.message
        });
    }
});

// YouTube MP4 Download
app.get('/youtube/mp4', async (req, res) => {
    try {
        const { link, quality = 360 } = req.query;
        const videoId = getYouTubeVideoId(link);
        const format = video.includes(Number(quality)) ? Number(quality) : 360;

        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        const data = await yts("https://youtube.com/watch?v=" + videoId);
        const response = await convert(videoId, format);

        res.json({
            status: true,
            creator: "@thenux-ai",
            metadata: data.all[0],
            download: response
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: error.response ? `HTTP Error: ${error.response.status}` : error.message
        });
    }
});

// YouTube Transcript
app.get('/youtube/transcript', async (req, res) => {
    try {
        const { link } = req.query;
        if (!link) {
            return res.status(400).json({ error: 'YouTube URL is required' });
        }

        const response = await axios.get('https://ytb2mp4.com/api/fetch-transcript', {
            params: { url: link },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
                'Referer': 'https://ytb2mp4.com/youtube-transcript'
            }
        });

        res.json({
            status: true,
            creator: "@thenux-ai",
            transcript: response.data.transcript
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: error.message
        });
    }
});

// YouTube Advanced Download
app.get('/youtube/advanced', async (req, res) => {
    try {
        const { link, format } = req.query;
        if (!link) {
            return res.status(400).json({ error: 'YouTube URL is required' });
        }

        const result = await axios.get(`https://ytdl.vreden.web.id/metadata?url=${link}`);
        if (format && format !== "default") {
            const videoId = getYouTubeVideoId(link);
            const isAudio = audio.includes(Number(format));
            const isVideo = video.includes(Number(format));

            if (isAudio || isVideo) {
                const quality = isAudio ? Number(format) : isVideo ? Number(format) : null;
                const response = await convert(videoId, quality);
                if (isAudio) {
                    result.data.downloads.audio = response.url;
                } else if (isVideo) {
                    result.data.downloads.video = response.url;
                }
            }
        }

        res.json({
            status: true,
            creator: "@thenux-ai",
            ...result.data
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: error.message
        });
    }
});

// YouTube Channel Info
app.get('/youtube/channel', async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({ error: 'Channel ID is required' });
        }

        const result = await axios.get(`https://ytdl.vreden.web.id/channel/${id}`);
        res.json({
            status: true,
            creator: "@thenux-ai",
            ...result.data
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

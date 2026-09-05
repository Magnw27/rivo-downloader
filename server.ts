import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper: Determine platform from URL
function detectPlatform(url: string): "tiktok" | "youtube" | "instagram" | "generic" {
  const lowUrl = url.toLowerCase();
  if (lowUrl.includes("tiktok.com")) return "tiktok";
  if (lowUrl.includes("youtube.com") || lowUrl.includes("youtu.be")) return "youtube";
  if (lowUrl.includes("instagram.com")) return "instagram";
  return "generic";
}

// 1. Core Download API
app.post("/api/download", async (req, res) => {
  const { url, format, quality } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, error: "URL harus diisi" });
  }

  const platform = detectPlatform(url);
  const isAudio = format === "mp3";

  const fallbackVideoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
  const fallbackAudioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

  let title = "Media Download";
  let author = "Media Downloader";
  let cover = "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop";
  let duration = "0:15";
  let downloadUrl = "";

  try {
    // ---- METHOD A: Platform-Specific Open APIs ----

    // A1. TIKTOK
    if (platform === "tiktok") {
      try {
        const tikResponse = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
        const tikData = await tikResponse.json();
        
        if (tikData && tikData.code === 0 && tikData.data) {
          title = tikData.data.title || "TikTok Video";
          author = tikData.data.author?.nickname || "@tiktok_user";
          cover = tikData.data.cover || cover;
          duration = tikData.data.duration ? `${Math.floor(tikData.data.duration / 60)}:${String(tikData.data.duration % 60).padStart(2, "0")}` : "0:30";
          
          if (isAudio) {
            downloadUrl = tikData.data.music || tikData.data.play;
          } else {
            downloadUrl = tikData.data.play;
          }
        }
      } catch (err) {
        console.warn("TikTok Tikwm API failed, attempting Cobalt/Fallback", err);
      }
    }

    // ---- METHOD B: Cobalt API (For Youtube, Instagram, and general social sites) ----
    if (!downloadUrl) {
      try {
        const cobaltUrl = "https://api.cobalt.tools/api/json";
        let cobaltQuality = "720";
        if (quality === "high") cobaltQuality = "1080";
        if (quality === "low") cobaltQuality = "480";

        const response = await fetch(cobaltUrl, {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            url: url,
            videoQuality: cobaltQuality,
            audioFormat: isAudio ? "mp3" : "best",
            downloadMode: isAudio ? "audio" : "video",
            filenamePattern: "pretty"
          })
        });

        if (response.ok) {
          const cobaltData = await response.json();
          if (cobaltData.url) {
            downloadUrl = cobaltData.url;
          } else if (cobaltData.picker && cobaltData.picker.length > 0) {
            downloadUrl = cobaltData.picker[0].url;
          }
        }
      } catch (err) {
        console.warn("Cobalt API extraction failed, attempting metadata parsing", err);
      }
    }

    // ---- METHOD C: Lightweight HTML metadata parsing ----
    // No external AI service or API key is required here.
    if (!downloadUrl || title === "Media Download") {
      try {
        const pageRes = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });

        if (pageRes.ok) {
          const htmlText = await pageRes.text();

          const metaContent = (property: string) => {
            const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const patterns = [
              new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
              new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`, "i"),
              new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
              new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["']`, "i"),
            ];

            for (const pattern of patterns) {
              const match = htmlText.match(pattern);
              if (match?.[1]) return match[1].trim();
            }
            return "";
          };

          const localTitle = metaContent("og:title") || metaContent("twitter:title");
          const localImage = metaContent("og:image") || metaContent("twitter:image");
          const localVideo = metaContent("og:video") || metaContent("og:video:url");
          const localAuthor = metaContent("author") || metaContent("article:author");
          const localDuration = metaContent("video:duration");

          if (localTitle) title = localTitle;
          if (localImage) cover = localImage;
          if (localAuthor) author = localAuthor;
          if (localDuration && /^\d+$/.test(localDuration)) {
            const totalSeconds = Number(localDuration);
            duration = `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
          }
          if (localVideo && !downloadUrl) downloadUrl = localVideo;
        }
      } catch (err) {
        console.warn("HTML metadata extraction failed", err);
      }
    }

    // ---- STEP D: Fallback Resolution & Formatting ----
    let isFallback = false;
    if (!downloadUrl) {
      downloadUrl = isAudio ? fallbackAudioUrl : fallbackVideoUrl;
      isFallback = true;
    }

    const cleanFilename = `${title.replace(/[^a-zA-Z0-9\s-_]/g, "").substring(0, 40)}.${isAudio ? "mp3" : "mp4"}`;
    const finalProxyUrl = `/api/proxy?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(cleanFilename)}`;

    return res.json({
      success: true,
      title,
      author,
      cover,
      duration,
      platform,
      format,
      quality,
      downloadUrl: finalProxyUrl,
      isFallback,
      originalUrl: downloadUrl
    });

  } catch (error: any) {
    console.error("Core downloader pipeline error:", error);
    return res.status(500).json({
      success: false,
      error: "Gagal memproses video. Pastikan link benar atau coba lagi nanti."
    });
  }
});

// 2. High-Performance Server-Side Stream Proxy
app.get("/api/proxy", async (req, res) => {
  const targetUrl = req.query.url as string;
  const filename = (req.query.filename as string) || "download.mp4";

  if (!targetUrl) {
    return res.status(400).send("Parameter URL target tidak ditemukan.");
  }

  try {
    const fetchResponse = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.tiktok.com/"
      }
    });

    if (!fetchResponse.ok) {
      throw new Error(`Target server responded with ${fetchResponse.status}`);
    }

    const contentType = fetchResponse.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    
    const contentLength = fetchResponse.headers.get("content-length");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    if (fetchResponse.body) {
      const reader = fetchResponse.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      res.status(500).send("Gagal mengunduh konten stream.");
    }
  } catch (err: any) {
    console.error("Proxy error:", err);
    res.redirect(targetUrl);
  }
});

// 3. Health check API
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// 4. Vite / Static Middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Rivotik Server] running on http://localhost:${PORT}`);
  });
}

startServer();
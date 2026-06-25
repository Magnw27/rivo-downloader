import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Download,
  Link as LinkIcon,
  Music,
  Video,
  Trash2,
  History,
  Sparkles,
  Clipboard,
  X,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Clock,
  User,
  Zap,
  ShieldCheck
} from "lucide-react";

// Download Item Schema for local persistence
interface DownloadItem {
  id: string;
  title: string;
  author: string;
  cover: string;
  duration: string;
  platform: "tiktok" | "youtube" | "instagram" | "generic";
  format: "mp4" | "mp3";
  quality: string;
  downloadUrl: string;
  originalUrl: string;
  timestamp: number;
}

export default function App() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<"mp4" | "mp3">("mp4");
  const [quality, setQuality] = useState<"high" | "medium" | "low">("high");
  
  // App UI states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pasteSuccess, setPasteSuccess] = useState(false);
  
  // Current active extracted media
  const [extractedMedia, setExtractedMedia] = useState<DownloadItem | null>(null);
  
  // Download history stored locally
  const [history, setHistory] = useState<DownloadItem[]>([]);

  // Simulation loading steps
  const loadingSteps = [
    "Menganalisis link media...",
    "Membaca metadata dari platform...",
    "Melakukan konversi format otomatis...",
    "Mempersiapkan link unduhan resolusi tinggi..."
  ];

  // Load history on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("media_downloader_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Gagal membaca riwayat unduhan:", e);
      }
    }
  }, []);

  // Save history helper
  const saveHistory = (updatedHistory: DownloadItem[]) => {
    setHistory(updatedHistory);
    localStorage.setItem("media_downloader_history", JSON.stringify(updatedHistory));
  };

  // Helper to copy content to clipboard
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } catch (err) {
        console.error("Gagal menyalin teks", err);
      }
      document.body.removeChild(textArea);
    });
  };

  // Quick paste URL handler
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        setPasteSuccess(true);
        setTimeout(() => setPasteSuccess(false), 1500);
      }
    } catch (err) {
      // In cases where iframe permission is missing, show manual guidance
      alert("Silakan tempel (Ctrl+V atau Cmd+V) link Anda secara manual di dalam kotak input.");
    }
  };

  // Submit link for parsing and download preparation
  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError("Silakan masukkan URL video terlebih dahulu.");
      return;
    }

    setIsLoading(true);
    setLoadingStep(0);
    setError(null);
    setExtractedMedia(null);

    // Dynamic fake loading steps to keep users engaged and informed of server actions
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < loadingSteps.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 1200);

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, format, quality })
      });

      clearInterval(stepInterval);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Gagal memproses video.");
      }

      const mediaData = await res.json();

      if (mediaData.success) {
        const newItem: DownloadItem = {
          id: Math.random().toString(36).substring(2, 9),
          title: mediaData.title || "Unduhan Media",
          author: mediaData.author || "Platform Media",
          cover: mediaData.cover || "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop",
          duration: mediaData.duration || "0:00",
          platform: mediaData.platform || "generic",
          format: mediaData.format,
          quality: mediaData.format === "mp3" ? "320kbps" : (mediaData.quality === "high" ? "1080p HD" : mediaData.quality === "medium" ? "720p HD" : "480p SD"),
          downloadUrl: mediaData.downloadUrl,
          originalUrl: url,
          timestamp: Date.now()
        };

        setExtractedMedia(newItem);
        
        // Save to Local History (avoid duplicates of the exact originalUrl and format)
        const updatedHistory = [newItem, ...history.filter(item => !(item.originalUrl === url && item.format === format))].slice(0, 50);
        saveHistory(updatedHistory);
      } else {
        throw new Error(mediaData.error || "Gagal mengekstrak video.");
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      setError(err.message || "Gagal memproses media. Silakan periksa kembali link atau coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger file download
  const triggerDownload = (item: DownloadItem) => {
    const link = document.createElement("a");
    link.href = item.downloadUrl;
    link.setAttribute("download", `${item.title}.${item.format}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reload history item back to main downloader
  const reloadItem = (item: DownloadItem) => {
    setUrl(item.originalUrl);
    setFormat(item.format);
    setExtractedMedia(item);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Remove history item
  const removeHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(item => item.id !== id);
    saveHistory(updated);
  };

  // Clear all history with native confirmation
  const clearAllHistory = () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus seluruh riwayat unduhan lokal Anda?")) {
      saveHistory([]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 flex flex-col gap-8">
      
      {/* 1. Header / Brand Title Section */}
      <div id="app-header" className="text-center flex flex-col gap-3">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500/15 to-cyan-500/15 border border-emerald-500/20 px-4 py-1.5 rounded-full text-emerald-400 text-xs md:text-sm font-medium self-center shadow-lg"
        >
          <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>Antarmuka Tanpa Iklan • Kecepatan Penuh • 100% Gratis</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-display text-4xl md:text-5xl font-extrabold tracking-tight"
        >
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 text-transparent bg-clip-text">
            Rivo Downloader
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-sm md:text-base text-slate-400 max-w-xl mx-auto"
        >
          Unduh video resolusi tinggi atau audio format MP3 dari <strong>TikTok</strong>, <strong>YouTube</strong>, dan <strong>Instagram</strong> dengan instan dan tanpa ribet.
        </motion.p>
      </div>

      {/* 2. Main Input Card & Options */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        id="main-downloader"
        className="bg-[#111827] border border-slate-800 rounded-2xl p-5 md:p-8 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500"></div>

        <form onSubmit={handleExtract} className="flex flex-col gap-6">
          {/* Input field */}
          <div className="flex flex-col gap-2">
            <label className="text-xs md:text-sm font-semibold text-slate-300 flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-emerald-400" />
              Masukkan Link Video / Audio
            </label>
            <div className="flex gap-2 bg-[#1f2937] border border-slate-700 focus-within:border-emerald-500 rounded-xl p-1.5 transition-all">
              <input
                id="url-input"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Tempel link TikTok, YouTube, atau Instagram disini..."
                className="bg-transparent flex-1 outline-none text-sm md:text-base px-3 text-white placeholder-slate-500"
              />
              {url && (
                <button
                  type="button"
                  id="btn-clear"
                  onClick={() => setUrl("")}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                  title="Hapus"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              <button
                type="button"
                id="btn-paste"
                onClick={handlePaste}
                className={`flex items-center gap-1.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                  pasteSuccess
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-[#2d3748] hover:bg-[#3d4b5f] text-slate-200"
                }`}
              >
                {pasteSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Ditempel!</span>
                  </>
                ) : (
                  <>
                    <Clipboard className="w-4 h-4" />
                    <span>Tempel</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Settings: Format Selection & Quality */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Format pill options */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-400">Format Unduhan</span>
              <div className="grid grid-cols-2 gap-2 bg-[#1f2937] p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  id="format-mp4"
                  onClick={() => setFormat("mp4")}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    format === "mp4"
                      ? "bg-emerald-500 text-white shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-[#2d3748]"
                  }`}
                >
                  <Video className="w-4 h-4" />
                  <span>MP4 (Video)</span>
                </button>
                <button
                  type="button"
                  id="format-mp3"
                  onClick={() => setFormat("mp3")}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    format === "mp3"
                      ? "bg-emerald-500 text-white shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-[#2d3748]"
                  }`}
                >
                  <Music className="w-4 h-4" />
                  <span>MP3 (Audio)</span>
                </button>
              </div>
            </div>

            {/* Quality options */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-400">Pilihan Kualitas</span>
              <div className="grid grid-cols-3 gap-2 bg-[#1f2937] p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  id="quality-high"
                  onClick={() => setQuality("high")}
                  className={`py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                    quality === "high"
                      ? "bg-[#2d3748] text-emerald-400 border border-emerald-500/30 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Tinggi
                </button>
                <button
                  type="button"
                  id="quality-medium"
                  onClick={() => setQuality("medium")}
                  disabled={format === "mp3"}
                  className={`py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                    format === "mp3"
                      ? "opacity-40 cursor-not-allowed"
                      : quality === "medium"
                      ? "bg-[#2d3748] text-emerald-400 border border-emerald-500/30 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title={format === "mp3" ? "Audio MP3 selalu diunduh dengan kualitas terbaik" : ""}
                >
                  Sedang
                </button>
                <button
                  type="button"
                  id="quality-low"
                  onClick={() => setQuality("low")}
                  disabled={format === "mp3"}
                  className={`py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                    format === "mp3"
                      ? "opacity-40 cursor-not-allowed"
                      : quality === "low"
                      ? "bg-[#2d3748] text-emerald-400 border border-emerald-500/30 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Rendah
                </button>
              </div>
            </div>
          </div>

          {/* Action Trigger Button */}
          <button
            type="submit"
            id="btn-submit"
            disabled={isLoading || !url.trim()}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white py-3.5 rounded-xl font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>Mulai Proses Unduh</span>
              </>
            )}
          </button>
        </form>

        {/* Dynamic status loader steps */}
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Status Proses:</span>
                <span className="text-xs font-mono text-emerald-400">
                  {Math.round(((loadingStep + 1) / loadingSteps.length) * 100)}%
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <motion.div
                  className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${((loadingStep + 1) / loadingSteps.length) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              {/* Steps ticker animation */}
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                <motion.span
                  key={loadingStep}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-xs text-slate-300 font-medium"
                >
                  {loadingSteps[loadingStep]}
                </motion.span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error notification display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-6 p-4 rounded-xl bg-rose-950/30 border border-rose-900/30 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm text-rose-300">
                <p className="font-semibold">Terjadi Kendala</p>
                <p className="opacity-90">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 3. Extracted Media Preview Block */}
      <AnimatePresence>
        {extractedMedia && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5 }}
            id="extracted-result"
            className="bg-[#111827] border border-slate-800 rounded-2xl p-4 md:p-6 shadow-2xl flex flex-col md:flex-row gap-5"
          >
            {/* Thumbnail and duration */}
            <div className="relative w-full md:w-48 aspect-video md:aspect-square rounded-xl overflow-hidden bg-slate-950 shrink-0 border border-slate-800 flex items-center justify-center group">
              <img
                src={extractedMedia.cover}
                alt={extractedMedia.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm text-[10px] md:text-xs text-white font-mono font-medium px-1.5 py-0.5 rounded flex items-center gap-1 border border-slate-800">
                <Clock className="w-3 h-3" />
                {extractedMedia.duration}
              </span>
              
              {/* Media badge floating on cover */}
              <span className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wider ${
                extractedMedia.platform === "tiktok" ? "bg-black text-cyan-400 border border-cyan-400/30" :
                extractedMedia.platform === "youtube" ? "bg-red-600" :
                extractedMedia.platform === "instagram" ? "bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600" :
                "bg-slate-700"
              }`}>
                {extractedMedia.platform}
              </span>
            </div>

            {/* Media Information details & CTA Download */}
            <div className="flex-1 flex flex-col justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <h2 className="font-display text-lg md:text-xl font-bold text-white leading-snug line-clamp-2">
                  {extractedMedia.title}
                </h2>
                
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs md:text-sm text-slate-400">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    {extractedMedia.author}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="font-mono text-emerald-400 font-semibold uppercase flex items-center gap-1 bg-[#1f2937] px-2 py-0.5 rounded border border-slate-800">
                    {extractedMedia.format} ({extractedMedia.quality})
                  </span>
                </div>
              </div>

              {/* Status information proxy validation */}
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Link unduhan berhasil diamankan dan dienkripsi bebas CORS untuk konversi super cepat.</span>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  id="btn-download-trigger"
                  onClick={() => triggerDownload(extractedMedia)}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm py-3 px-5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <Download className="w-4.5 h-4.5" />
                  <span>Unduh File Sekarang</span>
                </button>
                <button
                  type="button"
                  id="btn-copy-link"
                  onClick={() => copyToClipboard(extractedMedia.downloadUrl, extractedMedia.id)}
                  className="bg-[#242f44] hover:bg-[#2e3b55] text-slate-200 font-semibold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-800"
                >
                  {copiedId === extractedMedia.id ? (
                    <>
                      <Check className="w-4.5 h-4.5 text-emerald-400" />
                      <span className="text-emerald-400">Salin Sukses!</span>
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-4.5 h-4.5" />
                      <span>Salin Link Unduhan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Local Download History List */}
      <div id="download-history" className="flex flex-col gap-4 mt-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm md:text-base">
            <History className="w-5 h-5 text-emerald-400" />
            <h2>Riwayat Unduhan Lokal ({history.length})</h2>
          </div>
          {history.length > 0 && (
            <button
              type="button"
              id="btn-clear-all"
              onClick={clearAllHistory}
              className="text-xs text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-3 py-1 rounded-lg font-medium cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua</span>
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="text-center py-10 px-4 bg-[#111827]/40 border border-slate-800/60 rounded-xl flex flex-col items-center gap-2">
            <History className="w-8 h-8 text-slate-600 animate-pulse" />
            <p className="text-sm text-slate-400">Belum ada riwayat unduhan di perangkat ini.</p>
            <p className="text-xs text-slate-500 max-w-xs">Seluruh file yang berhasil Anda ekstrak akan otomatis tersimpan secara aman di browser lokal Anda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {history.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onClick={() => reloadItem(item)}
                  className="group bg-[#111827] hover:bg-[#161f33] border border-slate-800/80 hover:border-slate-700 p-3 rounded-xl flex gap-3 transition-all cursor-pointer items-center justify-between"
                  title="Klik untuk memuat ulang tautan ini"
                >
                  {/* Thumbnail and content info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
                      <img
                        src={item.cover}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-0.5 right-0.5 bg-black/80 px-1 py-0.2 rounded text-[8px] text-slate-300 font-mono">
                        {item.duration}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5 min-w-0">
                      <h3 className="text-xs md:text-sm font-semibold text-slate-100 line-clamp-1 group-hover:text-emerald-400 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-[10px] md:text-xs text-slate-400 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          item.platform === "tiktok" ? "bg-cyan-400" :
                          item.platform === "youtube" ? "bg-red-500" :
                          item.platform === "instagram" ? "bg-purple-500" :
                          "bg-slate-400"
                        }`} />
                        <span className="capitalize">{item.platform}</span>
                        <span className="text-slate-600">•</span>
                        <span className="font-mono text-[9px] md:text-[10px] bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700/50 uppercase font-semibold text-slate-300">
                          {item.format} ({item.quality})
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-1 md:gap-2 shrink-0">
                    <button
                      type="button"
                      id={`btn-history-dl-${item.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerDownload(item);
                      }}
                      className="p-2 bg-[#1f2937] hover:bg-emerald-500/20 border border-slate-800 hover:border-emerald-500/20 text-slate-300 hover:text-emerald-400 rounded-lg transition-all cursor-pointer"
                      title="Unduh instan"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      id={`btn-history-del-${item.id}`}
                      onClick={(e) => removeHistoryItem(item.id, e)}
                      className="p-2 bg-[#1f2937] hover:bg-rose-500/20 border border-slate-800 hover:border-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-all cursor-pointer"
                      title="Hapus dari riwayat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* 5. Clean, professional footer & info */}
      <div id="info-footer" className="text-center border-t border-slate-900 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <p>© 2026 Premium Downloader. Hak Cipta Dilindungi Undang-Undang.</p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Lokal & Privat (No Logs)
          </span>
          <span className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-emerald-500" />
            Konversi Cepat
          </span>
        </div>
      </div>
    </div>
  );
}

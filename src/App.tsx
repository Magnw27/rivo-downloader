import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle, ArrowDownToLine, Check, Clipboard, Clock3, Copy, Download,
  History, Link2, Loader2, Music2, Play, RotateCcw, Search, ShieldCheck,
  Sparkles, Trash2, UserRound, Video, X, Zap,
} from "lucide-react";

type Platform = "tiktok" | "youtube" | "instagram" | "generic";
type Format = "mp4" | "mp3";
type Quality = "high" | "medium" | "low";

interface DownloadItem {
  id: string;
  title: string;
  author: string;
  cover: string;
  duration: string;
  platform: Platform;
  format: Format;
  quality: string;
  downloadUrl: string;
  originalUrl: string;
  timestamp: number;
}

const STORAGE_KEY = "rivotik_history";
const FALLBACK_COVER = "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=900&auto=format&fit=crop";
const loadingSteps = ["Menganalisis URL media…", "Mengambil metadata…", "Menyiapkan format pilihan…", "Menyiapkan link unduhan…"];
const platformLabel: Record<Platform, string> = { tiktok: "TikTok", youtube: "YouTube", instagram: "Instagram", generic: "Media" };

function detectPlatform(value: string): Platform {
  const v = value.toLowerCase();
  if (v.includes("tiktok.com")) return "tiktok";
  if (v.includes("youtube.com") || v.includes("youtu.be")) return "youtube";
  if (v.includes("instagram.com")) return "instagram";
  return "generic";
}
function platformClass(platform: Platform) { return { tiktok: "platform-tiktok", youtube: "platform-youtube", instagram: "platform-instagram", generic: "platform-generic" }[platform]; }
function qualityLabel(format: Format, quality: Quality) { if (format === "mp3") return "320 kbps"; return quality === "high" ? "1080p HD" : quality === "medium" ? "720p HD" : "480p SD"; }
function prettyTime(timestamp: number) { const minutes = Math.floor(Math.max(0, Date.now() - timestamp) / 60000); if (minutes < 1) return "Baru saja"; if (minutes < 60) return `${minutes} menit lalu`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours} jam lalu`; return `${Math.floor(hours / 24)} hari lalu`; }

export default function App() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<Format>("mp4");
  const [quality, setQuality] = useState<Quality>("high");
  const [history, setHistory] = useState<DownloadItem[]>([]);
  const [media, setMedia] = useState<DownloadItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) setHistory(JSON.parse(saved)); }
    catch { localStorage.removeItem(STORAGE_KEY); }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); document.getElementById("url-input")?.focus(); }
      if (event.key === "Escape") setUrl("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const persist = (items: DownloadItem[]) => { setHistory(items); localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); };
  const filteredHistory = useMemo(() => history.filter((item) => `${item.title} ${item.author} ${item.platform}`.toLowerCase().includes(search.toLowerCase())), [history, search]);
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2200); };

  const copyText = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); }
    catch { const area = document.createElement("textarea"); area.value = text; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove(); }
    setCopied(id); flash("Link berhasil disalin."); window.setTimeout(() => setCopied(""), 1800);
  };

  const pasteUrl = async () => {
    try { const text = await navigator.clipboard.readText(); if (text) setUrl(text.trim()); flash(text ? "URL ditempel dari clipboard." : "Clipboard kosong."); }
    catch { document.getElementById("url-input")?.focus(); flash("Clipboard tidak tersedia. Gunakan Ctrl + V."); }
  };

  const triggerDownload = (item: DownloadItem) => {
    const anchor = document.createElement("a");
    anchor.href = item.downloadUrl;
    anchor.download = `${item.title.replace(/[^\w\s-]/g, "").trim() || "rivotik-download"}.${item.format}`;
    anchor.rel = "noopener";
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
  };

  const extract = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) return setError("Masukkan URL media terlebih dahulu.");
    try { new URL(cleanUrl); } catch { return setError("URL belum valid. Contoh: https://youtube.com/…"); }
    setLoading(true); setStep(0); setError(""); setMedia(null);
    const interval = window.setInterval(() => setStep((value) => Math.min(value + 1, loadingSteps.length - 1)), 900);
    try {
      const response = await fetch("/api/download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: cleanUrl, format, quality }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || "Media gagal diproses. Coba URL lain.");
      const item: DownloadItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: data.title || "Unduhan Media", author: data.author || "Unknown creator", cover: data.cover || FALLBACK_COVER,
        duration: data.duration || "0:00", platform: data.platform || detectPlatform(cleanUrl), format: data.format || format,
        quality: qualityLabel(data.format || format, quality), downloadUrl: data.downloadUrl, originalUrl: cleanUrl, timestamp: Date.now(),
      };
      setMedia(item);
      persist([item, ...history.filter((old) => !(old.originalUrl === cleanUrl && old.format === format))].slice(0, 50));
      flash("Media siap diunduh.");
    } catch (err) { setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses media."); }
    finally { window.clearInterval(interval); setLoading(false); }
  };

  const loadItem = (item: DownloadItem) => { setUrl(item.originalUrl); setFormat(item.format); setMedia(item); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const removeItem = (id: string, event?: React.MouseEvent) => { event?.stopPropagation(); persist(history.filter((item) => item.id !== id)); if (media?.id === id) setMedia(null); };
  const clearHistory = () => { if (history.length && window.confirm("Hapus semua riwayat lokal Rivotik?")) persist([]); };

  return (
    <div className="rivo-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" /><div className="grid-overlay" /><div className="noise-overlay" />
      <header className="topbar"><a className="brand" href="#" aria-label="Rivotik"><span className="brand-mark"><ArrowDownToLine size={18} /></span><span>Rivotik</span></a><div className="topbar-status"><span className="status-dot" /> <span>Service online</span><span className="kbd">Ctrl K</span></div></header>
      <main className="main-content">
        <section className="hero">
          <motion.div className="eyebrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><Sparkles size={14} /> FAST MEDIA TOOL <span>•</span> RIVOTIK</motion.div>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08 }}>Download media.<br /><span>Simple. Fast. Clean.</span></motion.h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .16 }}>Tempel URL, pilih format, lalu Rivotik menyiapkan media untukmu. Nyaman di HP maupun desktop.</motion.p>
          <div className="platform-pills">{(["tiktok", "youtube", "instagram"] as Platform[]).map((name) => <span key={name} className={`platform-pill ${platformClass(name)}`}><span className="mini-dot" /> {platformLabel[name]}</span>)}</div>
        </section>

        <motion.section className="download-card glass-card" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .22 }}>
          <div className="card-glow" /><div className="card-heading"><div><span className="section-kicker"><Zap size={13} /> QUICK DOWNLOAD</span><h2>Masukkan link media</h2></div><div className="secure-badge"><ShieldCheck size={14} /> Secure request</div></div>
          <form onSubmit={extract}>
            <label className="url-label" htmlFor="url-input"><Link2 size={15} /> URL video atau audio</label>
            <div className="url-box"><Search className="input-icon" size={19} /><input id="url-input" value={url} onChange={(event) => { setUrl(event.target.value); setError(""); }} placeholder="https://youtube.com/... atau link media lainnya" autoComplete="off" />{url && <button type="button" className="icon-btn" onClick={() => setUrl("")} aria-label="Clear URL"><X size={17} /></button>}<button type="button" className="paste-btn" onClick={pasteUrl}><Clipboard size={15} /> Paste</button></div>
            <div className="options-grid"><div className="option-group"><span>FORMAT</span><div className="segmented"><button type="button" className={format === "mp4" ? "active" : ""} onClick={() => setFormat("mp4")}><Video size={15} /> MP4</button><button type="button" className={format === "mp3" ? "active" : ""} onClick={() => setFormat("mp3")}><Music2 size={15} /> MP3</button></div></div><div className="option-group"><span>KUALITAS</span><div className="segmented three">{(["high", "medium", "low"] as Quality[]).map((value) => <button key={value} type="button" disabled={format === "mp3" && value !== "high"} className={quality === value ? "active" : ""} onClick={() => setQuality(value)}>{value === "high" ? "1080p" : value === "medium" ? "720p" : "480p"}</button>)}</div></div></div>
            <motion.button id="btn-submit" className="primary-btn" type="submit" disabled={loading || !url.trim()} whileHover={{ scale: 1.01 }} whileTap={{ scale: .985 }}>{loading ? <Loader2 size={19} className="spin" /> : <Download size={19} />}{loading ? "Mempersiapkan media…" : "Mulai Download"}{!loading && <span className="button-arrow">→</span>}</motion.button>
          </form>
          <AnimatePresence>{loading && <motion.div className="loader-panel" initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: "auto", marginTop: 16 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}><div className="loader-top"><span>{loadingSteps[step]}</span><strong>{Math.round(((step + 1) / loadingSteps.length) * 100)}%</strong></div><div className="progress-track"><motion.div className="progress-fill" animate={{ width: `${((step + 1) / loadingSteps.length) * 100}%` }} /></div><div className="loader-steps">{loadingSteps.map((label, index) => <span key={label} className={index <= step ? "done" : ""}>{index < step ? <Check size={11} /> : <span>{index + 1}</span>}{label}</span>)}</div></motion.div>}</AnimatePresence>
          <AnimatePresence>{error && <motion.div className="alert error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><AlertCircle size={18} /><div><strong>Gagal memproses</strong><span>{error}</span></div></motion.div>}</AnimatePresence>
        </motion.section>

        <AnimatePresence>{media && !loading && <motion.section className="result-card glass-card" initial={{ opacity: 0, y: 24, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }}><div className="result-media"><img src={media.cover || FALLBACK_COVER} alt="" referrerPolicy="no-referrer" /><div className="image-shade" /><span className={`media-badge ${platformClass(media.platform)}`}>{platformLabel[media.platform]}</span><span className="duration"><Clock3 size={12} /> {media.duration}</span><div className="play-orb"><Play size={17} fill="currentColor" /></div></div><div className="result-content"><div className="result-meta"><span className="ready"><Check size={12} /> READY</span><span>{media.format.toUpperCase()}</span><span>•</span><span>{media.quality}</span></div><h2>{media.title}</h2><p className="author"><UserRound size={14} /> {media.author}</p><div className="result-actions"><button className="primary-small" onClick={() => triggerDownload(media)}><Download size={17} /> Unduh sekarang</button><button className="secondary-small" onClick={() => copyText(media.downloadUrl, media.id)}>{copied === media.id ? <Check size={16} /> : <Copy size={16} />}{copied === media.id ? "Tersalin" : "Salin link"}</button></div></div></motion.section>}</AnimatePresence>

        <section className="feature-row">{[[Zap, "Fast workflow", "UI responsif tanpa langkah bertele-tele."], [ShieldCheck, "Local history", "Riwayat disimpan aman di browser."], [Sparkles, "Smooth motion", "Transisi halus dan tetap ringan."]].map(([Icon, title, text], index) => { const FeatureIcon = Icon as typeof Zap; return <motion.div key={String(title)} className="feature-card" initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .4 }} transition={{ delay: index * .07 }}><span className="feature-icon"><FeatureIcon size={17} /></span><div><strong>{title}</strong><p>{text}</p></div></motion.div>; })}</section>

        <section className="history-section"><div className="history-header"><div><span className="section-kicker"><History size={13} /> YOUR ACTIVITY</span><h2>Riwayat unduhan <span>{history.length}</span></h2></div><div className="history-tools">{history.length > 0 && <label className="history-search"><Search size={14} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari…" /></label>}{history.length > 0 && <button className="danger-btn" onClick={clearHistory}><Trash2 size={14} /> Bersihkan</button>}</div></div>
          {filteredHistory.length === 0 ? <div className="empty-state"><div className="empty-orb"><History size={23} /></div><strong>{history.length ? "Tidak ada hasil pencarian" : "Belum ada aktivitas"}</strong><p>{history.length ? "Coba kata kunci lain." : "Hasil media yang kamu proses akan muncul di sini."}</p></div> : <div className="history-list"><AnimatePresence initial={false}>{filteredHistory.map((item) => <motion.article className="history-item" key={item.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} onClick={() => loadItem(item)}><img src={item.cover || FALLBACK_COVER} alt="" referrerPolicy="no-referrer" /><div className="history-info"><strong>{item.title}</strong><span>{item.author}</span><small><i className={`mini-dot ${platformClass(item.platform)}`} />{platformLabel[item.platform]} · {item.format.toUpperCase()} · {prettyTime(item.timestamp)}</small></div><div className="history-actions"><button title="Download ulang" onClick={(e) => { e.stopPropagation(); triggerDownload(item); }}><Download size={15} /></button><button title="Muat ulang" onClick={(e) => { e.stopPropagation(); loadItem(item); }}><RotateCcw size={15} /></button><button className="delete" title="Hapus" onClick={(e) => removeItem(item.id, e)}><Trash2 size={15} /></button></div></motion.article>)}</AnimatePresence></div>}
        </section>
      </main>
      <footer className="footer"><div><span className="brand-dot" /> Rivotik <span>•</span> Built for a clean download experience.</div><div>© 2026 Rivotik</div></footer>
      <AnimatePresence>{notice && <motion.div className="toast" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}><Check size={15} /> {notice}</motion.div>}</AnimatePresence>
    </div>
  );
}

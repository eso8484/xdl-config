'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'

/* ─── Types ─────────────────────────────────────────────── */
interface VideoVariant {
  url: string
  quality: string
  bitrate: number
}

interface ExtractResult {
  variants: VideoVariant[]
  thumbnail: string
  tweetId: string
  authorName: string
  authorHandle: string
}

interface HistoryItem {
  id: string
  tweetUrl: string
  authorName: string
  authorHandle: string
  thumbnail: string
  quality: string
  downloadedAt: number
}

/* ─── Helpers ───────────────────────────────────────────── */
const HISTORY_KEY = 'xdl_history'

function loadHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 20)))
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/* ─── Icons (inline SVG) ────────────────────────────────── */
const IconDownload = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
)

const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
)

const IconMoon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

const IconSun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
)

const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

/* ─── Main Component ────────────────────────────────────── */
export default function Home() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ExtractResult | null>(null)
  const [selectedQuality, setSelectedQuality] = useState<VideoVariant | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadDone, setDownloadDone] = useState(false)
  const [downloadStatus, setDownloadStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [darkMode, setDarkMode] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  /* Load history & dark mode pref */
  useEffect(() => {
    setHistory(loadHistory())
    const pref = localStorage.getItem('xdl_dark')
    if (pref === 'false') setDarkMode(false)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('xdl_dark', String(darkMode))
  }, [darkMode])

  /* Select highest quality by default */
  useEffect(() => {
    if (result?.variants?.length) {
      setSelectedQuality(result.variants[0])
    }
  }, [result])

  /* ── Extract ── */
  const handleExtract = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    setResult(null)
    setDownloadDone(false)

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Extraction failed')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [url])

  /* ── Download ── */
  const handleDownload = useCallback(async () => {
    if (!selectedQuality || !result) return

    setDownloading(true)
    setDownloadDone(false)
    setError(null)
    setDownloadStatus('Downloading…')

    try {
      const dlUrl = `/api/download?url=${encodeURIComponent(selectedQuality.url)}&quality=${encodeURIComponent(selectedQuality.quality)}`
      const res = await fetch(dlUrl)
      if (!res.ok) throw new Error('Download failed')

      /* The server already fixes aspect ratio (tkhd + pasp patching),
       * so the blob is ready to save directly — no client-side processing needed. */
      const blob = await res.blob()

      setDownloadStatus('Saving…')
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `twitter_video_${selectedQuality.quality}_${result.tweetId}.mp4`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000)

      setDownloadDone(true)
      setDownloadStatus('')
      setTimeout(() => setDownloadDone(false), 3000)

      /* Save to history */
      const newItem: HistoryItem = {
        id: `${result.tweetId}_${Date.now()}`,
        tweetUrl: url.trim(),
        authorName: result.authorName,
        authorHandle: result.authorHandle,
        thumbnail: result.thumbnail,
        quality: selectedQuality.quality,
        downloadedAt: Date.now(),
      }
      setHistory(prev => {
        const updated = [newItem, ...prev].slice(0, 20)
        saveHistory(updated)
        return updated
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
      setDownloadStatus('')
    } finally {
      setDownloading(false)
    }
  }, [selectedQuality, result, url])

  /* ── Enter key ── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleExtract()
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem(HISTORY_KEY)
  }

  /* ─── Render ─── */
  return (
    <div className={`relative min-h-screen z-10 transition-colors duration-300 ${darkMode ? '' : 'bg-slate-100'}`}>

      {/* ── Navbar ── */}
      <nav className={`relative z-20 flex items-center justify-between px-6 py-5 border-b ${darkMode ? 'border-[#1E2D42]' : 'border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-accent-dim border border-[#0EA5E9]/30' : 'bg-sky-100 border border-sky-300'}`}>
            <IconX />
          </div>
          <span className={`font-syne font-800 text-xl tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}
            style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800 }}>
            XDL
          </span>
          <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${darkMode ? 'bg-[#0EA5E9]/10 text-[#0EA5E9] border border-[#0EA5E9]/20' : 'bg-sky-100 text-sky-600'}`}
            style={{ fontFamily: 'DM Mono, monospace' }}>
            v1.0
          </span>
        </div>

        <div className="flex items-center gap-3">
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory(s => !s)}
              className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-colors ${darkMode
                ? 'text-[#4A6180] hover:text-[#C8D8EC] hover:bg-[#0F1625]'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
              }`}
              style={{ fontFamily: 'DM Mono, monospace' }}>
              <IconClock />
              <span>{history.length} downloads</span>
            </button>
          )}

          <button
            onClick={() => setDarkMode(d => !d)}
            className={`p-2 rounded-lg transition-colors ${darkMode
              ? 'text-[#4A6180] hover:text-[#C8D8EC] hover:bg-[#0F1625]'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
            }`}>
            {darkMode ? <IconSun /> : <IconMoon />}
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <main className="relative z-10 max-w-2xl mx-auto px-4 pt-16 pb-24">

        {/* Title */}
        <div className="text-center mb-12">
          <h1 className={`text-5xl sm:text-6xl font-bold tracking-tight mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}
            style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, letterSpacing: '-0.03em' }}>
            Download any{' '}
            <span style={{
              background: 'linear-gradient(135deg, #0EA5E9 0%, #38BDF8 50%, #7DD3FC 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              X video
            </span>
          </h1>
          <p className={`text-base ${darkMode ? 'text-[#4A6180]' : 'text-slate-500'}`}
            style={{ fontFamily: 'DM Mono, monospace' }}>
            Paste a tweet URL → pick quality → download
          </p>
        </div>

        {/* ── Input Card ── */}
        <div className={`rounded-2xl border p-6 mb-6 card-glow ${darkMode
          ? 'bg-[#0A0F1A] border-[#1E2D42]'
          : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <label className={`block text-xs font-semibold uppercase tracking-widest mb-3 ${darkMode ? 'text-[#4A6180]' : 'text-slate-400'}`}
            style={{ fontFamily: 'DM Mono, monospace' }}>
            Tweet / Post URL
          </label>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://x.com/user/status/..."
                className={`w-full px-4 py-3 rounded-xl text-sm outline-none transition-all border ${darkMode
                  ? 'bg-[#060B14] border-[#1E2D42] text-[#C8D8EC] placeholder-[#2A3F58] focus:border-[#0EA5E9]/60 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.1)]'
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-300 focus:border-sky-400 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.08)]'
                }`}
                style={{ fontFamily: 'DM Mono, monospace' }}
              />
            </div>

            <button
              onClick={handleExtract}
              disabled={loading || !url.trim()}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${
                loading || !url.trim()
                  ? darkMode ? 'bg-[#0F1625] text-[#2A3F58] cursor-not-allowed' : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  : 'bg-[#0EA5E9] hover:bg-[#38BDF8] text-white shadow-lg shadow-[#0EA5E9]/20 hover:shadow-[#0EA5E9]/30 active:scale-95'
              }`}
              style={{ fontFamily: 'Syne, sans-serif' }}>
              {loading ? (
                <>
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <span>Scanning</span>
                </>
              ) : (
                <>
                  <IconSearch />
                  <span>Extract</span>
                </>
              )}
            </button>
          </div>

          {/* Loading bar */}
          {loading && (
            <div className={`mt-4 h-0.5 rounded-full overflow-hidden ${darkMode ? 'bg-[#1E2D42]' : 'bg-slate-200'}`}>
              <div className="h-full bg-[#0EA5E9] animate-[shimmer_1.5s_ease-in-out_infinite] rounded-full"
                style={{ width: '60%', animation: 'pulse 1s ease-in-out infinite', background: 'linear-gradient(90deg, #0EA5E9, #38BDF8, #0EA5E9)', backgroundSize: '200% 100%' }} />
            </div>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className={`rounded-xl border px-4 py-3 mb-6 flex items-start gap-3 animate-slide-up ${darkMode
            ? 'bg-red-500/8 border-red-500/20 text-red-400'
            : 'bg-red-50 border-red-200 text-red-600'
          }`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <p className="text-sm" style={{ fontFamily: 'DM Mono, monospace' }}>{error}</p>
          </div>
        )}

        {/* ── Result Card ── */}
        {result && (
          <div className={`rounded-2xl border overflow-hidden mb-6 animate-slide-up ${darkMode
            ? 'bg-[#0A0F1A] border-[#1E2D42]'
            : 'bg-white border-slate-200 shadow-sm'
          }`}>
            {/* Thumbnail + author */}
            <div className="flex gap-4 p-5 pb-4">
              {result.thumbnail && (
                <div className="relative w-28 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#0F1625]">
                  <Image
                    src={result.thumbnail}
                    alt="Video thumbnail"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col justify-center min-w-0">
                <p className={`font-semibold text-sm truncate ${darkMode ? 'text-[#C8D8EC]' : 'text-slate-800'}`}
                  style={{ fontFamily: 'Syne, sans-serif' }}>
                  {result.authorName || 'Twitter Video'}
                </p>
                {result.authorHandle && (
                  <p className={`text-xs mt-0.5 ${darkMode ? 'text-[#4A6180]' : 'text-slate-400'}`}
                    style={{ fontFamily: 'DM Mono, monospace' }}>
                    @{result.authorHandle}
                  </p>
                )}
                <p className={`text-xs mt-2 ${darkMode ? 'text-[#2A3F58]' : 'text-slate-300'}`}
                  style={{ fontFamily: 'DM Mono, monospace' }}>
                  {result.variants.length} quality option{result.variants.length !== 1 ? 's' : ''} found
                </p>
              </div>
            </div>

            <div className={`mx-5 h-px ${darkMode ? 'bg-[#1E2D42]' : 'bg-slate-100'}`} />

            {/* Quality selector */}
            <div className="p-5 pt-4">
              <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${darkMode ? 'text-[#4A6180]' : 'text-slate-400'}`}
                style={{ fontFamily: 'DM Mono, monospace' }}>
                Select Quality
              </p>
              <div className="flex flex-wrap gap-2 mb-5">
                {result.variants.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedQuality(v)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      selectedQuality?.url === v.url
                        ? 'bg-[#0EA5E9]/15 border-[#0EA5E9] text-[#0EA5E9]'
                        : darkMode
                          ? 'bg-[#0F1625] border-[#1E2D42] text-[#4A6180] hover:border-[#2A3F58] hover:text-[#C8D8EC]'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-600'
                    }`}
                    style={{ fontFamily: 'DM Mono, monospace' }}>
                    {v.quality}
                    {i === 0 && (
                      <span className="ml-1.5 text-[10px] text-[#0EA5E9]/70">BEST</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Download button */}
              <button
                onClick={handleDownload}
                disabled={downloading || !selectedQuality}
                className={`w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm transition-all ${
                  downloadDone
                    ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400'
                    : downloading
                      ? darkMode ? 'bg-[#0F1625] text-[#4A6180] cursor-wait border border-[#1E2D42]' : 'bg-slate-100 text-slate-400 cursor-wait'
                      : 'bg-[#0EA5E9] hover:bg-[#38BDF8] text-white shadow-lg shadow-[#0EA5E9]/20 hover:shadow-[#0EA5E9]/30 active:scale-[0.98]'
                }`}
                style={{ fontFamily: 'Syne, sans-serif' }}>
                {downloadDone ? (
                  <>
                    <IconCheck />
                    <span>Downloaded!</span>
                  </>
                ) : downloading ? (
                  <>
                    <svg className="animate-spin flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    <span>{downloadStatus || 'Downloading…'}</span>
                  </>
                ) : (
                  <>
                    <IconDownload />
                    <span>Download {selectedQuality?.quality}</span>
                  </>
                )}
              </button>
              {/* Aspect ratio note */}
              <p className={`text-center text-[11px] mt-2 ${darkMode ? 'text-[#2A3F58]' : 'text-slate-300'}`}
                style={{ fontFamily: 'DM Mono, monospace' }}>
                Aspect ratio is preserved automatically
              </p>
            </div>
          </div>
        )}

        {/* ── History ── */}
        {showHistory && history.length > 0 && (
          <div className={`rounded-2xl border overflow-hidden animate-slide-up ${darkMode
            ? 'bg-[#0A0F1A] border-[#1E2D42]'
            : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? 'border-[#1E2D42]' : 'border-slate-100'}`}>
              <div className="flex items-center gap-2">
                <IconClock />
                <h2 className={`text-sm font-bold ${darkMode ? 'text-[#C8D8EC]' : 'text-slate-700'}`}
                  style={{ fontFamily: 'Syne, sans-serif' }}>
                  Download History
                </h2>
              </div>
              <button
                onClick={clearHistory}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${darkMode
                  ? 'text-[#4A6180] hover:text-red-400 hover:bg-red-500/8'
                  : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                }`}
                style={{ fontFamily: 'DM Mono, monospace' }}>
                <IconTrash />
                Clear
              </button>
            </div>

            <div className="divide-y divide-[#1E2D42]">
              {history.map(item => (
                <div key={item.id}
                  className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${darkMode ? 'hover:bg-[#0F1625]' : 'hover:bg-slate-50'}`}>
                  {item.thumbnail && (
                    <div className="relative w-14 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-[#0F1625]">
                      <Image src={item.thumbnail} alt="" fill className="object-cover" unoptimized />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${darkMode ? 'text-[#C8D8EC]' : 'text-slate-700'}`}
                      style={{ fontFamily: 'Syne, sans-serif' }}>
                      {item.authorName || 'Unknown'}
                    </p>
                    <p className={`text-xs truncate ${darkMode ? 'text-[#4A6180]' : 'text-slate-400'}`}
                      style={{ fontFamily: 'DM Mono, monospace' }}>
                      @{item.authorHandle} · {item.quality}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${darkMode ? 'bg-[#0EA5E9]/10 text-[#0EA5E9]' : 'bg-sky-100 text-sky-600'}`}
                      style={{ fontFamily: 'DM Mono, monospace' }}>
                      {item.quality}
                    </span>
                    <span className={`text-[10px] ${darkMode ? 'text-[#2A3F58]' : 'text-slate-300'}`}
                      style={{ fontFamily: 'DM Mono, monospace' }}>
                      {timeAgo(item.downloadedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Empty history hint ── */}
        {!result && !loading && history.length === 0 && (
          <div className="text-center mt-8">
            <p className={`text-sm ${darkMode ? 'text-[#2A3F58]' : 'text-slate-300'}`}
              style={{ fontFamily: 'DM Mono, monospace' }}>
              Supports twitter.com and x.com links
            </p>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className={`relative z-10 text-center py-6 text-xs border-t ${darkMode
        ? 'text-[#2A3F58] border-[#1E2D42]'
        : 'text-slate-300 border-slate-200'
      }`} style={{ fontFamily: 'DM Mono, monospace' }}>
        XDL · For personal use only · Respect copyright
      </footer>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'

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

const heroImage = 'https://www.figma.com/api/mcp/asset/09f94a8e-9a98-462a-b79d-e53d1a1885a7'
const cartIcon = 'https://www.figma.com/api/mcp/asset/ba8a5b94-e694-4ac2-bb70-b8e3cd959906'
const arrowIcon = 'https://www.figma.com/api/mcp/asset/8b3f8111-59da-4aad-a7e0-14af3f87a343'

function LogoMark() {
  return <span className="tracking-[0.22em]">MNTN</span>
}

function ArrowLink({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-3 text-[0.9rem] font-semibold text-[#fbd784]">
      <span>{label}</span>
      <img src={arrowIcon} alt="" aria-hidden className="h-4 w-4 -rotate-90" />
    </span>
  )
}

function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function IconDownload() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ExtractResult | null>(null)
  const [selectedQuality, setSelectedQuality] = useState<VideoVariant | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadDone, setDownloadDone] = useState(false)
  const [downloadStatus, setDownloadStatus] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (result?.variants?.length) {
      setSelectedQuality(result.variants[0])
    }
  }, [result])

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
      setDownloadStatus('')
    } finally {
      setDownloading(false)
    }
  }, [selectedQuality, result])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleExtract()
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b1d26] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(11,29,38,0.15)_0%,rgba(11,29,38,0.82)_55%,#0b1d26_88%)]" />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-[62rem] opacity-95">
        <img src={heroImage} alt="" aria-hidden className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,29,38,0.14)_0%,rgba(11,29,38,0.3)_36%,rgba(11,29,38,0.96)_100%)]" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-[1600px] items-center justify-between px-6 py-8 sm:px-10 lg:px-20">
        <a href="#top" className="font-display text-2xl tracking-[0.28em] text-white">
          <LogoMark />
        </a>

        <a href="#download" className="inline-flex items-center gap-3 text-sm font-semibold text-white/95 transition-colors hover:text-[#fbd784]">
          <img src={cartIcon} alt="" aria-hidden className="h-5 w-5" />
          <span>Download</span>
        </a>
      </header>

      <div id="top" className="relative z-10 mx-auto flex min-h-[calc(100vh-7.5rem)] max-w-[1600px] items-center px-6 pb-16 pt-12 sm:px-10 lg:px-20 lg:pb-24 lg:pt-18">
        <section className="max-w-[68rem]">
          <div className="mb-7 flex items-center gap-6">
            <span className="h-px w-16 bg-[#fbd784]" />
            <span className="text-[0.72rem] font-black uppercase tracking-[0.42em] text-[#fbd784]">
              X video downloader
            </span>
          </div>

          <h1 className="max-w-[60rem] font-display text-[clamp(3.1rem,7vw,5.5rem)] leading-[0.92] text-white [text-wrap:balance]">
            Download X videos with the MNTN look.
          </h1>

          <p className="mt-6 max-w-[36rem] text-[0.98rem] leading-8 text-white/82 sm:text-[1.05rem]">
            Paste a tweet or X post link, extract the available video qualities, and download the one you want.
          </p>

          <div className="mt-8">
            <ArrowLink label="paste your link below" />
          </div>
        </section>
      </div>

      <div id="download" className="relative z-10 mx-auto max-w-[1600px] px-6 pb-24 sm:px-10 lg:px-20 lg:pb-32">
        <section className="max-w-[56rem] rounded-[2rem] border border-white/10 bg-[#08141d]/72 p-6 shadow-[0_32px_120px_rgba(0,0,0,0.3)] backdrop-blur-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row">
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://x.com/user/status/..."
              className="h-14 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-[0.95rem] text-white outline-none placeholder:text-white/35 focus:border-[#fbd784]/60 focus:bg-white/8"
            />
            <button
              onClick={handleExtract}
              disabled={loading || !url.trim()}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#fbd784] px-6 font-semibold text-[#0b1d26] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
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

          {error && (
            <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
              <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5">
                {result.thumbnail ? (
                  <div className="relative aspect-[1.15] w-full">
                    <img src={result.thumbnail} alt="Video thumbnail" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,29,38,0.05)_0%,rgba(11,29,38,0.65)_100%)]" />
                  </div>
                ) : null}
                <div className="p-5">
                  <p className="text-sm font-semibold text-white">{result.authorName || 'Twitter Video'}</p>
                  <p className="mt-1 text-xs text-white/60">@{result.authorHandle || 'unknown'}</p>
                  <p className="mt-4 text-xs uppercase tracking-[0.3em] text-[#fbd784]">{result.variants.length} quality option{result.variants.length === 1 ? '' : 's'} found</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.38em] text-[#fbd784]">Select quality</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {result.variants.map((variant, index) => (
                    <button
                      key={`${variant.url}-${index}`}
                      onClick={() => setSelectedQuality(variant)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${selectedQuality?.url === variant.url ? 'border-[#fbd784] bg-[#fbd784]/15 text-[#fbd784]' : 'border-white/10 bg-white/5 text-white/72 hover:border-white/20 hover:text-white'}`}
                    >
                      {variant.quality}
                      {index === 0 ? <span className="ml-2 text-[10px] uppercase tracking-[0.28em] text-[#fbd784]/80">best</span> : null}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleDownload}
                  disabled={downloading || !selectedQuality}
                  className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 font-bold transition-transform ${downloadDone ? 'border border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'bg-[#fbd784] text-[#0b1d26] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60'}`}
                >
                  {downloadDone ? (
                    <>
                      <IconCheck />
                      <span>Downloaded</span>
                    </>
                  ) : downloading ? (
                    <>
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      <span>{downloadStatus || 'Downloading…'}</span>
                    </>
                  ) : (
                    <>
                      <IconDownload />
                      <span>Download {selectedQuality?.quality ?? 'video'}</span>
                    </>
                  )}
                </button>

                <p className="mt-3 text-center text-[11px] text-white/45">
                  Aspect ratio is preserved automatically.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
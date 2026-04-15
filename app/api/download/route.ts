import { NextRequest } from 'next/server'

// Node.js runtime so we can buffer + patch MP4 metadata
export const runtime = 'nodejs'
export const maxDuration = 60

/* ─── Security ──────────────────────────────────────────── */
const ALLOWED_HOSTS = ['video.twimg.com', 'pbs.twimg.com', 'ton.twimg.com']

function isAllowedUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return ALLOWED_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`))
  } catch {
    return false
  }
}

/* ─── Pure-JS MP4 PASP (Pixel Aspect Ratio) Fixer ───────
 *
 *  Twitter videos occasionally carry a non-1:1 SAR (Sample Aspect
 *  Ratio) flag inside the pasp atom. Players that respect it will
 *  scale the picture and cause the "stretched" look.
 *
 *  Fix: walk the MP4 box tree, find every pasp box, and
 *  set hSpacing = vSpacing = 1  (square pixels, no scaling).
 *  This is a pure in-place rewrite — video data is untouched.
 * ──────────────────────────────────────────────────────── */

/** Recursively walk MP4 boxes and patch any pasp boxes found.
 *  Also patches tkhd width/height if displayW/displayH are given. */
function patchPasp(
  buf: Buffer,
  start: number,
  end: number,
  displayW?: number,
  displayH?: number
): void {
  let pos = start

  while (pos + 8 <= end) {
    let size = buf.readUInt32BE(pos)
    const type = buf.subarray(pos + 4, pos + 8).toString('latin1')

    // Extended size (64-bit) — rare, skip safely
    if (size === 1) {
      if (pos + 16 > end) break
      const hi = buf.readUInt32BE(pos + 8)
      const lo = buf.readUInt32BE(pos + 12)
      if (hi !== 0) break
      size = lo
    }

    // size 0 means "to end of file" per spec
    if (size === 0) size = end - pos
    if (size < 8 || pos + size > end) break

    /* ── patch pasp ── */
    if (type === 'pasp' && size >= 16) {
      buf.writeUInt32BE(1, pos + 8)   // hSpacing = 1
      buf.writeUInt32BE(1, pos + 12)  // vSpacing = 1
    }

    /* ── patch tkhd width/height (16.16 fixed-point) ── */
    if (type === 'tkhd' && displayW && displayH && size >= 92) {
      // tkhd v0: 8(header)+4(ver+flags)+4(creation)+4(mod)+4(id)+4(res)+4(dur)
      //          +8(reserved)+4(layer+alt)+4(volume)+8(reserved)+36(matrix)
      //          = offset 76 → width (4 bytes), offset 80 → height (4 bytes)
      // tkhd v1: same layout but times are 8 bytes each → offset 88
      const version = buf.readUInt8(pos + 8)
      const tkhdOffset = version === 1 ? 88 : 76
      if (pos + tkhdOffset + 8 <= end) {
        buf.writeUInt32BE(displayW << 16, pos + tkhdOffset)      // width  16.16
        buf.writeUInt32BE(displayH << 16, pos + tkhdOffset + 4)  // height 16.16
      }
    }

    /* ── recurse into containers ── */
    const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'udta', 'mvex', 'dinf', 'edts', 'meta'])
    if (CONTAINERS.has(type)) {
      patchPasp(buf, pos + 8, pos + size, displayW, displayH)
    }

    // stsd: 4 bytes (version+flags) + 4 bytes (entry count) before children
    if (type === 'stsd') {
      patchPasp(buf, pos + 16, pos + size, displayW, displayH)
    }

    // Video codec sample entry boxes:
    // 8 (header) + 78 (VisualSampleEntry fixed fields) = 86 bytes before children
    const VIDEO_ENTRIES = new Set(['avc1', 'avc3', 'hvc1', 'hev1', 'mp4v', 'dvh1', 'dvhe', 'av01', 'vp08', 'vp09'])
    if (VIDEO_ENTRIES.has(type) && pos + 86 <= end) {
      patchPasp(buf, pos + 86, pos + size, displayW, displayH)
    }

    pos += size
  }
}

/**
 * Buffers the full MP4, patches every pasp box to 1:1 (square pixels),
 * patches tkhd display dimensions, and returns the corrected buffer.
 * If the video is >120 MB we skip patching and stream it as-is to avoid OOM.
 */
async function fetchAndFixVideo(
  videoUrl: string,
  displayW?: number,
  displayH?: number
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const res = await fetch(videoUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      Referer: 'https://twitter.com/',
    },
  })

  if (!res.ok || !res.body) return null

  const contentType = res.headers.get('Content-Type') ?? 'video/mp4'

  const chunks: Buffer[] = []
  const reader = res.body.getReader()
  let totalBytes = 0
  const MAX_BYTES = 120 * 1024 * 1024 // 120 MB safety cap

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(Buffer.from(value))
      totalBytes += value.byteLength
      if (totalBytes > MAX_BYTES) {
        reader.cancel()
        return null
      }
    }
  }

  const buffer = Buffer.concat(chunks)

  // Patch pasp boxes + tkhd dimensions in-place
  patchPasp(buffer, 0, buffer.length, displayW, displayH)

  return { buffer, contentType }
}

/* ─── Route Handler ─────────────────────────────────────── */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const videoUrl = searchParams.get('url')
  const quality = searchParams.get('quality') ?? 'video'

  // Parse display dimensions from the Twitter video URL (e.g. /1280x720/)
  let displayW: number | undefined
  let displayH: number | undefined
  if (videoUrl) {
    const m = videoUrl.match(/\/(\d+)x(\d+)\//)
    if (m) {
      displayW = parseInt(m[1])
      displayH = parseInt(m[2])
    }
  }

  if (!videoUrl) {
    return new Response(JSON.stringify({ error: 'url param required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!isAllowedUrl(videoUrl)) {
    return new Response(JSON.stringify({ error: 'URL not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const safeQuality = quality.replace(/[^a-zA-Z0-9]/g, '_')
  const filename = `xdl_${safeQuality}.mp4`

  try {
    const result = await fetchAndFixVideo(videoUrl, displayW, displayH)

    if (!result) {
      // File too large — fall back to streaming proxy without patch
      const upstream = await fetch(videoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 AppleWebKit/537.36 Chrome/120',
          Referer: 'https://twitter.com/',
        },
      })
      if (!upstream.ok || !upstream.body) {
        return new Response(JSON.stringify({ error: 'Source fetch failed' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const headers = new Headers({
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      })
      const cl = upstream.headers.get('Content-Length')
      if (cl) headers.set('Content-Length', cl)
      return new Response(upstream.body, { headers })
    }

    return new Response(new Uint8Array(result.buffer), {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(result.buffer.byteLength),
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'X-Aspect-Fixed': 'true',
      },
    })
  } catch (err) {
    console.error('[download]', err)
    return new Response(JSON.stringify({ error: 'Download failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

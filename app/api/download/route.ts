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

/* ─── MP4 Aspect Ratio Fixer ─────────────────────────────
 *
 *  Twitter videos frequently have mismatched display dimensions:
 *  the tkhd (track header) box stores a display width/height that
 *  differs from the actual coded resolution, AND/OR a non-1:1 pasp
 *  (pixel aspect ratio) box. Both cause desktop players like VLC
 *  to stretch the video.
 *
 *  Strategy (two-pass, pure in-place metadata rewrite):
 *    Pass 1 — Find the coded resolution from the VisualSampleEntry
 *             (avc1, hev1, etc.) inside moov/trak/mdia/minf/stbl/stsd.
 *    Pass 2 — Patch tkhd width/height to match coded resolution,
 *             and set every pasp box to 1:1 (square pixels).
 *
 *  This never touches the actual video bitstream.
 * ──────────────────────────────────────────────────────── */

/* ── Helper: read a 4-char box type at a position ── */
function boxType(buf: Buffer, pos: number): string {
  return buf.subarray(pos + 4, pos + 8).toString('latin1')
}

/* ── Helper: read box size, handling extended (64-bit) sizes ── */
function boxSize(buf: Buffer, pos: number, end: number): number {
  let size = buf.readUInt32BE(pos)
  if (size === 1) {
    if (pos + 16 > end) return -1
    const hi = buf.readUInt32BE(pos + 8)
    if (hi !== 0) return -1 // >4 GB, skip
    size = buf.readUInt32BE(pos + 12)
  }
  if (size === 0) size = end - pos
  if (size < 8 || pos + size > end) return -1
  return size
}

/* ── Container box types that we recurse into ── */
const CONTAINERS = new Set([
  'moov', 'trak', 'mdia', 'minf', 'stbl',
  'udta', 'mvex', 'dinf', 'edts', 'meta',
])

/* ── Video codec sample entry types (VisualSampleEntry) ── */
const VIDEO_ENTRIES = new Set([
  'avc1', 'avc3', 'hvc1', 'hev1', 'mp4v',
  'dvh1', 'dvhe', 'av01', 'vp08', 'vp09',
])

/* ────────────────────────────────────────────────────────
 *  PASS 1: Find coded video dimensions
 *
 *  VisualSampleEntry layout (from box start):
 *    +0   size (4)
 *    +4   type (4) e.g. 'avc1'
 *    +8   reserved (6)
 *    +14  data_reference_index (2)
 *    +16  pre_defined (2)
 *    +18  reserved (2)
 *    +20  pre_defined (12)
 *    +32  width (2)   ← coded width
 *    +34  height (2)  ← coded height
 *    +36  horiz_resolution (4)
 *    +40  vert_resolution (4)
 *    +44  reserved (4)
 *    +48  frame_count (2)
 *    +50  compressor_name (32)
 *    +82  depth (2)
 *    +84  pre_defined (2)
 *    +86  start of sub-boxes (avcC, pasp, etc.)
 * ──────────────────────────────────────────────────────── */
function findCodedDimensions(
  buf: Buffer,
  start: number,
  end: number,
): { w: number; h: number } | null {
  let pos = start

  while (pos + 8 <= end) {
    const size = boxSize(buf, pos, end)
    if (size < 0) break
    const type = boxType(buf, pos)

    // Check if this is a video sample entry
    if (VIDEO_ENTRIES.has(type) && size >= 36) {
      const w = buf.readUInt16BE(pos + 32)
      const h = buf.readUInt16BE(pos + 34)
      if (w > 0 && h > 0) {
        return { w, h }
      }
    }

    // Recurse into containers
    if (CONTAINERS.has(type)) {
      const result = findCodedDimensions(buf, pos + 8, pos + size)
      if (result) return result
    }

    // stsd: skip 4-byte version+flags + 4-byte entry count
    if (type === 'stsd') {
      const result = findCodedDimensions(buf, pos + 16, pos + size)
      if (result) return result
    }

    pos += size
  }

  return null
}

/* ────────────────────────────────────────────────────────
 *  PASS 2: Patch tkhd and pasp boxes
 *
 *  tkhd v0 layout (from box start):
 *    +0   size (4)
 *    +4   'tkhd' (4)
 *    +8   version=0 (1) + flags (3)
 *    +12  creation_time (4)
 *    +16  modification_time (4)
 *    +20  track_id (4)
 *    +24  reserved (4)
 *    +28  duration (4)
 *    +32  reserved (8)
 *    +40  layer (2) + alternate_group (2)
 *    +44  volume (2) + reserved (2)
 *    +48  matrix (36 = 9 × int32)
 *    +84  width (4)  ← 16.16 fixed point
 *    +88  height (4) ← 16.16 fixed point
 *    Total: 92 bytes
 *
 *  tkhd v1: creation/modification times are 8 bytes each,
 *           duration is 8 bytes → shifts everything by +12
 *    +96  width (4)
 *    +100 height (4)
 *    Total: 104 bytes
 * ──────────────────────────────────────────────────────── */
function patchBoxes(
  buf: Buffer,
  start: number,
  end: number,
  codedW: number,
  codedH: number,
): void {
  let pos = start

  while (pos + 8 <= end) {
    const size = boxSize(buf, pos, end)
    if (size < 0) break
    const type = boxType(buf, pos)

    /* ── Patch tkhd: set display width/height to coded resolution ── */
    if (type === 'tkhd') {
      const version = buf.readUInt8(pos + 8)
      if (version === 0 && size >= 92) {
        // v0: width at +84, height at +88
        buf.writeUInt32BE((codedW << 16) >>> 0, pos + 84)
        buf.writeUInt32BE((codedH << 16) >>> 0, pos + 88)
      } else if (version === 1 && size >= 104) {
        // v1: width at +96, height at +100
        buf.writeUInt32BE((codedW << 16) >>> 0, pos + 96)
        buf.writeUInt32BE((codedH << 16) >>> 0, pos + 100)
      }
    }

    /* ── Patch pasp: force 1:1 (square pixels) ── */
    if (type === 'pasp' && size >= 16) {
      buf.writeUInt32BE(1, pos + 8)   // hSpacing = 1
      buf.writeUInt32BE(1, pos + 12)  // vSpacing = 1
    }

    /* ── Recurse into containers ── */
    if (CONTAINERS.has(type)) {
      patchBoxes(buf, pos + 8, pos + size, codedW, codedH)
    }

    if (type === 'stsd') {
      patchBoxes(buf, pos + 16, pos + size, codedW, codedH)
    }

    // Recurse into video sample entry sub-boxes (after the 78-byte fixed header)
    if (VIDEO_ENTRIES.has(type) && pos + 86 <= end) {
      patchBoxes(buf, pos + 86, pos + size, codedW, codedH)
    }

    pos += size
  }
}

/* ────────────────────────────────────────────────────────
 *  Top-level fix: process each trak independently
 *
 *  We process at the trak level so that we only patch tkhd
 *  for video tracks (those containing a VisualSampleEntry).
 *  Audio tracks are left untouched.
 * ──────────────────────────────────────────────────────── */
function fixMP4AspectRatio(buf: Buffer): boolean {
  let pos = 0
  const end = buf.length
  let patched = false

  // Walk top-level boxes to find moov
  while (pos + 8 <= end) {
    const size = boxSize(buf, pos, end)
    if (size < 0) break
    const type = boxType(buf, pos)

    if (type === 'moov') {
      // Walk inside moov to find each trak
      let trakPos = pos + 8
      while (trakPos + 8 <= pos + size) {
        const trakSize = boxSize(buf, trakPos, pos + size)
        if (trakSize < 0) break
        const trakType = boxType(buf, trakPos)

        if (trakType === 'trak') {
          // Check if this trak has a video sample entry
          const dims = findCodedDimensions(buf, trakPos + 8, trakPos + trakSize)
          if (dims) {
            // This is a video track — patch its tkhd and pasp boxes
            patchBoxes(buf, trakPos + 8, trakPos + trakSize, dims.w, dims.h)
            patched = true
            console.log(`[mp4-fix] Patched video track: coded=${dims.w}x${dims.h}`)
          }
        }

        trakPos += trakSize
      }
    }

    pos += size
  }

  return patched
}

/* ─── Fetch & Fix ───────────────────────────────────────── */
async function fetchAndFixVideo(
  videoUrl: string,
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

  // Fix aspect ratio: patch tkhd dimensions + pasp in video tracks
  const wasPatched = fixMP4AspectRatio(buffer)
  console.log(`[mp4-fix] Buffer size=${buffer.length}, patched=${wasPatched}`)

  return { buffer, contentType }
}

/* ─── Route Handler ─────────────────────────────────────── */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const videoUrl = searchParams.get('url')
  const quality = searchParams.get('quality') ?? 'video'

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
    const result = await fetchAndFixVideo(videoUrl)

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

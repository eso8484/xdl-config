import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

const ALLOWED_HOSTS = ['video.twimg.com', 'pbs.twimg.com', 'ton.twimg.com']

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ALLOWED_HOSTS.some(host => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const videoUrl = searchParams.get('url')
  const quality = searchParams.get('quality') ?? 'video'

  if (!videoUrl) {
    return new Response(JSON.stringify({ error: 'URL parameter is required' }), {
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

  try {
    const upstream = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        Referer: 'https://twitter.com/',
      },
    })

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch video from source' }), {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const safeQuality = quality.replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `twitter_video_${safeQuality}.mp4`

    const headers = new Headers({
      'Content-Type': upstream.headers.get('Content-Type') ?? 'video/mp4',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    })

    const contentLength = upstream.headers.get('Content-Length')
    if (contentLength) headers.set('Content-Length', contentLength)

    return new Response(upstream.body, { headers })
  } catch (err) {
    console.error('[download] error:', err)
    return new Response(JSON.stringify({ error: 'Download failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

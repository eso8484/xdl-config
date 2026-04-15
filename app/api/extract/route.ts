import { NextRequest, NextResponse } from 'next/server'

/* ─── Types ─────────────────────────────────────────────── */
interface RawVariant {
  url: string
  content_type: string
  bitrate?: number
}

interface ProcessedVariant {
  url: string
  quality: string
  bitrate: number
}

interface ExtractResponse {
  variants: ProcessedVariant[]
  thumbnail: string
  tweetId: string
  authorName: string
  authorHandle: string
}

/* ─── Helpers ───────────────────────────────────────────── */
/**
 * Extracts the tweet/post ID from various Twitter/X URL formats.
 */
function extractTweetId(input: string): string | null {
  const patterns = [
    /(?:twitter|x)\.com\/\w+\/status\/(\d+)/i,
    /^(\d{10,20})$/,
  ]
  for (const pattern of patterns) {
    const match = input.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

/**
 * Computes the token required for the Twitter syndication API.
 */
function getSyndicationToken(id: string): string {
  const n = Number(id) / 1e15
  return Math.floor(n * Math.PI).toString(36)
}

/**
 * Parses dimension string like "1280x720" → height string "720p".
 */
function dimensionToQuality(dim: string): string {
  const parts = dim.split('x')
  return parts.length === 2 ? `${parts[1]}p` : dim
}

/**
 * Post-processes raw variants into labelled, deduplicated list sorted best-first.
 */
function processVariants(raw: RawVariant[]): ProcessedVariant[] {
  return raw
    .filter(v => v.content_type === 'video/mp4' && v.url)
    .map(v => {
      const dimMatch = v.url.match(/\/(\d+x\d+)\//)
      const quality = dimMatch ? dimensionToQuality(dimMatch[1]) : `${Math.round((v.bitrate ?? 0) / 1000)}kbps`
      return { url: v.url, quality, bitrate: v.bitrate ?? 0 }
    })
    .sort((a, b) => b.bitrate - a.bitrate)
    .filter((v, i, arr) => arr.findIndex(x => x.quality === v.quality) === i) // dedupe
}

/* ─── Strategy 1: Twitter Syndication API ───────────────── */
async function extractViaSyndication(tweetId: string): Promise<ExtractResponse | null> {
  const token = getSyndicationToken(tweetId)
  const apiUrl = [
    `https://cdn.syndication.twimg.com/tweet-result`,
    `?id=${tweetId}`,
    `&lang=en`,
    `&token=${token}`,
    `&features=tfw_timeline_list%3A%3Btfw_follower_count_sunset%3Atrue`,
  ].join('')

  const res = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      Accept: 'application/json',
      Referer: 'https://platform.twitter.com/',
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json()
  const mediaDetails = data?.mediaDetails ?? []

  const videoMedia = mediaDetails.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m: any) => m?.type === 'video' || m?.type === 'animated_gif' || m?.video_info
  )

  if (!videoMedia?.video_info?.variants?.length) return null

  const variants = processVariants(videoMedia.video_info.variants as RawVariant[])
  if (!variants.length) return null

  return {
    variants,
    thumbnail: videoMedia.media_url_https ?? videoMedia.poster ?? '',
    tweetId,
    authorName: data?.user?.name ?? '',
    authorHandle: data?.user?.screen_name ?? '',
  }
}

/* ─── Strategy 2: Guest Token (Twitter API 1.1) ─────────── */
const BEARER =
  'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'

async function extractViaGuestToken(tweetId: string): Promise<ExtractResponse | null> {
  try {
    const gtRes = await fetch('https://api.twitter.com/1.1/guest/activate.json', {
      method: 'POST',
      headers: { Authorization: `Bearer ${BEARER}` },
    })
    if (!gtRes.ok) return null

    const { guest_token } = await gtRes.json() as { guest_token: string }
    if (!guest_token) return null

    const tweetRes = await fetch(
      `https://api.twitter.com/2/timeline/conversation/${tweetId}.json?tweet_mode=extended`,
      {
        headers: {
          Authorization: `Bearer ${BEARER}`,
          'x-guest-token': guest_token,
        },
      }
    )
    if (!tweetRes.ok) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tweetData: any = await tweetRes.json()
    const tweet = tweetData?.globalObjects?.tweets?.[tweetId]
    if (!tweet) return null

    const media = tweet?.extended_entities?.media?.[0]
    if (!media?.video_info?.variants?.length) return null

    const variants = processVariants(media.video_info.variants as RawVariant[])
    if (!variants.length) return null

    return {
      variants,
      thumbnail: media.media_url_https ?? '',
      tweetId,
      authorName: tweet?.user?.name ?? '',
      authorHandle: tweet?.user?.screen_name ?? '',
    }
  } catch {
    return null
  }
}

/* ─── Strategy 3: FxTwitter public API ─────────────────── */
async function extractViaFxTwitter(tweetId: string): Promise<ExtractResponse | null> {
  try {
    const res = await fetch(`https://api.fxtwitter.com/status/${tweetId}`, {
      headers: { 'User-Agent': 'XDL/1.0' },
    })
    if (!res.ok) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json()
    const tweet = data?.tweet
    if (!tweet) return null

    const media = tweet?.media
    const videos = media?.all?.filter((m: any) => m.type === 'video') ?? media?.videos ?? []
    if (!videos.length) return null

    const variants: ProcessedVariant[] = videos.map((v: any, i: number) => ({
      url: v.url,
      quality: v.height ? `${v.height}p` : `Quality ${i + 1}`,
      bitrate: 0,
    }))

    return {
      variants,
      thumbnail: videos[0]?.thumbnail_url ?? tweet?.thumbnail?.url ?? '',
      tweetId,
      authorName: tweet?.author?.name ?? '',
      authorHandle: tweet?.author?.screen_name ?? '',
    }
  } catch {
    return null
  }
}

/* ─── Route Handler ─────────────────────────────────────── */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { url?: string }
    const rawUrl = body?.url?.trim()

    if (!rawUrl) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const tweetId = extractTweetId(rawUrl)
    if (!tweetId) {
      return NextResponse.json(
        { error: 'Invalid URL. Please paste a twitter.com or x.com/status/… link.' },
        { status: 400 }
      )
    }

    /* Try each strategy in order, stop at first success */
    const result =
      (await extractViaSyndication(tweetId)) ??
      (await extractViaGuestToken(tweetId)) ??
      (await extractViaFxTwitter(tweetId))

    if (!result) {
      return NextResponse.json(
        { error: 'No video found in this tweet. Make sure the tweet contains a video.' },
        { status: 404 }
      )
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[extract] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

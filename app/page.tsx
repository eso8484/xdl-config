const heroImage = 'https://www.figma.com/api/mcp/asset/09f94a8e-9a98-462a-b79d-e53d1a1885a7'
const sectionOneImage = 'https://www.figma.com/api/mcp/asset/ca6f37a1-1d10-4f77-99d5-5a89d9e6d977'
const sectionTwoImage = 'https://www.figma.com/api/mcp/asset/87677944-3876-49ea-9efa-cfacc8b17997'
const sectionThreeImage = 'https://www.figma.com/api/mcp/asset/7be237b6-b395-46e2-8900-dab8d01dc9fc'
const cartIcon = 'https://www.figma.com/api/mcp/asset/ba8a5b94-e694-4ac2-bb70-b8e3cd959906'
const instagramIcon = 'https://www.figma.com/api/mcp/asset/e1a17616-3ab3-4133-9c7c-d5e77a24af2a'
const twitterIcon = 'https://www.figma.com/api/mcp/asset/3b10087e-4fb5-4d44-9d08-5383ce0b514e'
const arrowIcon = 'https://www.figma.com/api/mcp/asset/8b3f8111-59da-4aad-a7e0-14af3f87a343'

const navLinks = ['Equipment', 'About us', 'Blog']

const sections = [
  {
    number: '01',
    eyebrow: 'Get Started',
    title: 'What level of hiker are you?',
    body:
      'Determining what level of hiker you are can be an important tool when planning future hikes. This hiking level guide will help you plan hikes according to different hike ratings set by various websites like All Trails and Modern Hiker. What type of hiker are you - novice, moderate, advanced moderate, expert, or expert backpacker?',
    image: sectionOneImage,
    imageAlt: 'Hiker on a ridge with mountains behind them',
    reverse: false,
  },
  {
    number: '02',
    eyebrow: 'Hiking essentials',
    title: 'Picking the right Hiking Gear!',
    body:
      'The nice thing about beginning hiking is that you do not really need any special gear, you can probably get away with things you already have. Let us start with clothing. A typical mistake hiking beginners make is wearing jeans and regular clothes, which will get heavy and chafe when they get sweaty or wet.',
    image: sectionTwoImage,
    imageAlt: 'Hiker standing on a snowy mountain ledge',
    reverse: true,
  },
  {
    number: '03',
    eyebrow: 'Where you go is the key',
    title: 'Understand Your Map & Timing',
    body:
      'To start, print out the hiking guide and map. If it is raining, throw them in a zip-lock bag. Read over the guide, study the map, and have a good idea of what to expect. I like to know what my next landmark is as I hike. For example, I will read the guide and know that in a mile I make a right turn at the junction.',
    image: sectionThreeImage,
    imageAlt: 'Compass in hand overlooking a mountainous trail',
    reverse: false,
  },
]

function LogoMark() {
  return <span className="tracking-[0.22em]">MNTN</span>
}

function ArrowLink({ label }: { label: string }) {
  return (
    <a href="#" className="inline-flex items-center gap-3 text-[0.9rem] font-semibold text-[#fbd784] transition-transform duration-300 hover:translate-x-1">
      <span>{label}</span>
      <img src={arrowIcon} alt="" aria-hidden className="h-4 w-4 -rotate-90" />
    </a>
  )
}

function SectionBlock({
  number,
  eyebrow,
  title,
  body,
  image,
  imageAlt,
  reverse,
}: {
  number: string
  eyebrow: string
  title: string
  body: string
  image: string
  imageAlt: string
  reverse: boolean
}) {
  const textOrder = reverse ? 'lg:order-2' : 'lg:order-1'
  const imageOrder = reverse ? 'lg:order-1' : 'lg:order-2'

  return (
    <section className="relative">
      <div className="absolute left-0 top-0 select-none text-[clamp(5rem,12vw,15rem)] font-bold leading-none text-white/10">
        {number}
      </div>

      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className={`${textOrder} relative max-w-[40rem] pt-20 lg:pt-0`}>
          <div className="mb-7 flex items-center gap-6">
            <span className="h-px w-16 bg-[#fbd784]" />
            <span className="text-[0.72rem] font-black uppercase tracking-[0.38em] text-[#fbd784]">
              {eyebrow}
            </span>
          </div>

          <h2 className="max-w-[34rem] font-display text-[clamp(2.8rem,5vw,4.5rem)] leading-[0.95] text-white">
            {title}
          </h2>

          <p className="mt-7 max-w-[40rem] text-[0.95rem] leading-8 text-white/88 lg:text-[1.02rem]">
            {body}
          </p>

          <div className="mt-8">
            <ArrowLink label="read more" />
          </div>
        </div>

        <div className={`${imageOrder} relative justify-self-center lg:justify-self-end`}>
          <div className="relative aspect-[0.78] w-[min(100%,22rem)] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.35)] ring-1 ring-white/8 sm:w-[22rem] lg:w-[28rem]">
            <img src={image} alt={imageAlt} className="h-full w-full object-cover" />
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b1d26] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(11,29,38,0.15)_0%,rgba(11,29,38,0.82)_55%,#0b1d26_88%)]" />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-[78rem] opacity-95">
        <img src={heroImage} alt="" aria-hidden className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,29,38,0.18)_0%,rgba(11,29,38,0.3)_36%,rgba(11,29,38,0.96)_100%)]" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-[1600px] items-center justify-between px-6 py-8 sm:px-10 lg:px-20">
        <a href="#top" className="font-display text-2xl tracking-[0.28em] text-white">
          <LogoMark />
        </a>

        <nav className="hidden items-center gap-10 text-sm font-semibold text-white/90 md:flex">
          {navLinks.map((link) => (
            <a key={link} href="#" className="transition-colors hover:text-[#fbd784]">
              {link}
            </a>
          ))}
        </nav>

        <a href="#" className="inline-flex items-center gap-3 text-sm font-semibold text-white/95 transition-colors hover:text-[#fbd784]">
          <img src={cartIcon} alt="" aria-hidden className="h-5 w-5" />
          <span>Account</span>
        </a>
      </header>

      <aside className="pointer-events-none fixed left-6 top-1/2 z-10 hidden -translate-y-1/2 md:flex md:flex-col md:items-center md:gap-5 lg:left-10 xl:left-20">
        <span className="origin-center -rotate-90 text-sm font-semibold tracking-[0.28em] text-white">Follow us</span>
        <a href="#" className="pointer-events-auto transition-transform hover:scale-110">
          <img src={instagramIcon} alt="Instagram" className="h-6 w-6" />
        </a>
        <a href="#" className="pointer-events-auto transition-transform hover:scale-110">
          <img src={twitterIcon} alt="Twitter" className="h-6 w-6" />
        </a>
      </aside>

      <aside className="pointer-events-none fixed right-6 top-1/2 z-10 hidden -translate-y-1/2 items-start gap-5 lg:flex lg:right-10 xl:right-20">
        <div className="flex h-[15rem] flex-col items-end justify-between py-1 text-right text-sm font-semibold text-white">
          <span className="text-xs uppercase tracking-[0.35em] text-white/95">Start</span>
          <span>01</span>
          <span className="text-white/70">02</span>
          <span className="text-white/70">03</span>
        </div>
        <div className="relative h-[15rem] w-px bg-white/35">
          <div className="absolute top-0 h-[3.75rem] w-px bg-white" />
        </div>
      </aside>

      <div id="top" className="relative z-10 mx-auto min-h-[calc(100vh-7.5rem)] max-w-[1600px] px-6 pb-20 pt-12 sm:px-10 lg:px-20 lg:pb-28 lg:pt-20">
        <section className="max-w-[62rem] pt-16 sm:pt-24 lg:pt-28">
          <div className="mb-7 flex items-center gap-6">
            <span className="h-px w-16 bg-[#fbd784]" />
            <span className="text-[0.72rem] font-black uppercase tracking-[0.42em] text-[#fbd784]">
              A hiking guide
            </span>
          </div>

          <h1 className="max-w-[60rem] font-display text-[clamp(3.25rem,7vw,5.5rem)] leading-[0.92] text-white [text-wrap:balance]">
            Be Prepared For The Mountains And Beyond!
          </h1>

          <div className="mt-8">
            <ArrowLink label="scroll down" />
          </div>
        </section>
      </div>

      <div className="relative z-10 mx-auto max-w-[1600px] px-6 pb-24 sm:px-10 lg:px-20 lg:pb-32">
        <div className="space-y-28 lg:space-y-36">
          {sections.map((section) => (
            <SectionBlock key={section.number} {...section} />
          ))}
        </div>

        <footer className="mt-28 grid gap-14 border-t border-white/10 pt-16 lg:grid-cols-[1.15fr_.9fr_.8fr] lg:gap-10 lg:pt-20">
          <div>
            <a href="#top" className="font-display text-2xl tracking-[0.28em] text-white">
              <LogoMark />
            </a>
            <p className="mt-10 max-w-sm text-[1.02rem] leading-8 text-white/90">
              Get out there &amp; discover your next slope, mountain &amp; destination!
            </p>
            <p className="mt-14 text-sm text-white/40">
              Copyright 2023 MNTN, Inc. Terms &amp; Privacy
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-[#fbd784]">More on The Blog</h2>
            <ul className="mt-7 space-y-4 text-[1.02rem] leading-8 text-white/95">
              <li>About MNTN</li>
              <li>Contributors &amp; Writers</li>
              <li>Write For Us</li>
              <li>Contact Us</li>
              <li>Privacy Policy</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-[#fbd784]">More on MNTN</h2>
            <ul className="mt-7 space-y-4 text-[1.02rem] leading-8 text-white/95">
              <li>The Team</li>
              <li>Jobs</li>
              <li>Press</li>
            </ul>
          </div>
        </footer>
      </div>
    </main>
  )
}
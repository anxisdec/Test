# Cellula · The Life Science Field Guide

A zoology, botany, and environmental science learning site for **cellula.in**. This repository includes the website, editor, student progress, and the Guru Jee tutor integration. It has not been deployed or connected to your domain yet.

## Try it first

```sh
npm ci
npm run dev
```

Open the live preview, or `http://localhost:3000` on your own computer. No keys are needed. The preview includes sample field notes, an on-page YouTube player, guest bookmarks and reading/watching stats, and a two-message Guru Jee **practice mode** with built-in explanations. The preview is not a live AI service. Email sign-in and public publishing become available after connecting Supabase.

- **Field bag:** Bookmark an article or video, then use **Mark as read** or **Mark as watched**. With no account the data stays in this browser, not on Cellula’s server; clearing site data or switching browsers loses access to it. Signed-in students can sync across devices and may explicitly copy in their guest progress.
- **Editor studio:** Use **Editor studio** in the footer or open `/studio`. Preview changes are saved and displayed only in that browser. They aren't automatically transferred to the live database.
- **Reading themes:** The site follows the browser’s system theme until the student picks a theme. The selection stays on that device. Light uses warm ivory (`#F7F8F2`) with near-black forest text (`#202B23`); dark uses deep green-charcoal (`#151E18`) with off-white text (`#EDF0E6`). Leaf green and soft lime are accents, not paragraph text. Neither mode is universally better: light is a sensible starting point in a bright classroom, dark can be more comfortable in dim settings. Article body type is kept to a readable line length in either mode.
- **Device layouts:** One column on phones, a two-column article grid on tablets, three on desktop, and larger controls and keyboard focus at TV widths. Directional focus is enabled for TV-like browsers. Test the actual TV/browser models you intend to support; voice, camera, and embedded playback depend on the device.

## Recommended launch setup

| Responsibility | Service | What you need to do |
| --- | --- | --- |
| Domain registration | **Hostinger** | Keep `cellula.in` registered and renew it. No second web-hosting package is needed if you deploy to Vercel. |
| Source code | **Private GitHub repository** | Keep it private. Grant the Vercel Git integration access to just this repo. The website can be public even though the source stays private. |
| Site hosting, CDN, HTTPS | **Vercel** | Import the repo as a Next.js project (Node 22+). Use Hobby only for eligible personal, non-commercial use; choose a commercial plan before selling, or earlier if the site is already commercial. [3](https://vercel.com/docs/image-optimization/limits-and-pricing) |
| Accounts, posts, images, progress | **Supabase** | One service covers passwordless Auth, Postgres, and image Storage. Hostinger registering your domain does not configure these for the app. |
| Email links | **Transactional SMTP provider** | Configure custom SMTP in Supabase Auth and verify your sender/domain. The built-in email service is for testing, not public sign-in. [1](https://supabase.com/docs/guides/auth/auth-smtp) |
| Study assistant | **Your OpenAI-compatible provider** | Choose an HTTPS API base, key, and exact model ID. Set provider spending limits and verify a real request in staging. |

### 1. Connect Supabase

1. Create a project, then run [`supabase/schema.sql`](supabase/schema.sql) once in the SQL Editor. If you want the sample posts and videos, run [`supabase/seed.sql`](supabase/seed.sql) after it. Real library pages show the database catalog; without the optional seed or published entries they start empty.
2. In **Authentication → URL Configuration**, set the site URL to `https://cellula.in` and allow `https://cellula.in/auth/callback`. Allow `http://localhost:3000/auth/callback` for local development and add any specific staging callback URLs you actually use. Avoid broad wildcard allowlists for your production Auth project. Enable email sign-in. Configure custom SMTP and its sender verification records (SPF/DKIM; plan DMARC). Test both sign-in and sign-out with a normal student email.
3. Add the public Supabase URL and **publishable** key from [`.env.example`](.env.example) to Vercel. Set them in `.env.local` if you want to use a separate development database on your computer. Don't copy production secrets into a preview environment or into GitHub source files.
4. Sign in once with your own editor email. In the Supabase SQL Editor, grant only your account editing access; replace the sample address below with the email that already exists under Authentication → Users:

   ```sql
   insert into public.editor_accounts (user_id)
   select id from auth.users where email = 'your-editor-email@example.com'
   on conflict do nothing;
   ```

   Reload `/studio`. You can now write, preview, upload cover/inline images, save a draft, publish, edit, or unpublish. Published posts and image URLs are public; don't upload student documents, private study assets, or paid video to the public cover bucket. When adding a lesson, upload the video to YouTube separately and paste its link into Studio. Cellula derives the thumbnail and loads the embedded player only when clicked. If a video is private, age-restricted, or the owner blocks embeds, the **Open on YouTube** link is the fallback, and the video may still be subject to YouTube's restrictions.

### 2. Deploy and connect the domain

1. Import the private repo in Vercel. Add your settings under **Project → Settings → Environment Variables**, with separate values for Preview and Production. Deploy and test the Vercel address first.
2. Add `cellula.in` and optionally `www.cellula.in` in **Vercel → Domains**. Copy the exact DNS records Vercel shows to the provider currently authoritative for your DNS. That's Hostinger if you are still using its nameservers. Don't use guessed IPs or CNAME values, and don't remove unrelated email or verification records. Keep `cellula.in` as primary and redirect `www` to it. Verify HTTPS and test email sign-in on the final domain. [2](https://vercel.com/docs/domains/set-up-custom-domain)
3. **Cloudflare is optional.** You can use it for DNS; keep the records for Vercel **DNS only** and use Vercel's firewall/rate limits for web traffic. Vercel advises against an extra reverse proxy because it can degrade bot detection, caching, and performance. [1](https://vercel.com/docs/integrations/cloudflare) Cloudflare Turnstile is a separate option: create a widget for your allowed hostnames, put its *public* site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, and configure its *secret* in Supabase Auth's CAPTCHA settings. Redeploy and test sign-in after enabling both sides. This challenges sign-in, not readers or the chat endpoint.

### 3. Turn on live Guru Jee

- Set `AI_BASE_URL` to the provider's **API root** (e.g. `https://your-provider.example/v1`, without `/chat/completions`), `AI_API_KEY`, and `AI_MODEL`. Your endpoint must support non-streaming `POST /chat/completions`, bearer authentication, and a system message. Leave `AI_TOKEN_PARAMETER=max_tokens` or change it to `max_completion_tokens` if required by your provider. Test both a study question and an unrelated prompt.
- Add `SUPABASE_SERVICE_ROLE_KEY` (the server-only Supabase secret/service key) and a dedicated `CHAT_SIGNING_SECRET` (at least 32 characters; generate with `openssl rand -hex 32`). Do not add `NEXT_PUBLIC_` to the provider, service role, or signing secrets. Only the site URL, publishable database key, and optional Turnstile site key are public.
- Live chat won't switch on without the durable quota backend. Guest access is **two successful messages per signed browser identity**, not a lifetime identity check on a person. Clearing cookies can reset that identity; IP limits and the edge firewall help contain abuse. Signed-in students have no fixed two-message or lifetime cap, but still have rate limits and share a daily site budget (`CHAT_DAILY_REQUESTS`). Set a separate billing limit at your provider; timeouts and errored upstream calls can still cost money.
- Guru Jee is configured for life science study and redirects unrelated questions. Prompt controls are not a perfect filter; pilot with real students, test the model in the languages you support, and review unsuitable answers before expanding access. No provider works all the time. The request has a timeout and a clear failure state; articles and videos don't depend on the AI service.
- The animated tutor responds to answers and reactions. Optional camera mode only checks face **presence** on-device; it doesn't identify students, infer emotions, or transmit camera frames. Voice typing and read-aloud use browser features and may not be available everywhere. Tell students not to enter personal information. Before a public launch, write a privacy notice with your contact details, retention/deletion policies, model and video processors, and any student/minor consent requirements that apply. Consider leaving camera off for school rollouts.

## Before opening to a large audience

- Keep public content cacheable and user-specific pages/data private. The site caches public listings and revalidates them on publish; the YouTube player is click-to-load. Images uploaded in Studio are resized to WebP. The chat route has a bounded payload, timeout, per-IP/per-account rate limits, and an atomic database guest limit. These controls reduce risk; they don't guarantee that any traffic spike is survivable.
- Start with a small pilot. Load-test cached pages and the API separately, first with a fake model provider that matches the production protocol. Watch response time, error rate, Supabase connections and disk, CDN bandwidth, and AI spend. Set Vercel and provider alerts, a spending cap, a backup/restore plan, and uptime monitoring for the home page and sign-in. Configure Vercel Firewall for rates on `/api/chat`; plan for classrooms sharing one IP before tightening limits. Schedule cleanup of expired `guru_counters` rows (for example, nightly `delete from public.guru_counters where expires_at < now();` using Supabase Cron), and verify backups protect published text and image objects appropriately.
- When the catalog grows, move listing/search to paginated indexed queries (the initial public catalog is bounded to the latest 1,000 entries). If chat grows faster, move hot counters and optional request queuing to a shared rate-limit service with higher throughput. Keep reading independent of model capacity. Add an operations contact, policies, basic SEO checks, and analytics that don't collect more student data than needed.

## Selling courses later

Keep free posts public. Add `courses`, `modules`, `lessons`, `orders`, and `enrollments` to the same account database when you're ready. For India, evaluate Razorpay or another provider against your business eligibility, payment methods, tax, and settlement needs. Grant course access on the server **only after a verified payment webhook**, recorded idempotently, and check enrollment on every protected content request. Start with one paid course; add GST/invoicing, refund and support flows, and test sandbox checkout before accepting money. A private or unlisted YouTube link isn't access control for paying students; use a video host that supports signed, short-lived playback access for paid lessons. Checkout and courses aren't enabled in this starter.

## Checks

```sh
npm run typecheck
npm test
npm run build
# With the preview server running and no external services configured:
node tests/preview-smoke.mjs
```

Starter nature illustrations are AI-generated and are not source photographs. The Tiny Face Detector weights in `public/face-model` come from `@vladmandic/face-api`; its MIT license is included adjacent to the files.

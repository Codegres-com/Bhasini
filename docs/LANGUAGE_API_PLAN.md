# Bhasini Language API: strategy & plan

Status: **plan only, nothing built yet** · Date: 19 Oct 2026 · Owner: Codegres

Direction from the founder: **language typing stays open source; commercial use is monetized.**

---

## 1. Executive summary

Bhasini already has something most Indic AI startups don't: a **deterministic, millisecond-fast
transliteration and script engine for all 22 scheduled languages**, including the scripts the big
players neglect (Ol Chiki, Meetei Mayek, Perso-Arabic Kashmiri/Sindhi). Google deprecated its
Transliterate API in 2011 and has never shipped a supported replacement. That gap is the wedge.

The plan has three layers:

1. **Open core (free, OSS):** the typing engine, editor, Windows app and keyboard SDKs.
2. **Bhasini Cloud API (paid, serverless):** transliteration and script APIs at the edge first
   (near-zero cost, huge volume), then speech and translation APIs on serverless GPUs.
3. **Commercial licence + enterprise:** companies that embed the engine in a commercial product,
   or need on-prem/VPC, SLA or custom voices, pay.

Positioning: *"The Stripe of Indian languages: one API key, 22 languages, from keystroke to voice."*

---

## 2. Audit of bhasini.com (live, 19 Oct 2026)

| Area | Finding | Verdict |
|---|---|---|
| Product | Phonetic + InScript typing for 22 languages + English, script converter, browser dictation, .docx/.txt open & save, key map panel, native digits | Strong, unusually broad coverage |
| Desktop | Windows Electron app with **Global mode** (F9 types Indic in any app), Store packaging | Real differentiator vs web-only tools |
| Privacy | No accounts, analytics, ads or tracking; everything on-device | Good brand asset, keep it as a promise for the free tier |
| SEO meta | Title, description, keywords, canonical, OG/Twitter cards, JSON-LD `WebApplication`, PWA manifest | Well done |
| **Crawlability** | The HTML is a Blazor WASM shell. A crawler that doesn't run JS sees only the wordmark and the error text **"Something went wrong. Reload"** (confirmed with a non-JS fetch) | **Fix first.** It hurts SEO and link previews |
| **Sitemap** | Two URLs (home, privacy). No per-language pages | **Big miss.** "Hindi typing", "Kannada typing", "Tamil typing online", "Hindi typing test" are high-volume searches |
| Performance | ~53 requests, **~3.5 MB transferred / ~9.9 MB decoded** on first load (desktop 1.3 s) | Heavy on budget Android over 4G. Needs a lightweight landing shell |
| Hosting | GitHub Pages behind Cloudflare DNS, 10-minute cache | Fine for static use. No backend exists yet |
| Monetization | Razorpay sponsor badge in the README only. No pricing, developer page, sign-up or email capture | Nothing in place |
| Developers | No API, SDK, npm/NuGet package or docs site | Nothing in place |
| Mobile | PWA only. No Android/iOS keyboard | Gap: most Indic typing happens on phones |
| Measurement | No analytics at all, so no funnel data | Add **cookieless** analytics (Cloudflare Web Analytics or Plausible) and update the privacy page honestly |
| **Brand risk** | "Bhasini" is one letter away from the Government of India's **BHASHINI** mission (MeitY), which offers language APIs | Get a trademark opinion before launching an *API* under this name. Consider a distinct API brand, e.g. "Bhasini Cloud" or a sub-brand |
| Licence | Entire repo is **MIT**, so anyone can already use the engine commercially for free | Must change for future versions if commercial use is to be monetized (see §6) |

### Quick wins for the site (before any API)
1. Prerender, or ship static HTML landing pages, so crawlers see real content. Move the error div out of the initial markup.
2. Add `/hindi-typing`, `/kannada-typing`, … (22 pages) plus `/hindi-typing-test` and `/script-converter`, each with a native-script H1, an FAQ and the editor embedded.
3. Add `/developers` (waitlist + email capture) and `/pricing` (even "coming soon").
4. Lazy-load the WASM editor after first paint. Ship a tiny JS transliterator for the landing view.
5. Add cookieless analytics.

---

## 3. Market research: what language APIs are in demand

### 3.1 Global demand signals
- **Voice agents are the hottest category.** ElevenLabs reportedly passed USD 500M+ ARR. Retell (~USD 50M ARR) and Vapi (~USD 500M valuation) show the pull for STT → LLM → TTS pipelines. Low *time-to-first-audio* matters more than voice-library size.
- **TTS market** ≈ USD 4.4–5.7B (2026) at 12–22% CAGR. **STT API market** ≈ USD 5.1–5.6B (2026). Estimates vary widely by research firm.
- **AI dubbing/localization** ≈ USD 0.6–1.2B, ~14–30% CAGR, driven by creators. YouTube auto-dubbing reached 27 languages (May 2026).
- **Regulation:** EU AI Act transparency obligations (Aug 2026) and voice-cloning consent laws. Watermarking and consent records are now table stakes.

### 3.2 India demand signals
- Contact centres (BFSI, telecom, D2C, healthcare) are automating **vernacular voice**: loan enquiries in Tamil/Marathi, COD verification, NDR follow-ups. Hinglish/code-mixing is the core technical problem.
- BFSI alone is cited at 200M+ voice interactions a month (vendor-reported, unverified).
- Funding: Sarvam AI (market leader in Indic speech), Navana.ai (₹40 Cr Series A for BFSI voice).
- Government: Digital India, e-governance and court/legislature digitization create large demand for **legacy-font → Unicode conversion**, OCR and translation.

### 3.3 Competitor price benchmarks (list prices, verify before quoting)

| Capability | Sarvam AI (INR) | ElevenLabs (USD) | Others (USD) |
|---|---|---|---|
| Speech-to-text | ₹0.41–0.49 / min | Scribe (n/a) | AssemblyAI ~$0.0025/min · Deepgram ~$0.0077/min · Cloudflare Whisper **$0.00045/min** (cost floor) |
| Text-to-speech | ₹30 / 10K chars (Bulbul v3) · ₹20 / 10K (Flash) | $0.10 / 1K (Multilingual) · $0.05 / 1K (Flash) | Google, Azure, Polly (enterprise SSML) |
| Translation | ₹20 / 10K chars · documents ₹5 / 1K chars | n/a | Google, Azure |
| **Transliteration** | **₹20 / 10K chars** | n/a | Google: deprecated since 2011 |
| Voice changer / S2S | n/a | ~$0.12 / min | n/a |
| Dubbing | n/a | $0.33–0.50 / min | $0.10–10 / min range |
| Free/gov | **BHASHINI** (MeitY): ASR/TTS/NMT for 22 languages, free for non-commercial use, not production-grade per users | | |

Open models with commercial-friendly licences: **AI4Bharat IndicTrans2 (MIT)** for translation,
**IndicConformer** (reported MIT, *verify*) for ASR, and Indic TTS models (IndicF5, Indic Parler-TTS:
*check each licence before use*).

### 3.4 Every API we could offer, ranked

| # | API | Demand | Our edge | Infra | Phase |
|---|---|---|---|---|---|
| 1 | **Transliteration** (Roman → 22 scripts, phonetic & InScript, with suggestions) | High (forms, search, chat, CRMs) | Engine exists, deterministic, rare scripts | Edge CPU | **1** |
| 2 | **Reverse transliteration** (script → Roman/ISO-15919/ITRANS) | High (search indexing, SEO slugs, names on cards) | Small extension | Edge CPU | **1** |
| 3 | **Script conversion** (Devanagari ↔ Kannada ↔ Tamil …) | Medium (publishers, religious texts, education) | Exists | Edge CPU | **1** |
| 4 | **Legacy font → Unicode** (Nudi, Baraha, Kruti Dev, Shree-Lipi …) and back | High in gov/print, few good tools | Nudi heritage | Edge CPU | **1** |
| 5 | **Cross-script name matching** (is "Naveen" = "नवीन" = "ನವೀನ್"?) with score | High: KYC, dedupe, fraud, voter/beneficiary lists | Unique, creative | Edge CPU | **1–2** |
| 6 | **Indic text utilities**: normalize, syllabify (aksharas), number ↔ words, dates, collation/sort, language ID | Medium, sticky for developers | Easy | Edge CPU | **1** |
| 7 | **Embeddable typing widget** (one `<script>` → any input types Indic) | High (gov portals, e-com, edtech) | Engine exists, growth loop | CDN | **1** |
| 8 | **Speech-to-text** (batch + realtime streaming, code-mixed, diarization, SRT/VTT) | Very high | Compete on price/rare languages | Serverless GPU | **2** |
| 9 | **Text-to-speech** (streaming, SSML-lite, voices for 22 languages) | Very high (IVR, voice agents, edtech, accessibility) | Rare-language voices, output caching | Serverless GPU | **2** |
| 10 | **Translation** (text, documents .docx/PDF preserving layout) | Very high | IndicTrans2 + layout-preserving docs | Serverless GPU | **2** |
| 11 | **Indic spell-check & grammar** | High, almost no good APIs | Pairs naturally with typing | CPU/GPU | **2** |
| 12 | **Indic OCR** (print + handwriting, 22 scripts) | High in gov/archives | Pairs with legacy fonts | Serverless GPU | **3** |
| 13 | **Speech-to-speech translation** | Rising | Pipeline of 8 + 10 + 9 | GPU pipeline | **3** |
| 14 | **Dubbing** (video in → dubbed video/audio + subtitles) | Strong creator demand | Async pipeline on 13 | GPU + queue | **3** |
| 15 | **Voice agent socket** (STT → your LLM → TTS on one WebSocket, barge-in) | Hottest category | Bundle, Indic-tuned latency | Edge + GPU | **3** |
| 16 | **Custom/cloned voices** (consented, watermarked) | Enterprise/brands | Premium tier | GPU fine-tuning | **3** |
| 17 | **MCP server for AI agents** (transliterate, convert, name-match, TTS as tools) | New, fast-growing | First Indic MCP | Edge | **1** (cheap) |

---

## 4. Architecture: serverless, built for high volume

### 4.1 Principle: split work by cost profile
- **Deterministic text work** (rows 1–7, 17) is pure CPU, microseconds per call. Run it at the **edge**, where it can serve millions of requests a minute for almost nothing.
- **ML work** (rows 8–16) is GPU-bound. Run it on **serverless GPU** with scale-to-zero, a small warm pool for realtime traffic, and queues for batch.

### 4.2 Reference design

```
                 ┌─────────────────────────── Cloudflare (global edge) ────────────────────────────┐
 Client / SDK ──▶│ API Gateway Worker: auth (API key/JWT) · rate limit · quota · metering · routing │
                 │   ├── Text APIs (Worker + engine compiled to WASM): sub-10 ms, no origin call   │
                 │   ├── KV / D1: keys, plans, quotas      Durable Objects: per-key counters,       │
                 │   │                                     realtime WebSocket sessions              │
                 │   ├── R2: TTS audio cache (hash of text+voice), uploads, job outputs             │
                 │   ├── Queues: async jobs (batch STT, documents, dubbing) → webhooks              │
                 │   └── Analytics Engine: usage events → billing                                  │
                 └───────────────┬─────────────────────────────────────────────────────────────────┘
                                 │ signed internal calls
                 ┌───────────────▼────────────── Serverless GPU pool ──────────────────────────────┐
                 │ Modal / RunPod Serverless (scale-to-zero, per-second billing, warm min-workers)  │
                 │ ASR (IndicConformer/Whisper fine-tune) · TTS · IndicTrans2 · OCR · S2S           │
                 │ India-resident pool for enterprise: AWS ap-south-1 / IndiaAI-subsidised GPUs     │
                 └───────────────┬─────────────────────────────────────────────────────────────────┘
                                 │ fallback / overflow / languages we don't serve yet
                 ┌───────────────▼─────────────────────────────────────────────────────────────────┐
                 │ Provider router: Sarvam · BHASHINI · Cloudflare Workers AI (Whisper) · others    │
                 └─────────────────────────────────────────────────────────────────────────────────┘
 Billing: Razorpay (India, UPI/cards, already in use) + Stripe (international) · Usage → invoices
```

### 4.3 Key decisions
1. **Engine at the edge.** `Bhasini.Core` is plain C# with no web dependencies. Options: (a) compile to WASM with NativeAOT-LLVM/WASI for Workers; (b) port the engine to Rust or TypeScript, sharing the existing test suite as golden fixtures. **Recommended: (b)**, because the .NET WASM runtime is too heavy for Worker cold starts and bundle limits. Keep C# as the reference implementation and run both against the same fixtures in CI.
2. **Launch ML APIs with a router before owning GPUs.** Phase 2 starts by routing to Sarvam, BHASHINI and Workers AI behind *our* API, with our own metering and margin. Self-hosted models replace providers language by language once volume justifies a warm pool. This de-risks launch and gives instant coverage.
3. **Cache aggressively.** IVR prompts and app strings repeat constantly. A content-hash TTS cache in R2 turns repeated requests into near-free egress, and is a big margin lever.
4. **Async by default for heavy jobs.** Batch STT, documents and dubbing return a `job_id` and a webhook, so GPU bursts are absorbed by queues instead of timeouts.
5. **Realtime via Durable Objects + WebSocket.** One object per session keeps state for streaming STT/TTS and barge-in. Keep 1–N warm GPU workers per realtime model, sized from traffic.
6. **Scale safeguards.** Per-key token buckets, global concurrency caps per GPU model, circuit breakers with provider failover, idempotency keys, request-size limits, abuse detection on free tier.
7. **Compliance.** DPDP Act 2023: no training on customer data by default, configurable retention (0/7/30 days), India-only processing flag for enterprise, audit logs. Voice cloning: recorded consent, watermarking, abuse reporting.
8. **Observability.** OpenTelemetry traces gateway → GPU, per-language quality dashboards (WER/CER, MOS samples), public status page.

### 4.4 Why this holds under high traffic
- The text APIs never leave the edge, so they have no origin to overload and scale with Cloudflare's network.
- GPU work is decoupled by queues. Realtime has a warm floor, batch has elastic burst, and overflow goes to external providers.
- Costs follow usage: idle cost is close to zero except the realtime warm pool, which is only turned on once paying realtime customers exist.

---

## 5. Monetization

### 5.1 Pricing principles
- **Undercut on text APIs.** Our marginal cost is close to zero, so price transliteration well below Sarvam's ₹20/10K chars and use it as the land-grab product.
- **Match or slightly beat on speech.** Compete on rare-language quality, latency and support, not only price.
- **INR-first, UPI-friendly prepaid credits**, plus USD cards for international customers.

### 5.2 Proposed API price card (draft, to validate)

| API | Free tier / month | Pay-as-you-go | Notes |
|---|---|---|---|
| Transliteration / reverse / script convert | 1M chars | **₹5 / 10K chars** (¼ of Sarvam) | Volume discounts beyond 100M chars |
| Legacy font conversion | 100 pages | ₹0.50 / page or ₹5 / 10K chars | Gov bulk deals |
| Name matching | 10K checks | ₹0.05 / check | KYC packs |
| Text utilities, language ID | 1M chars | ₹2 / 10K chars | |
| Typing widget | ≤10K page-views, "Powered by Bhasini" badge | ₹999 / site / month without badge | Growth loop |
| Speech-to-text | 60 min | ₹0.40 / min batch · ₹0.60 / min realtime | Diarization +₹0.10 |
| Text-to-speech | 50K chars | ₹15–25 / 10K chars | Cached replays billed at 10% |
| Translation | 100K chars | ₹15 / 10K chars · documents ₹4 / 1K chars | |
| Speech-to-speech | 10 min | ₹2.5 / min | |
| Dubbing | 5 min | ₹15–30 / min | Lip-sync later as premium |
| Custom voice | n/a | ₹25K setup + usage | Consent required |

### 5.3 Plans
| Plan | Price | For |
|---|---|---|
| Free | ₹0 | Hobbyists, students, OSS projects |
| Developer | ₹999 / month (₹1,200 credits) | Indie apps |
| Startup | ₹9,999 / month (₹12,500 credits, higher rate limits, email support) | Funded startups |
| Business | ₹49,999 / month (SLA 99.9%, webhooks, priority GPUs) | Contact centres, e-com |
| Enterprise | Custom (VPC/on-prem, India-only, custom voices, 99.95% SLA, DPA) | Banks, telecom, government |

### 5.4 All revenue streams
1. **Usage-based API** (core revenue).
2. **Commercial licence for the OSS engine** (see §6): OEMs, phone makers, keyboard apps, newspapers, publishing and CMS vendors embedding the engine offline. Annual per-product licence, e.g. ₹1–10 L/year by company size.
3. **Enterprise on-prem/VPC** for BFSI and government (data residency), plus support and SLA contracts.
4. **Bhasini Pro (prosumer)** at ₹99/month or ₹799/year: server-quality voice typing, read-aloud, translate, spell-check, cloud sync, Global mode on Mac. The free editor stays free.
5. **Typing tests & certification**: Hindi and regional typing tests for SSC, state PSC, court and clerk exams (huge search volume). Freemium practice plus paid mock tests and certificates.
6. **Marketplaces & plugins**: RapidAPI, AWS/Azure Marketplace, GeM (government e-Marketplace), WordPress, Shopify (store localisation), Chrome extension, MS Office add-in, Google Docs add-on, Figma, Zapier/n8n nodes.
7. **Government projects**: legacy digitization, transliteration of land records and voter lists, accessibility. Bid via GeM or partner with system integrators.
8. **Grants & ecosystem**: IndiaAI Mission (compute subsidies), BHASHINI ecosystem partnership (become a *contributor*, not a competitor), CSR and foundation grants for low-resource languages (Santali, Bodo, Dogri, Manipuri, Kashmiri).
9. **Sponsorship** (existing Razorpay/GitHub Sponsors) for the OSS core.

What we will **not** do: sell or train on user typing data, or show ads in the editor. The privacy promise is part of the brand.

---

## 6. Open source vs commercial: licensing plan

**The issue:** everything is MIT today. MIT lets any company use, embed and resell the engine with no
obligation, so commercial use cannot be monetized under MIT alone. Code already released as MIT stays
MIT forever, so any change only covers future versions.

**Options**

| Model | How it works | Pros | Cons |
|---|---|---|---|
| **A. Dual licence: AGPL-3.0 + commercial** *(recommended)* | Future engine/SDK releases under AGPL. Companies that won't open their own source buy a commercial licence | Proven (Qt, MongoDB's old model, iText). Individuals and OSS stay free. Forces commercial embedders to pay | Some companies avoid AGPL entirely, which is the point, but it can slow adoption |
| B. Open core | Engine stays MIT; monetize only the hosted API, enterprise features, SLA | Maximum adoption | No revenue from offline embedding |
| C. Source-available (FSL/BSL) | Free for non-commercial use, converts to OSS after 2–4 years | Clear "commercial = pay" message | Not OSI "open source", which may conflict with the OSS goal |

**Recommendation:** **A for the engine and SDKs, B for the apps.** The editor web app and Windows app
stay free to use. The `Bhasini.Core` engine, mobile keyboard SDK and JS widget move to
**AGPL-3.0 + commercial licence** from the next major version. The hosted API is a paid service by definition.

Prerequisites:
- Codegres must hold copyright on all code. Add a **CLA** (or DCO plus copyright assignment) for outside contributors before relicensing.
- Write a short `LICENSING.md` FAQ: "Personal, educational and open-source use: free. Commercial product: buy a licence or use the API."
- Register trademarks and protect the brand (see the brand-risk note in §2).

### 6.1 Devil's advocate: is open-sourcing the wrong idea?

**The case against open-sourcing**
- **You may be giving away the only finished asset.** Today the engine *is* the product. Sarvam, BHASHINI or a well-funded keyboard app could take the per-language rules (Tamil ந/ன context, Malayalam chillus, Meetei Mayek lonsum, Ol Chiki) that took real effort, and ship them with more distribution than you have.
- **Commercial licences are hard to enforce.** A small Indian company embedding AGPL code in a closed app will rarely be caught, and suing costs more than the licence. In practice dual licensing only pays when buyers are large firms with legal teams: OEMs, banks, telecoms, big publishers.
- **AGPL friction.** Many companies ban AGPL outright, so they won't even evaluate you. Some of those would have paid for an API.
- **Support and community cost time.** Issues, PRs and forks compete with building the API.
- **The MIT code is already out.** Anyone can fork today's version forever, so a relicense protects only future work.

**The case for**
- **Rule-based transliteration is not a secret.** Aksharamukha, indic-transliteration and AI4Bharat libraries are already open. Closing your engine doesn't stop a competitor, it only makes you one more closed option.
- **Trust sells to government and enterprise.** Auditable code, verifiable privacy ("nothing leaves the device") and no lock-in are why agencies and banks can buy from a small vendor.
- **Distribution.** OSS gets you GitHub stars, embeds, backlinks and developers who later pay for the hosted API. The free product is the marketing budget.
- **Rare-language contributors.** Native Santali, Bodo, Dogri and Kashmiri speakers improving the rules is a quality moat no closed competitor can buy.
- **You compete with free.** BHASHINI is free for non-commercial use, so a closed paid typing engine would struggle anyway.

**Verdict: open-source the typing, not the business.**
The engine is the bait, not the moat. Open it, but keep these **closed and paid** from day one:

| Keep open (free) | Keep closed (paid) |
|---|---|
| Phonetic + InScript engine, keyboard layouts | API gateway, metering, billing |
| Editor web app, Windows app | Legacy-font conversion tables (Nudi, Baraha, Kruti Dev, Shree-Lipi…) |
| Basic script converter | Cross-script name matching + scoring models |
| JS widget (with badge) | Spell-check/grammar dictionaries and models |
| | Fine-tuned ASR/TTS models, custom voices |
| | Enterprise features: SSO, audit logs, on-prem installer |

On licensing, this split also makes the AGPL question less important. If the money comes from the
API and the closed modules, **leaving the core MIT (Option B) is a reasonable alternative** to AGPL.
You keep maximum adoption and lose only offline-embedding licences, which are hard to enforce
against small companies anyway. Choose AGPL only if you plan to sell to OEMs, phone makers or
large publishers who will pay for compliance.

**When open-sourcing *would* be wrong:** if you decide not to build the API and closed modules at
all. Then the engine is the whole business, and you should keep future versions closed or
source-available.

---

## 7. Creative growth ideas

- **"Powered by Bhasini" widget loop:** every government portal or e-com checkout that embeds the free widget is a backlink and a lead.
- **First Indic MCP server:** LLMs are unreliable at exact transliteration in rare scripts (Ol Chiki, Meetei Mayek). Ship an MCP server so Claude, ChatGPT and agent builders call Bhasini as a tool. Cheap to build and very visible.
- **Cross-script KYC name match:** a focused B2B product for fintechs ("one person, 22 spellings").
- **Indic search booster:** query expansion for e-commerce ("chappal", "चप्पल", "ಚಪ್ಪಲಿ" all hit the same products).
- **Low-resource-language champion:** the best Santali, Bodo, Dogri and Manipuri voices and keyboards. Good for grants and PR, and big players won't prioritise them.
- **Typing-exam funnel:** an SEO magnet with clear paid intent.
- **Type-to-Voice:** type in Roman, hear it in a native voice (a viral demo for social media).
- **Creator dubbing for Shorts/Reels:** Hindi ↔ Tamil/Telugu/Bengali with a free first minute.
- **Android keyboard (Gboard alternative)** with the Global-mode experience. Privacy-first, works offline.
- **Open benchmarks:** publish per-language WER/CER leaderboards against Sarvam, BHASHINI and Google. Builds credibility with developers.

---

## 8. Phased roadmap (indicative)

| Phase | Weeks | Deliverables | Exit metric |
|---|---|---|---|
| **0. Foundations** | 1–4 | Site SEO fixes + 22 language pages, analytics, `/developers` waitlist, licence/CLA decision, trademark check, engine port to TS/Rust with shared fixtures | 1K waitlist sign-ups; crawlable pages indexed |
| **1. Text API GA** | 5–12 | Edge gateway, keys, metering, Razorpay/Stripe billing, transliteration/reverse/script/legacy-font/utils APIs, JS widget, npm/NuGet/Python SDKs, docs site, MCP server, RapidAPI listing | 100 active keys, first 10 paying customers |
| **2. Speech & translation** | 13–26 | Provider router (Sarvam/BHASHINI/Workers AI), STT batch + realtime, TTS with cache, translation + documents, spell-check beta, self-host the first models (IndicTrans2, ASR) on serverless GPU | ₹5 L MRR; gross margin >50% |
| **3. Premium & enterprise** | 27–52 | Speech-to-speech, dubbing, voice-agent socket, custom voices, OCR, India-resident enterprise tier, SOC 2 / ISO 27001 prep, GeM listing, Android keyboard | ₹25 L MRR; 3 enterprise logos |

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Name confusion with government BHASHINI | Trademark opinion now; distinct API sub-brand if needed; frame as an ecosystem partner |
| Sarvam/Google price war on speech | Lead with text APIs where our cost is near zero; differentiate on rare languages and developer experience |
| GPU cost spikes / cold starts | Router fallback, queues, warm pools only for paid realtime, TTS caching |
| Model licence surprises | Licence review per model before production (IndicF5, Parler-TTS, etc.) |
| MIT forks of the current engine | Accept it; the moat is the API, quality, rare scripts and support, not the code alone |
| Voice misuse / deepfakes | Consent capture, watermarking, abuse policy, KYC for cloning |
| Data protection (DPDP) | Zero-retention option, India-only processing, DPA templates, no training on customer data |

---

## 10. Open decisions for the founder
1. Licence model: AGPL + commercial, or keep MIT core with closed paid modules (see §6.1 — both viable; depends on whether you will chase OEM licences)?
2. API brand: keep "Bhasini" or use a sub-brand after the trademark check?
3. Engine port target for the edge: TypeScript (faster to ship) or Rust (faster runtime)?
4. GPU strategy for Phase 2: router-first (recommended) or self-host from day one?
5. First vertical to sell into: BFSI/KYC, e-commerce, government, or creators?

---

## 11. Project resources

| Resource | Link | Status (checked 19 Oct 2026) |
|---|---|---|
| Indic MCP server | `src/Bhasini.Mcp`, `plugins/bhasini`, [bhasini.com/mcp/](https://bhasini.com/mcp/), guide in [MCP_GUIDE.md](MCP_GUIDE.md) | Built and tested locally (stdio, C#). Not yet on NuGet, the MCP Registry, or the Claude/OpenAI directories |
| Remote MCP server (Cloudflare Worker) | `workers/bhasini-mcp/` → `https://mcp.bhasini.com/mcp`, CI in `.github/workflows/mcp-worker.yml` | TypeScript port of `Bhasini.Core`, verified against ~52,000 C# cases; tested with `wrangler dev` and MCP Inspector. Not deployed yet (needs `wrangler login` or the `CLOUDFLARE_API_TOKEN` secret). Same Worker is the natural home for the Transliteration API in §12 |
| Postman public workspace "Bhasini" | [postman.com/aviation-saganist-14360764/bhasini](https://www.postman.com/aviation-saganist-14360764/bhasini/overview) | Created 6 Oct 2026 (by Shweta) from Postman's default "API demos" template. No collections, environments, APIs or specs yet |

**Planned use of the Postman workspace** (once the API exists):
- A **reference collection** per API (Transliteration, Script conversion, Legacy fonts, Name match, Speech, Translation), generated from the OpenAPI spec so it never drifts.
- **Blueprint collections** for real use cases: "Transliterate a signup form", "KYC name match", "IVR prompt TTS with caching".
- **Environments** for `local`, `staging` and `prod` with `{{baseUrl}}` and `{{apiKey}}` variables and no real keys committed. The workspace README already warns about this.
- Publish to the **Postman API Network** as a discovery channel next to RapidAPI (see §5.4).
- Replace the template README with Bhasini-specific getting-started text.

---

## 12. Transliteration API on the current backendless setup (recommendation)

**Today:** bhasini.com is static (GitHub Pages), DNS is already on **Cloudflare**, and there is no
server. The engine (`Bhasini.Core`) is plain C# with no dependencies and runs in microseconds per word.

### Options

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. Cloudflare Workers + TypeScript port** *(recommended)* | Port `Bhasini.Core` to TypeScript and deploy at `api.bhasini.com` on the Cloudflare account that already serves DNS | No cold starts, 300+ PoPs incl. India, no servers, very cheap per request, KV/D1/Rate-Limiting/Analytics Engine built in, same JS package doubles as the npm SDK and the embeddable widget | One-time port; two implementations to keep identical |
| B. AWS Lambda / Azure Functions running .NET 8 (NativeAOT) | Wrap `Bhasini.Core` in a function behind API Gateway, Cloudflare in front | **Zero rewrite**, ships in days | Regional (not edge), cold starts (~100–300 ms with AOT), API Gateway costs more per request than Workers, separate cloud account to run |
| C. Workers running the C# engine as WASM | Compile .NET to WASM/WASI | One codebase | .NET WASM runtime is several MB (near or over Worker size limits) and slow to start; WASI support for .NET is still experimental. **Not recommended** |
| D. Client-only SDK | Publish the engine to npm/NuGet, no API | Free, offline | Nothing to meter, so no revenue. Good as the OSS layer, not as the product |

**Recommendation:** use **A** for the product, with **B as an optional one-week prototype** if you
want paying pilots before the port is done. Keep C# as the reference implementation (it powers the
editor, the Windows Global mode and the site generator).

### Keeping two engines identical
Generate a **golden fixture corpus** from the C# engine: every keymap entry, the InScript layout, the
example words, plus a large word list per language, written as JSON. This is the same approach as
`tools/Bhasini.SiteGen`. The TypeScript port must reproduce every fixture exactly in CI. Any engine
change regenerates the fixtures, so the two can't drift.

### Shape of the Worker

```
api.bhasini.com  (Cloudflare Worker, TypeScript)
  ├─ auth:      x-api-key → KV lookup (plan, quota); anonymous = tiny per-IP allowance
  ├─ limits:    Workers Rate Limiting binding per key + per IP; body ≤ 64 KB
  ├─ engine:    pure function, no I/O, sub-millisecond CPU per request
  ├─ cache:     Cache API for GET /v1/transliterate?text=…&lang=… (identical inputs are free)
  ├─ metering:  Analytics Engine event per call (key, endpoint, chars) → nightly rollup to D1
  └─ billing:   D1 usage → Razorpay (INR, UPI) / Stripe (USD) invoices or prepaid credits
```

### First endpoints (v1)

| Method & path | Body / query | Returns |
|---|---|---|
| `GET /v1/languages` | none | Codes, names, scripts, which methods each supports |
| `POST /v1/transliterate` | `{ "text": "namaste", "lang": "hi", "method": "phonetic" }` | `{ "text": "नमस्ते", "chars": 7 }` |
| `POST /v1/transliterate/batch` | `{ "lang": "ta", "items": ["vaNakkam", "nanRi"] }` (≤ 1,000) | `{ "items": ["வணக்கம்", "நன்றி"] }` |
| `POST /v1/convert` | `{ "text": "नमस्ते", "to": "kn" }` | `{ "text": "ನಮಸ್ತೇ" }` |
| `POST /v1/romanize` *(new engine work)* | `{ "text": "नमस्ते", "scheme": "iso15919" }` | `{ "text": "namastē" }` |
| `GET /v1/transliterate/suggest` *(later, needs word lists)* | `?q=namas&lang=hi` | Ranked candidates |

Errors use one JSON shape (`{ "error": { "code", "message" } }`) and standard status codes
(400, 401, 413, 429 with `Retry-After`). Version in the path (`/v1`).

### Cost at scale (approximate, from Cloudflare's published Workers Paid pricing; verify before committing)
Workers Paid is about **$5/month including 10M requests**, then about **$0.30 per extra million**
requests, with CPU billed per millisecond. Transliteration uses well under 1 ms CPU per request, so
**100M requests/month cost roughly $35–40**. At the draft price of ₹5 per 10K characters, gross
margin on text APIs is above 95%.

### Developer experience
- An OpenAPI 3.1 spec as the source of truth. Generate the docs site, SDKs (TypeScript, Python, C#) and the **Postman collection** in the [Bhasini workspace](https://www.postman.com/aviation-saganist-14360764/bhasini/overview) from it.
- A `/developers` page on bhasini.com with a live playground that calls the API, and a key sign-up flow.
- Status page and changelog.

### Build order
1. Fixture exporter (C#) + TypeScript port passing all fixtures.
2. Worker with `/v1/languages`, `/v1/transliterate`, `/v1/convert` and anonymous rate limits. Free beta.
3. API keys (KV), metering (Analytics Engine → D1), dashboard on bhasini.com.
4. Razorpay/Stripe billing, plans from §5.3.
5. `/v1/romanize`, batch, OpenAPI → Postman, RapidAPI listing, MCP server.

---

### Sources
- Sarvam pricing: [sarvam.ai/api-pricing](https://www.sarvam.ai/api-pricing), [docs.sarvam.ai pricing](https://docs.sarvam.ai/api/getting-started/pricing), [Sarvam TTS](https://www.sarvam.ai/text-to-speech)
- ElevenLabs pricing: [puter.com breakdown](https://developer.puter.com/tutorials/elevenlabs-api-pricing/), [happyrobot.ai](https://www.happyrobot.ai/hub/elevenlabs-pricing)
- STT pricing: [costbench AssemblyAI vs Deepgram](https://costbench.com/compare/assemblyai-vs-deepgram), [gladia on AssemblyAI](https://gladia.io/blog/assemblyai-pricing)
- Market size: [GMI TTS](https://www.gminsights.com/industry-analysis/text-to-speech-market), [Mordor TTS](https://www.mordorintelligence.com/industry-reports/text-to-speech-market), [Grand View STT API](https://www.grandviewresearch.com/industry-analysis/speech-to-text-api-market-report), [Fortune STT API](https://www.fortunebusinessinsights.com/speech-to-text-api-market-102781), [Voice AI market](https://voiceaiwrapper.com/insights/voice-ai-market-analysis-trends-growth-opportunities), [AssemblyAI top TTS APIs](https://www.assemblyai.com/blog/top-text-to-speech-apis)
- Dubbing: [Astute Analytica](https://www.astuteanalytica.com/industry-report/ai-dubbing-and-localization-market), [Vitrina](https://vitrina.ai/?p=141197), [3Play for YouTube](https://www.broadcastbeat.com/news/3play-media-launches-ai-dubbing-solution-for-youtube-creators)
- India voice demand: [Exotel](https://exotel.com/newsroom/voice-ai-could-bridge-the-gap-between-indias-ai-haves-and-have-nots/), [Ozonetel](https://ozonetel.com/best-voicebot-platforms/), [CallMissed BFSI](https://www.callmissed.com/blog/ai-in-indian-bfsi-the-vernacular-voice-opportunity), [Navana.ai Series A](https://india.entrepreneur.com/?p=99422), [Caller.Digital open-source Indic voice](https://caller.digital/blog/open-source-voice-ai-india-sarvam-ai4bharat-bhasini-2026)
- Open models: [AIKosh IndicTrans2](https://aikosh.indiaai.gov.in/home/models/details/indic_trans2.html), [AI4Bharat NMT](https://ai4bharat.iitm.ac.in/areas/nmt)
- Google Transliterate deprecation: [developers.google.com/transliterate](https://developers.google.com/transliterate)
- Serverless GPU: [Modal guide](https://modal.com/resources/best-serverless-gpu-platforms-inference), [PremAI comparison](https://blog.premai.io/serverless-llm-deployment-runpod-vs-modal-vs-lambda-2026), [costbench Modal vs RunPod](https://www.costbench.com/compare/modal-vs-runpod/), [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing)

*Market figures and competitor prices come from third-party and vendor sources that often disagree. Verify on official pages before using them externally.*

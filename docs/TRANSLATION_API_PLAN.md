# Bhasini Translation API: monetization plan

Status: **plan + v1 build in progress** · Date: 21 Oct 2026 · Owner: Codegres ·
Parent doc: [LANGUAGE_API_PLAN.md](LANGUAGE_API_PLAN.md) (row 10, §5)

Goal: turn text translation between English and the 22 scheduled languages (and between any two of
them) into a paid API, while the bhasini.com editor, the Windows app and casual MCP use stay free.

---

## 1. What we sell

| Direction | Engine (all hosted on Cloudflare Workers AI, nothing to run ourselves) |
|---|---|
| English → 22 Indic | **AI4Bharat IndicTrans2** `@cf/ai4bharat/indictrans2-en-indic-1B` (MIT) |
| 22 Indic → English | **Gemma 4 26B** `@cf/google/gemma-4-26b-a4b-it`, prompted as a translator |
| Indic ↔ Indic | Pivot: Gemma (→ English), then IndicTrans2 (→ target) |

Why this split (tested 21 Oct 2026 from our Cloudflare account):
- IndicTrans2 on Workers AI handles every target, including Santali (Ol Chiki), Kashmiri (Perso-Arabic),
  Manipuri (Meetei Mayek), Bodo and Dogri. It is **English → Indic only**: Hindi or Kannada input
  comes back as garbled Devanagari.
- For Indic → English, Gemma 4 got rare languages right (Santali, Meetei Mayek, Bodo) where
  Llama 4 Scout got them wrong. gpt-oss-120b spent its whole token budget on reasoning and returned no
  translation.
- Pivoting through English is also what AI4Bharat uses to evaluate its own Indic-Indic models. It keeps
  IndicTrans2, which is strongest on rare scripts, as the model that writes every Indic output.

Later: once traffic justifies a warm GPU, self-host the IndicTrans2 *indic-en* and *indic-indic* models
for direct (non-pivot) translation and replace Gemma.

---

## 2. Unit economics

Workers AI prices (Oct 2026): IndicTrans2 $0.342 / M tokens in and out; Gemma 4 26B $0.10 in,
$0.30 out / M tokens; 10,000 neurons a day free (about 3 lakh characters). Measured: about 2.4
characters per token for English, 2.2 for Indic output (worst case 1). Rates assume ₹88/USD.

At ₹5 per 10K, net receipts are ₹4.12 per 10K after 18% GST (if registered) and Razorpay's 2.36%.

| Direction | Our cost / 10K source chars | Net price | Gross margin |
|---|---|---|---|
| English → Indic | ₹0.28–0.46 | ₹4.12 | 89–93% |
| Indic → English | ≈ ₹0.11 | ₹4.12 | ≈ 97% |
| Indic ↔ Indic (pivot) | ₹0.34–0.48 | ₹4.12 | 88–92% |
| Typical mix | ≈ ₹0.33 | ₹4.12 | ≈ 92% |

**Fixed costs (monthly).** Only one is unavoidable:

| Item | ₹/month | Notes |
|---|---|---|
| Cloudflare Workers Paid | 440 | USD 5. Includes the Worker, D1, Durable Objects and rate limiting at our volumes |
| Free translation without a key | 0–300 | `FREE_DAILY_CHARS_GLOBAL` = 3 lakh/day (set 22 Oct 2026), which the Workers AI free allowance mostly covers. Worst case was ≈ 2,970 at the earlier 30 lakh/day |
| Sign-up trial credits | ≈ 0.33 per sign-up | `SIGNUP_FREE_CHARS` = 10,000 (set 22 Oct 2026; was 20,000) |
| Domain, GitHub Pages, Razorpay account | 0 | Already paid, free, or per-transaction only |

**Break-even.** Credits are prepaid, so cash flow is positive from the first sale. A ₹500 pack
(10 lakh characters) leaves ≈ ₹412 after GST and fees, and costs at most ≈ ₹33 in Workers AI if
fully used, so it earns ≈ ₹379. With the current limits (3 lakh free characters a day, 10,000
trial characters per account) the worst-case fixed cost is ≈ ₹1,070 a month (₹440 Workers plan,
≈ ₹300 free translation, ≈ ₹330 for 1,000 sign-ups), so **3 Starter packs a month break even**.
Two cover the Workers plan alone. The earlier limits (30 lakh a day, 20,000 trial) needed about 11.

---

## 3. Pricing

Market (per 10K characters): Sarvam ₹20 · Google Cloud Translation ≈ ₹17 (USD 20/M) ·
Azure ≈ ₹9 (USD 10/M). None of them covers all 22 languages with the same quality on Santali,
Bodo, Dogri or Kashmiri.

**Price: ₹5 / 10K characters** (decided 22 Oct 2026), a quarter of Sarvam's price and about a
third of Google's, with a margin near 90%. It replaces the ₹10 recommendation and the ₹15 draft in
the parent plan §5.2. ₹1 / 10K was considered: it still has a positive margin (≈ 60%) but leaves
little room for a Workers AI price change; keep it for large enterprise commitments or self-hosted
models.

| Pack (prepaid, `src/billing.ts`) | Price | Characters | Effective / 10K |
|---|---|---|---|
| Free trial (new account) | ₹0 | 10,000 | — |
| Starter | ₹500 | 10,00,000 | ₹5.00 |
| Growth (+10%) | ₹2,000 | 44,00,000 | ₹4.55 |
| Scale (+20%) | ₹5,000 | 1,20,00,000 | ₹4.17 |
| Enterprise | Custom | Volume, glossary, SLA 99.9%, DPA, India-only processing | Custom |

| Access | Limits |
|---|---|
| **Anonymous** (web, Windows, MCP without a key) | 2K chars per request, 5 req/min, 10K chars / day per IP, 3 lakh chars / day across all free users |
| **API key** | 5K chars per request, 300 req/min, until credits run out |

Notes:
- Bill on **source characters** (what the customer controls), counted as Unicode code points.
- Credits are valid for 12 months (terms.html; not yet enforced in code). Prepaid UPI top-ups avoid failed card mandates (RBI e-mandate rules).
- **Bhasini Pro** (₹99/month, parent plan §5.4) includes 500K chars/month of translation in the editor.

---

## 4. Packaging and add-ons (Phase 2+)

| Add-on | Price | Notes |
|---|---|---|
| Document translation (.docx, .txt, later PDF) | ₹4 / 1K chars | Uses our existing .docx support; layout kept |
| Glossary / do-not-translate terms | Growth and above | Brand names and legal terms; applied before and after translation |
| Batch async jobs + webhook | Included | For CMS backfills; uses Cloudflare Queues |
| Transliterate + translate combo | Same price | e.g. romanised Hindi in, Tamil out: transliterate first, then translate. Only Bhasini can do this |
| Cached repeats | 10% of price | Content-hash cache in KV/R2; app strings repeat a lot |

---

## 5. Billing infrastructure (all on Cloudflare, matching the MCP Worker)

```
client ──► mcp.bhasini.com/v1/translate  (Worker)
              │ 1. auth: Bearer bk_live_… → D1 `api_keys` (hashed) · none → anonymous
              │ 2. quota: Durable Object per key / per IP (chars today, chars this month, credits)
              │ 3. Workers AI: IndicTrans2 / Gemma
              │ 4. meter: Analytics Engine event {key, chars, direction, latency}
              ▼
          D1 `usage_daily` (rollup) ──► dashboard + invoices
Razorpay (INR, UPI) / Paddle (USD, merchant of record) ──webhook──► credits in D1
```

- **Keys:** `bk_live_` / `bk_test_` prefixes, stored as SHA-256 hashes, shown once. Test keys return
  deterministic fake output and are never billed.
- **Dashboard:** a small page on bhasini.com: sign in with an email magic link, create keys, top up,
  see usage. Keep it static (GitHub Pages) and calling Worker endpoints.
- **Payments:** Razorpay is already set up for sponsorship; use Razorpay Payment Links/Orders for credit
  top-ups and Razorpay Subscriptions for Growth and Scale. Paddle as merchant of record for
  international cards, which avoids GST/VAT registration abroad.
- **GST:** 18% on Indian invoices; show prices excluding GST.
- **Spend safety:** Cloudflare billing alerts, a global daily Workers AI budget in the Worker (switch
  anonymous traffic off first when it is hit), and per-key daily caps the customer can set.

---

## 6. Distribution

1. **MCP:** a `translate` tool on mcp.bhasini.com (free, anonymous quota). Agents that need more send
   `Authorization: Bearer <key>`. List it in the MCP registry, Claude plugin and ChatGPT app already published.
2. **bhasini.com + Windows app:** a Translate panel in the editor. Free and rate-limited, with "Get an API
   key" as the upsell.
3. **Developer docs + Postman:** add a Translation collection to the public Postman workspace
   (see LANGUAGE_API_PLAN §11), with OpenAPI spec, curl, JS, Python and C# snippets.
4. **Marketplaces:** RapidAPI (fast discovery, 20% fee), AWS Marketplace later, GeM for government.
5. **Integrations:** WordPress plugin (post translation), Shopify app (store localisation), n8n/Zapier nodes.
6. **Content/SEO:** public per-language quality scores on the IN22 benchmark versus Google and
   Sarvam; "translate English to Santali" style landing pages for all 22 × 2 directions.

---

## 7. Rollout

| Phase | When | Scope | Exit criteria |
|---|---|---|---|
| **0. Free v1** | Built 21 Oct 2026, not deployed | `/v1/translate` + MCP tool (Worker and C#) + web/Windows Translate dialog; free limits in `src/quota.ts`: 2K chars per request, 5 req/min, 10K chars/day per IP and a 3 lakh chars/day global budget (Durable Objects), `TRANSLATE_ENABLED` kill switch | Works for all 22; latency p50 < 3 s; no abuse spike |
| **1. Paid API** | +4 weeks | API keys, D1 + Durable Object quotas, Razorpay credits, usage dashboard, docs, Postman | First 10 paying customers |
| **2. Growth** | +3 months | Plans, glossary, documents, batch + webhooks, Paddle, RapidAPI | ₹1 L MRR |
| **3. Own models** | When Workers AI spend > ~₹40K/month | Self-host IndicTrans2 indic-en / indic-indic on a GPU; direct translation | Better rare-pair quality; margin > 90% at volume |

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Free quota used as a free backend by scrapers | Per-IP daily cap, Turnstile on the web panel, require a key above 5K chars/day |
| Uneven quality for low-resource pairs (e.g. Bodo → Santali) | Mark low-resource pairs "beta" in docs; publish benchmark scores; let customers report errors |
| Pivot loses nuance in Indic ↔ Indic | Phase 3 direct models; offer `pivot: false` once available |
| Workers AI model removal or price change | Keep the model behind our own API; the IndicTrans2 weights are MIT, so we can self-host at any time |
| Gemma licence terms | Cloudflare's hosted-model terms cover API use; review Gemma's terms before self-hosting |
| Privacy promise ("everything on your device") | Translation is the one feature that sends text to a server. Say so in the panel and update privacy.html. We don't store text; we log only character counts |
| Name confusion with government BHASHINI | Same as parent plan: trademark opinion before charging under the API name |

## 9. Metrics

Characters translated per day (free vs paid), free-to-paid conversion, revenue per 1M characters,
Workers AI cost as a share of revenue (target < 10%), p50/p95 latency per direction, error rate,
top language pairs, and the share of traffic that is Indic ↔ Indic (sizes the Phase 3 decision).

# Search Indexing

## Production Audit: 2026-09-22

Public, read-only checks of `https://vertax.live` found:

- Nameservers: `ns1.vercel-dns.com` and `ns2.vercel-dns.com`.
- Google Public DNS returned no apex TXT records. The previously supplied Google
  verification TXT value was not published. The CNAME name visible in the
  screenshot also had no answer (the target was truncated in the screenshot).
- The homepage contains Yandex verification `84a958a65d2e70e7`.
- `/robots.txt` allows the catalog; it disallows admin, API and cron paths.
- The deployed `/sitemap.xml` listed only `/`, `/about`, `/music`. The separate
  `/music-sitemap.xml` was advertised in robots.txt, but not the main sitemap.
- The music sitemap returned XML with 980 URLs: 195 releases plus the catalog,
  each in five languages. This is not 980 distinct records.
- Public stats: 394 known releases, 195 hydrated release pages, 199 waiting for
  Discogs data, 2,091 track-cache entries, 1,310 catalog tracks, 1,140 tracks with
  both BPM and Camelot. Track-cache entry counts are not release counts.
- Sample A/T/O/S, Heist, Zen and Radiohead pages returned HTTP 200, self-canonical
  URLs, `index, follow`, and real track tables in server-rendered HTML. Requests
  with a Googlebot user-agent also worked; this is not proof of an actual Google
  crawl. Unknown URLs returned 404, HTTP/www redirected to the HTTPS apex.
- No private Search Console or Yandex Webmaster coverage report was available.
  These checks establish crawl eligibility, not actual index inclusion or the
  reason an engine may have excluded a particular page.

Do not confuse the missing Google ownership verification with a crawler block.
Verification gives access to diagnostics and submission tools; it is not a
requirement for a public page to enter search.

## Changes To Deploy

1. `/sitemap.xml` is a single dynamic `urlset`, not a sitemap index. It contains
   `/`, `/about`, and all hydrated catalog/release pages in five languages.
   It reads Redis through the existing `api/catalog.js`, with no new function.
   `/pages-sitemap.xml` and `/music-sitemap.xml` remain aliases of the same full
   map for previously submitted URLs. Static XML files are removed from the
   source/build so they cannot shadow dynamic routes. `robots.txt` advertises
   only `/sitemap.xml`. With the audited catalog size, this gives 982 URLs.
2. Public catalog reads fail with 503/no-store/Retry-After on Redis errors instead
   of publishing a cacheable empty sitemap/catalog or a false 404.
3. Sitemap `lastmod` uses stored dates; missing/invalid/future dates are
   omitted rather than replaced with today.
4. Release pages expose a brief data summary and actual stored update date, plus
   linked WebPage, MusicAlbum and BreadcrumbList structured data. Track values,
   sources, locales and canonical URLs are retained.

No production Redis writes, rebuild or deployment were performed during the audit.
The app, ingestion and moderation flows are unchanged.

## Google Ownership: Action Outside The Repository

In Search Console, choose the Domain property `vertax.live` and the **TXT** method.
Copy the current value from that dialog. The public verification value supplied
earlier in this task was:

```text
google-site-verification=8qDKPkXlKb18KUVOMX5xW9EmtUKO8rueUjSb-ZOI4bQ
```

Use that value only if it matches the current dialog/account. It is public
verification data, not an API secret.

In Vercel, open the team Domains page, select `vertax.live`, and add a DNS record:

| Field | Value |
| --- | --- |
| Type | TXT |
| Name | empty (domain apex, as Vercel specifies) |
| Value | complete `google-site-verification=...` from Search Console |
| TTL | default |

Do not change the website's A/CNAME records or nameservers. Do not replace another
owner's verification record. Changing DNS at the registrar has no effect while
Vercel's nameservers are authoritative. A Vercel environment variable or an HTML
meta tag does not substitute for DNS verification of a Domain property.

If using the CNAME method instead, copy **both complete fields** from Search
Console. Do not reconstruct the truncated target from the screenshot.

Check propagation, then press Verify in Search Console:

```bash
dig +short TXT vertax.live @8.8.8.8
```

## After Deployment And Verification

1. Confirm `https://vertax.live/sitemap.xml` returns HTTP 200 and a `urlset` with
   actual page URLs (not links to other sitemaps). No child sitemap is needed.
2. Submit `https://vertax.live/sitemap.xml` in Google Search Console and Yandex
   Webmaster. The two old entries can be removed from the reports after the
   unified map is processed; their URLs continue to work. Consolidation alone
   does not prove that Google's earlier fetch error is resolved.
3. Inspect `/music` and two real release URLs from the sitemap in each engine.
   Run a live URL test and request indexing for these representative pages.
4. In coverage reports, distinguish not discovered, discovered/not indexed,
   crawled/not indexed, duplicate canonical, noindex and server errors. They have
   different remedies; do not assume that thousands of URLs guarantee inclusion.
5. Check Vercel logs for `/cron/catalog-sync` and its Discogs errors to explain
   the 199 unhydrated records. A public stats response cannot establish whether
   CRON_SECRET, credentials or individual upstream records caused the backlog.
   Do not publish empty record placeholders as indexable pages just to inflate
   the sitemap.

```bash
BASE=https://vertax.live
curl -fsS "$BASE/sitemap.xml" | xmllint --xpath 'count(//*[local-name()="url"])' -
curl -sSI "$BASE/sitemap.xml"
curl -fsS "$BASE/api/catalog?format=stats" | jq
curl -sSI "$BASE/music/a-t-o-s-outboxed-9757514"
```

The unit/smoke tests mock Redis and do not write to production. They cover
the full sitemap and compatibility routes, unique URLs, five-language contents,
canonical redirects, noindex placeholders,
server-rendered track metadata, dates, structured data, missing records, and
Redis outages/missing configuration.

Verification during the initial SEO change: `npm run build`, `npm test`, JS syntax checks
and `git diff --check` passed. Chromium checked all five release locales at 375px
and 1440px and parsed the built sitemap XML. `npm run lint` still reports existing
formatting issues in `js/admin.js`, `js/handlers.js` and `js/music-import.js`;
none of these files was changed in this task.

## SEO And AI Search

The useful asset is an accessible release page with accurate BPM/Camelot,
tracklist, source attribution and internal links, not the number of translated
URLs by itself. No special `llms.txt`, invented ratings or keyword-filled hidden
blocks are required for Google's AI search features. Eligibility still requires
normal indexability and useful content; neither schema nor sitemaps guarantee
search or AI citations.

References:

- [Google ownership verification](https://support.google.com/webmasters/answer/9008080)
- [Vercel DNS records](https://vercel.com/docs/domains/managing-dns-records)
- [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google AI features](https://developers.google.com/search/docs/appearance/ai-features)

# Affiliate link rules (`affiliates.json`)

Roadmap 4.5. The catalogue JSON stores only canonical product URLs in each `buyLinks[].URL`. When the app loads the bundled catalogue (`src/data/loadData.js`), every buy link on the domain of an enabled programme here gets a generated `affiliateUrl`, `network` and `isAffiliate: true`. Users are sent to that link and it is labelled as an affiliate link (`src/lib/buyLinks.js`).

Because the generated links never reach the JSON files, the pricing scan only ever sees canonical URLs, and changing a network or an ID is a one-line edit here. The logic is in `src/lib/affiliateLinks.js`; `affiliateLinks.test.js` validates this file, so a malformed rule fails CI.

**Add a programme only once it has approved the site** (track applications in the 4.1 table in `memory-bank/roadmap.md`).

## Format

```json
{
    "programmes": {
        "<domain>": { "network": "...", "template": "https://...{url}..." },
        "<domain>": { "network": "...", "params": { "<name>": "<value>" } }
    }
}
```

| Field | Required | Meaning |
| ----- | -------- | ------- |
| key | yes | The retailer's domain, lower case, without `www.` (e.g. `bimblesolar.com`). Subdomains match too: `renogy.com` covers `uk.renogy.com`. |
| `network` | yes | Copied onto each link as `network`, e.g. `awin`, `cj`, `impact`, `webgains`, `partnerize`, `paid-on-results`, `in-house`, `amazon`. |
| `template` | one of | An `https://` deeplink where `{url}` is replaced by the URL-encoded product URL. Every other ID must be filled in; leftover `{…}` placeholders are rejected. |
| `params` | one of | Query parameters added to the product URL itself (for Amazon-style `?tag=` or in-house `?aff=` schemes). The product URL must be https. |
| `enabled` | no | `false` switches a programme off without deleting it (e.g. while an application is pending or a programme is paused). Default `true`. |

An `affiliateUrl` written by hand on a catalogue entry (in data-admin) always wins over a rule here, for one-off links a network issues per product.

## Examples

```json
{
    "programmes": {
        "bimblesolar.com": {
            "network": "awin",
            "template": "https://www.awin1.com/cread.php?awinmid=12345&awinaffid=678910&ued={url}"
        },
        "amazon.co.uk": {
            "network": "amazon",
            "params": { "tag": "solarpear-21" }
        },
        "voltaconsolar.com": {
            "network": "paid-on-results",
            "enabled": false,
            "template": "https://www.paidonresults.net/c/12345/1/1234/0?deeplink={url}"
        }
    }
}
```

The IDs above are illustrative. Copy the real deeplink format from each network's dashboard. Before adding Amazon, decide roadmap 6.4 (Amazon price display rules) and add the Associates disclosure wording (6.2).

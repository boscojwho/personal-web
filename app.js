const { useEffect, useMemo, useRef, useState } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "system",
  "font": "Geist"
}/*EDITMODE-END*/;

const BUILD_INFO_FALLBACK = {
  commitHash: "unknown",
  date: "unknown date",
  time: "unknown time",
  label: "unknown date unknown time · unknown",
  hasData: false,
};

function formatBuildInfo(commitHash, commitIso) {
  const commitDate = new Date(commitIso);
  const hasValidCommitDate = !Number.isNaN(commitDate.getTime());
  const date = hasValidCommitDate
    ? commitDate.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "unknown date";
  const time = hasValidCommitDate
    ? commitDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : "unknown time";
  const shortHash = commitHash ? String(commitHash).slice(0, 7) : "unknown";
  return {
    commitHash: shortHash,
    date,
    time,
    label: `${date} ${time} · ${shortHash}`,
    hasData: hasValidCommitDate && shortHash !== "unknown",
  };
}

function parseBuildInfoPayload(payload) {
  if (!payload || typeof payload !== "object") return BUILD_INFO_FALLBACK;
  if (!payload.commitHash || !payload.commitIso) return BUILD_INFO_FALLBACK;
  return formatBuildInfo(payload.commitHash, payload.commitIso);
}

const FONT_OPTIONS = [
  { label: "DM Sans",        stack: "'DM Sans', Helvetica, Arial, sans-serif" },
  { label: "Inter",          stack: "'Inter', Helvetica, Arial, sans-serif" },
  { label: "Geist",          stack: "'Geist', Helvetica, Arial, sans-serif" },
  { label: "Space Grotesk",  stack: "'Space Grotesk', Helvetica, Arial, sans-serif" },
  { label: "IBM Plex",       stack: "'IBM Plex Sans', Helvetica, Arial, sans-serif" },
  { label: "Work Sans",      stack: "'Work Sans', Helvetica, Arial, sans-serif" },
  { label: "JetBrains Mono", stack: "'JetBrains Mono', ui-monospace, monospace" },
  { label: "System",         stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
];

document.documentElement.setAttribute("data-theme", TWEAK_DEFAULTS.theme);

function slugify(text) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_>#`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function articleSummary(body) {
  const block = body
    .split(/\n\s*\n/)
    .map(part => part.trim())
    .find(part => part && !/^#{1,6}\s/.test(part));
  if (!block) return "Writing by Bosco Ho.";
  const summary = stripMarkdown(block);
  return summary.length > 180 ? `${summary.slice(0, 177)}...` : summary;
}

const ROUTE_ROOTS = new Set(["apps", "writing"]);
const IS_FILE_PROTOCOL = window.location.protocol === "file:";

function detectSiteBasePath(pathname) {
  if (IS_FILE_PROTOCOL) return "/";
  const segs = pathname.split("/").filter(Boolean);
  if (!segs.length) return "/";
  if (ROUTE_ROOTS.has(segs[0])) return "/";
  return `/${segs[0]}/`;
}

const SITE_BASE_PATH = detectSiteBasePath(window.location.pathname);
const SITE_BASE_NO_SLASH = SITE_BASE_PATH === "/" ? "/" : SITE_BASE_PATH.replace(/\/$/, "");

function normalizeInternalPath(pathname) {
  if (!pathname || pathname === "/") return "/";
  const clean = pathname.replace(/\/+$/, "");
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function actualToInternalPath(actualPathname) {
  if (window.location.protocol === "file:") {
    const cleanFile = normalizeInternalPath(actualPathname);
    if (cleanFile.endsWith("/index.html") || cleanFile === "/index.html") return "/";
  }
  const clean = normalizeInternalPath(actualPathname);
  if (SITE_BASE_PATH === "/") return clean;
  if (clean === SITE_BASE_NO_SLASH || clean === SITE_BASE_PATH) return "/";
  if (clean.startsWith(SITE_BASE_PATH)) {
    return normalizeInternalPath(`/${clean.slice(SITE_BASE_PATH.length)}`);
  }
  return clean;
}

function internalToActualPath(internalPath) {
  const clean = normalizeInternalPath(internalPath);
  if (SITE_BASE_PATH === "/") return clean;
  if (clean === "/") return SITE_BASE_PATH;
  return `${SITE_BASE_NO_SLASH}${clean}`;
}

function resolveRouteFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const fallbackRoute = params.get("route");
  const currentHash = window.location.hash || "";

  if (IS_FILE_PROTOCOL) {
    return parseInternalRoute(fallbackRoute || "/", currentHash);
  }

  if (fallbackRoute) {
    const url = new URL(fallbackRoute, window.location.origin);
    const internalPath = actualToInternalPath(url.pathname);
    const normalizedActual = `${internalToActualPath(internalPath)}${url.hash || ""}`;
    const currentActual = `${window.location.pathname}${currentHash}`;
    if (currentActual !== normalizedActual || window.location.search) {
      window.history.replaceState({}, "", normalizedActual);
    }
    return parseInternalRoute(internalPath, url.hash || "");
  }

  return parseInternalRoute(actualToInternalPath(window.location.pathname), currentHash);
}

function parseInternalRoute(internalPath, hash = "") {
  const clean = normalizeInternalPath(internalPath);
  if (clean === "/") return { kind: "home", path: "/", hash };

  const segs = clean.split("/").filter(Boolean);
  if (segs[0] === "apps") {
    if (segs.length === 1) return { kind: "home", path: "/", hash };
    if (segs.length === 2) return { kind: "app", path: clean, slug: segs[1], hash };
  }
  if (segs[0] === "writing") {
    if (segs.length === 1) return { kind: "writing", path: "/writing", hash };
    if (segs.length === 2) return { kind: "article", path: clean, slug: segs[1], hash };
  }
  return { kind: "not-found", path: clean, hash };
}

const ROUTES = {
  home: "/",
  writing: "/writing",
  app: slug => `/apps/${slug}`,
  article: slug => `/writing/${slug}`,
};
let hasPlayedHomeIntroForPage = false;

function routeHref(internalPath) {
  if (IS_FILE_PROTOCOL) {
    const clean = normalizeInternalPath(internalPath);
    const search = clean === "/" ? "" : `?route=${encodeURIComponent(clean)}`;
    return `${window.location.pathname}${search}`;
  }
  return internalToActualPath(internalPath);
}

function resolveAssetUrl(path) {
  if (!path) return path;
  if (IS_FILE_PROTOCOL) return path;
  if (
    path.startsWith("/") ||
    path.startsWith("//") ||
    path.startsWith("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(path)
  ) {
    return path;
  }
  if (path.startsWith("assets/")) {
    return `${SITE_BASE_PATH}${path}`;
  }
  return path;
}

function rewriteLocalAssetUrlsInHtml(html) {
  return html.replace(
    /\b(src|href)=(['"])([^'"]+)\2/g,
    (full, attr, quote, value) => `${attr}=${quote}${resolveAssetUrl(value)}${quote}`
  );
}

function setMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(path) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", `${window.location.origin}${path}`);
}

function updatePageMetadata(route, app, article) {
  const baseTitle = "Bosco Ho";
  let title = baseTitle;
  let description = "iOS and macOS developer in Vancouver.";
  let canonical = routeHref(route.path);

  if (route.kind === "app" && app) {
    title = `${app.name} · Apps · ${baseTitle}`;
    description = app.desc || `${app.year} ${app.tags}`.trim();
    canonical = routeHref(route.path);
  } else if (route.kind === "writing") {
    title = `Writing · ${baseTitle}`;
    description = "Articles and notes by Bosco Ho.";
    canonical = routeHref("/writing");
  } else if (route.kind === "article" && article) {
    title = `${article.title} · Writing · ${baseTitle}`;
    description = articleSummary(article.body);
    canonical = routeHref(route.path);
  } else if (route.kind === "not-found") {
    title = `Not found · ${baseTitle}`;
    description = "The requested page could not be found.";
  }

  document.title = title;
  setMeta("description", description);
  setCanonical(canonical);
}

function isModifiedClick(event, target, download) {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    target === "_blank" ||
    download
  );
}

function RouteLink({ to, navigate, className, style, onClick, target, download, children, ...rest }) {
  return (
    <a
      {...rest}
      href={routeHref(to)}
      className={className}
      style={style}
      target={target}
      download={download}
      onClick={event => {
        if (onClick) onClick(event);
        if (event.defaultPrevented || isModifiedClick(event, target, download)) return;
        event.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

const DATA = {
  name: "Bosco Ho",
  location: "Vancouver, BC",
  links: [
    { label: "GitHub", url: "https://github.com/boscojwho" },
    { label: "Mastodon", url: "https://mastodon.social/@sideshow_boz" },
    { label: "RSS", url: "feed.xml" },
  ],
  apps: [
    {
      name: "Castro",
      year: "2018–2020, 2025–2026",
      tags: "iOS · Apple Watch",
      icon: "assets/icons/castro_icon.png",
      bg: "#5856D6",
      label: "C",
      desc: "",
      body: [],
      links: [
        { label: "App Store", url: "https://apps.apple.com/ca/app/castro-podcast-player-app/id1080840241" },
        { label: "castro.fm", url: "https://castro.fm/" },
      ],
    },
    {
      name: "Dive",
      year: "2020–2021",
      tags: "iOS",
      statusTag: "Alpha prototype · Not Shipped",
      icon: "assets/icons/dive_icon.png",
      bg: "#5CBCEB",
      label: "D",
      desc: "A music discovery concept for iPhone built around genre maps, listening paths, and short historical context for tracks and scenes, with genre playlists curated by professional curators in the music industry.",
      body: [
        {
          kind: "img-row",
          images: [
            {
              src: "assets/apps/dive-cold-launch.gif",
              alt: "Dive cold launch animation",
              placeholderSrc: "assets/apps/dive-detail-2.jpeg",
            },
            {
              src: "assets/apps/dive-dream-pop.gif",
              alt: "Dive Dream Pop interaction animation",
              placeholderSrc: "assets/apps/dive-detail-1.jpeg",
            },
          ],
        },
        {
          kind: "img-row",
          images: [
            { src: "assets/apps/dive-detail-1.jpeg", alt: "Dive track detail screen for Dream Pop" },
            { src: "assets/apps/dive-detail-3.jpeg", alt: "Dive track queue screen for Abstract Beats" },
          ],
        },
      ],
      links: [],
    },
    {
      name: "RunGo",
      year: "2014–2016",
      tags: "iOS · Pebble · Apple Watch",
      icon: "assets/icons/rungo_icon_old.png",
      bg: "#E74C3C",
      label: "R",
      desc: "",
      body: [],
      links: [
        { label: "rungoapp.com", url: "https://www.rungoapp.com/" },
        { label: "App Store", url: "https://apps.apple.com/ca/app/rungo-the-best-routes-to-run/id712628644" },
      ],
    },
    {
      name: "HK Characters",
      year: "2024",
      tags: "iOS · SwiftUI",
      groupStart: true,
      icon: "assets/icons/hkscs_icon.png",
      bg: "#C0392B",
      label: "H",
      desc: "A reference app for exploring Hong Kong Supplementary Character Set characters, their glyph variants, readings, and metadata across multiple East Asian languages.",
      body: [
        { kind: "p", text: "HK Characters explores the Hong Kong Supplementary Character Set (2016) as a browsable reference app for people interested in character forms, readings, and historical additions to the standard." },
        { kind: "p", text: "The app highlights glyph variants so you can compare how a single character is written across different traditions and typefaces, including forms that are more common in specific regions." },
        { kind: "p", text: "Characters are grouped into curated collections such as Commonly Used, Tang-era pronunciations, and Vietnamese-related sets, and can also be browsed by the year they were added to HKSCS." },
        { kind: "p", text: "Each entry brings together search, pronunciation, and metadata tools. You can look up characters by definition, Jyutping, or Unicode codepoint, compare readings across Cantonese, Korean, Japanese, Taiwanese, and Mandarin, and inspect associated Unihan metadata when available." },
      ],
      screenshots: [
        { src: "assets/apps/hk-characters-01.jpg", alt: "HK Characters iPhone screenshot 1", device: "iPhone" },
        { src: "assets/apps/hk-characters-02.jpg", alt: "HK Characters iPhone screenshot 2", device: "iPhone" },
        { src: "assets/apps/hk-characters-03.jpg", alt: "HK Characters iPhone screenshot 3", device: "iPhone" },
        { src: "assets/apps/hk-characters-04.jpg", alt: "HK Characters iPhone screenshot 4", device: "iPhone" },
        { src: "assets/apps/hk-characters-05.jpg", alt: "HK Characters iPhone screenshot 5", device: "iPhone" },
        { src: "assets/apps/hk-characters-ipad-01.jpg", alt: "HK Characters iPad screenshot 1", device: "iPad" },
        { src: "assets/apps/hk-characters-ipad-02.jpg", alt: "HK Characters iPad screenshot 2", device: "iPad" },
        { src: "assets/apps/hk-characters-ipad-03.jpg", alt: "HK Characters iPad screenshot 3", device: "iPad" },
      ],
      links: [{ label: "App Store", url: "https://apps.apple.com/ca/app/hk-characters/id6502965916" }],
    },
    {
      name: "Fencathon 3",
      year: "2023",
      tags: "iOS · iPadOS",
      groupStart: true,
      groupLabel: "Fencing",
      icon: "",
      bg: "#F7F3E8",
      label: "🤺",
      desc: "Built to beta, but did not ship after AskFRED (askfred.net) changed ownership and /v1 API was discontinued.",
      body: [
        "Built to beta, but did not ship after AskFRED (askfred.net) changed ownership and /v1 API was discontinued.",
      ],
      screenshots: [
        { src: "assets/apps/fencathon-3-ipad-01.png", alt: "Fencathon 3 iPad fencer profile view", device: "iPad" },
        { src: "assets/apps/fencathon-3-ipad-02.png", alt: "Fencathon 3 iPad tournament overview", device: "iPad" },
        { src: "assets/apps/fencathon-3-ipad-03.png", alt: "Fencathon 3 iPad event entrants list", device: "iPad" },
        { src: "assets/apps/fencathon-3-ipad-04.png", alt: "Fencathon 3 iPad entrant profile", device: "iPad" },
        { src: "assets/apps/fencathon-3-ipad-05.png", alt: "Fencathon 3 iPad fencer results list", device: "iPad" },
        { src: "assets/apps/fencathon-3-ipad-06.png", alt: "Fencathon 3 iPad past results map", device: "iPad" },
        { src: "assets/apps/fencathon-3-ipad-07.png", alt: "Fencathon 3 iPad upcoming tournaments radius map", device: "iPad" },
        { src: "assets/apps/fencathon-3-iphone-01.png", alt: "Fencathon 3 iPhone upcoming tournaments map", device: "iPhone" },
        { src: "assets/apps/fencathon-3-iphone-02.png", alt: "Fencathon 3 iPhone tournament detail sheet", device: "iPhone" },
        { src: "assets/apps/fencathon-3-iphone-03.png", alt: "Fencathon 3 iPhone event registration list", device: "iPhone" },
        { src: "assets/apps/fencathon-3-iphone-04.png", alt: "Fencathon 3 iPhone past event overview", device: "iPhone" },
        { src: "assets/apps/fencathon-3-iphone-05.png", alt: "Fencathon 3 iPhone event results screen", device: "iPhone" },
      ],
      links: [],
    },
    {
      name: "Jot",
      year: "2014",
      tags: "iOS",
      screenshotsPosition: "bottom",
      legacySlugs: ["jot-refined-text-editor"],
      icon: "assets/icons/jot_icon.png",
      bg: "#2C3E50",
      label: "J",
      desc: "A plain-text iPhone editor focused on one-handed writing, easier cursor movement, and less disruptive auto-correction.",
      body: [
        { kind: "img", src: "assets/apps/jot-control.gif", alt: "Jot Control interface over the iPhone keyboard" },
        {
          kind: "img-row",
          images: [
            {
              src: "assets/apps/jot-auto-correct-1.gif",
              alt: "Jot auto-correct refinement demo",
              caption: "Jot knows when iOS autocorrects what you typed, and lets you easily revert to what you intended to type.",
            },
            {
              src: "assets/apps/jot-text-selection-1.gif",
              alt: "Jot text selection demo",
              caption: "Easily select text by single tap (word), double tap (sentence), triple tap (paragraph) using Jot Control.",
            },
          ],
        },
        { kind: "p", text: "Jot launched on the App Store on March 5, 2014 for iPhone and iPod touch." },
        { kind: "p", text: "The app focused on refining text entry with one-handed controls, faster text selection, and \"Jot Correct\" behavior that made auto-correction easier to accept or undo." },
        { kind: "p", text: "Jot required Dropbox to store documents in Apps > Jot - Refined Text Editor and worked with plain-text workflows." },
      ],
      screenshots: [
        { src: "https://www.cultofmac.com/wp-content/uploads/2014/03/13238825805_698454a6bf_b.jpg", alt: "Jot keyboard with ThinkPad-like nubbin" },
      ],
      links: [],
    },
    {
      name: "Fencathon 2",
      year: "2016",
      tags: "iOS",
      icon: "assets/icons/fencathon_2_logo.png",
      bg: "#2980B9",
      label: "F",
      desc: "",
      body: [],
      links: [],
    },
    {
      name: "Fencathon 1",
      year: "2014",
      tags: "iOS",
      icon: "assets/icons/fencathon_1_logo.png",
      bg: "#1ABC9C",
      label: "F",
      desc: "",
      body: [],
      links: [],
    },
    {
      name: "At-The-Piste",
      year: "2014",
      tags: "iOS",
      icon: "assets/icons/atp_logo.png",
      bg: "#8E44AD",
      label: "A",
      desc: "",
      body: [],
      links: [],
    },
    {
      name: "PipPy",
      year: "2024",
      tags: "macOS · SwiftUI · Open Source",
      groupStart: true,
      groupLabel: "Open Source",
      icon: "assets/icons/pippy_icon.png",
      bg: "#3572A5",
      label: "P",
      desc: "A GUI app for Python Pip package manager on macOS.",
      body: [],
      links: [{ label: "GitHub", url: "https://github.com/boscojwho/PipPy" }],
    },
    {
      name: "Chinotto",
      year: "2023",
      tags: "macOS · Open Source",
      icon: "assets/icons/chinotto_placeholder_logo.png",
      bg: "#27AE60",
      label: "N",
      desc: "",
      body: [],
      links: [{ label: "GitHub", url: "https://github.com/boscojwho/Chinotto" }],
    },
    {
      name: "Mlem",
      year: "2023",
      tags: "iOS · Open Source (Contributor)",
      icon: "assets/icons/mlem_logo.png",
      bg: "#E67E22",
      label: "M",
      desc: "",
      body: [],
      links: [
        { label: "GitHub", url: "https://github.com/mlemgroup/mlem" },
        { label: "App Store", url: "https://apps.apple.com/ca/app/mlem-for-lemmy/id6450543782" },
      ],
    },
  ],
  articles: [
    {
      title: "Text Variant Preference View Modifier in SwiftUI",
      date: "Jun 2024",
      body: `> 💡 TL;DR: Use the \`.textVariant(.sizeDependent)\` view modifier to automatically format and fit text inside \`Text\` view's size.

I stumbled upon this new SwiftUI view modifier called \`.textVariant(...)\` while looking for a way to scale font size to fit inside any \`Text\` view. It makes rendering text that can be formatted in various variants easier — think short or long dates — without needing conditional views or \`ViewThatFits\`.

### Use Case

Imagine a \`Text\` view displaying the date a record was updated. We can achieve this in a few ways in SwiftUI:

\`\`\`swift
Text(Date.distantPast, style: .date)
Text(Date.distantPast, format: .dateTime)
// e.g. DateFormatter where dateStyle = .full
Text(Date.distantPast, formatter: Self.dateFormatter)
\`\`\`

This code resolves to the following views:

![](assets/blog/Screenshot_2024-06-18_at_6.55.32_PM.png)

However, this could be an issue if the \`Text\` view's width is forced to shrink to accommodate other content, and is constrained to a line limit of 1.

![](assets/blog/Screenshot_2024-06-18_at_6.59.23_PM.png)

Previously, we would have to use \`ViewThatFits\` or conditional views to avoid truncation:

\`\`\`swift
ViewThatFits {
    Text(Date.distantPast, formatter: Self.fullDateFormatter)
    Text(Date.distantPast, formatter: Self.longDateFormatter)
    Text(Date.distantPast, formatter: Self.mediumDateFormatter)
    Text(Date.distantPast, formatter: Self.shortDateFormatter)
}
.lineLimit(1)
\`\`\`

Now, new in iOS 18, we can achieve this with a single call to \`.textVariant(.sizeDependent)\`:

\`\`\`swift
Text(Date.distantPast, format: .dateTime)
    .textVariant(.sizeDependent)
    .lineLimit(1)
\`\`\`

The text variant modifier generates even shorter variants than \`DateFormatter\` offers out of the box:

![](assets/blog/Screenshot_2024-06-19_at_1.08.27_AM.png)

It's worth noting this modifier differs from \`ViewThatFits\` "both in usage and behavior" ([see Apple's docs](https://developer.apple.com/documentation/swiftui/textvariantpreference/sizedependent#Difference-to-doccomappleSwiftUIdocumentationSwiftUIViewThatFits)).

This API works on all Apple platforms — visionOS, macOS, iOS — and works with other new format styles like \`.stopwatch(...)\` in iOS 18.

### References

- Full working example: [gist.github.com/boscojwho](https://gist.github.com/boscojwho/a21ede6943a435ea600fd51cab2f24fb)
- [Text.textVariant(_:)](https://developer.apple.com/documentation/swiftui/text/textvariant(_:))
- [TextVariantPreference](https://developer.apple.com/documentation/swiftui/textvariantpreference)`,
    },
    {
      title: "Unicode + Swift: Transforming Mandarin Pinyin Diacritics into IPA (Numeric) Form",
      date: "Jun 2024",
      body: `> 💡 A brief note on converting Mandarin Pinyin diacritic tone marks into numeric form. Code examples are written in Swift for Apple platforms.

### Why

Unicode's "Unihan" working group includes Mandarin pronunciations for CJKV logographs written in Pinyin, encoding tone marks as diacritics.

Apple's \`AVSpeechSynthesizer\` has trouble reproducing some Pinyin pronunciations when tone marks are encoded as Combining Diacritical Marks. The same synthesizers correctly reproduce speech when pronunciations are written using numeric tone marks in IPA form.

This means we need a way to convert diacritic tone marks into IPA (numeric) form.

### Background on Pinyin

In Mandarin, Pinyin includes four tone marks (plus a neutral tone):

| Tone | Diacritic | Numeral | Example |
|:---:|:---:|:---:|:---:|
| First | ◌̄ | 1 | mā (ma1) |
| Second | ◌́ | 2 | má (ma2) |
| Third | ◌̌ | 3 | mǎ (ma3) |
| Fourth | ◌̀ | 4 | mà (ma4) |

Pinyin can be written in two forms: IPA form (\`chuang1\`) or diacritic form (\`chuāng\`). We need to convert from the latter to the former.

### Technical Discussion

Most Pinyin letters with tone marks consist of a "base" character and a single **Combining Diacritic Mark**. The letter \`ā\` is a Unicode compositional character: \`a\` (\`U+0061\`) + macron (\`U+0304\`) = \`U+0101\`.

Swift's \`String\` supports character decomposition via \`decomposedStringWithCanonicalMapping\`, which separates the base letter from its diacritic.

**Canonical vs compatibility mapping:** Canonical equivalence is a fundamental equivalency between characters representing the same abstract character. Compatibility equivalence is weaker — characters may have distinct visual appearances. For decomposing Pinyin, canonical mapping is the right choice.

![Canonical equivalence examples](/assets/blog/Screenshot_2024-06-13_at_5_07_29_PM.png)

![Compatibility equivalence examples](/assets/blog/Screenshot_2024-06-13_at_5_12_20_PM.png)

### Code Snippets

Decompose a Pinyin letter to retrieve its tone mark:

\`\`\`swift
let decomposedString = "chuāng".decomposedStringWithCanonicalMapping
let scalarView = decomposedString.unicodeScalars
// ["c", "h", "u", "a", "\\u{0304}", "n", "g"]
// The combining diacritic comes after the letter it modifies.
\`\`\`

Match the diacritic codepoint to a tone number:

\`\`\`swift
// Lookup table — Combining Diacritic Marks
let diacriticToNumeric: [Unicode.Scalar: Int] = [
    "\\u{0304}": 1,  // First tone  (macron)
    "\\u{0301}": 2,  // Second tone (acute)
    "\\u{030C}": 3,  // Third tone  (caron)
    "\\u{0300}": 4,  // Fourth tone (grave)
]
\`\`\`

Then concatenate the stripped base reading with the numeric value:

\`\`\`swift
// e.g. "chuang" + 1 = "chuang1"
let pinyinIPA = strippedBase + String(toneNumeric)
\`\`\`

I've implemented **PinyinParse** to wrap this in one line:

\`\`\`swift
Pinyin(diacriticForm: $0.pinyinReading).ipaForm
\`\`\`

Full implementation: [PinyinParse on GitHub](https://github.com/boscojwho/PinyinParse)`,
    },
    {
      title: "Navigation Split View — 3 Columns for Non-List Views",
      date: "Apr 2024",
      body: `For some reason, using split view's three-column API doesn't work as expected on iPhone (compact size) when the content column is a non-List view. There is a workaround.

\`\`\`swift
// This works
NavigationSplitView {
    sidebar
} content: {
    List(selection: ...) { ... }
} detail: {
    detail
}

// This doesn't
NavigationSplitView {
    sidebar
} content: {
    CustomView() // e.g. LazyVGrid
} detail: {
    detail
}
\`\`\`

Turns out you can use \`NavigationLink\` and \`NavigationStack\` in a two-column setup, and it will still show three columns in regular size. The system collapses views into a \`NavigationStack\` in compact size.

\`\`\`swift
// Workaround
NavigationSplitView {
    sidebar
} content: {
    NavigationStack {
        CustomNonListView() { // e.g. LazyVGrid
            NavigationLink(value: item) { ... }
        }
        .navigationDestination(for: Item.self) {
            DetailView(item: $0)
        }
    }
} detail: {
    if selection == nil {
        ContentUnavailableView(...)
    }
}
\`\`\`

For this to work, you still need to use the three-column API — otherwise the system complains there is no next column on which to present a detail view.`,
    },
  ],
};

DATA.apps = DATA.apps.map(item => ({ ...item, slug: slugify(item.name) }));
DATA.articles = DATA.articles.map(item => ({ ...item, slug: slugify(item.title) }));

const APP_BY_SLUG = new Map(DATA.apps.map(item => [item.slug, item]));
const ARTICLE_BY_SLUG = new Map(DATA.articles.map(item => [item.slug, item]));
const APP_ALIAS_TO_SLUG = new Map(
  DATA.apps.flatMap(item => (item.legacySlugs || []).map(alias => [alias, item.slug]))
);

function AppDetail({ app, navigate, theme, onTheme }) {
  const [hoverV, setHoverV] = useState(null);
  const [iconFailed, setIconFailed] = useState(false);
  const [expandedShotIndex, setExpandedShotIndex] = useState(null);
  const [loadedMedia, setLoadedMedia] = useState(() => new Set());
  const appStoreLink = app.links?.find(link => link.label === "App Store") || null;
  const websiteLink = app.links?.find(link => link.label !== "App Store" && /[a-z0-9-]+\.[a-z]{2,}/i.test(link.label)) || null;
  const otherLinks = app.links?.filter(link => link !== appStoreLink && link !== websiteLink) || [];
  const showScreenshotsAtBottom = app.screenshotsPosition === "bottom";
  const heroShot = showScreenshotsAtBottom
    ? null
    : (app.screenshots?.find(shot => shot.device === "iPad") || app.screenshots?.[0] || null);
  const galleryShots = heroShot ? app.screenshots.filter(shot => shot !== heroShot) : app.screenshots;

  useEffect(() => {
    setIconFailed(false);
    setExpandedShotIndex(null);
    setLoadedMedia(new Set());
  }, [app.slug]);

  useEffect(() => {
    if (expandedShotIndex === null) return undefined;

    const onKeyDown = event => {
      if (event.key === "Escape") setExpandedShotIndex(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expandedShotIndex]);

  return (
    <div style={{ animation: "fadeUp 0.2s ease", padding: "40px var(--gap)" }}>
      <div className="detail-topbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: "32px" }}>
        <RouteLink to={ROUTES.home} navigate={navigate} style={{ color: "var(--mid)", textDecoration: "underline", textDecorationColor: "var(--ul)" }}>
          ← Home
        </RouteLink>
        <CompactThemeToggle theme={theme} onTheme={onTheme} />
      </div>

        <div style={{ maxWidth: "620px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "24px", marginBottom: "32px" }}>
          {(() => {
            const variants = app.variants && app.variants.length > 0 ? app.variants : [{ bg: app.bg, label: app.label }];
            const tilts = [
              { rx: -6, ry: -22, rz: -4 },
              { rx: 4, ry: -8, rz: 2 },
              { rx: -3, ry: 16, rz: -2 },
              { rx: 8, ry: 26, rz: 6 },
            ];
            return (
              <div style={{ perspective: "700px", display: "flex", alignItems: "center", flexShrink: 0, paddingLeft: variants.length > 1 ? "6px" : 0 }}>
                {variants.map((variant, i) => {
                  const tilt = tilts[i % tilts.length];
                  const isHover = hoverV === i;
                  const baseLeft = i === 0 ? 0 : -22;
                  return (
                    <div
                      key={i}
                      onMouseEnter={() => setHoverV(i)}
                      onMouseLeave={() => setHoverV(null)}
                      style={{
                        width: 72,
                        height: 72,
                        background: variant.bg,
                        borderRadius: 16,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: 32,
                        fontWeight: 700,
                        marginLeft: isHover ? (i === 0 ? 8 : -6) : baseLeft,
                        marginRight: isHover && i < variants.length - 1 ? 16 : 0,
                        transform: isHover ? "rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1.18) translateY(-6px)" : `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) rotateZ(${tilt.rz}deg)`,
                        transformStyle: "preserve-3d",
                        border: variants.length > 1 ? "2px solid var(--bg)" : "none",
                        boxShadow: isHover ? "0 16px 30px rgba(0,0,0,0.28), 0 4px 8px rgba(0,0,0,0.18)" : "0 10px 22px rgba(0,0,0,0.20), 0 2px 5px rgba(0,0,0,0.12)",
                        zIndex: isHover ? 50 : variants.length - i,
                        cursor: variants.length > 1 ? "pointer" : "default",
                        transition: "transform 0.20s cubic-bezier(0.34, 1.4, 0.64, 1), margin 0.20s ease, box-shadow 0.20s ease",
                      }}
                    >
                      {app.icon && !iconFailed ? (
                        <img
                          src={resolveAssetUrl(app.icon)}
                          width="72"
                          height="72"
                          alt={app.name}
                          onError={() => setIconFailed(true)}
                          style={{ display: "block", borderRadius: 13, pointerEvents: "none" }}
                        />
                      ) : (
                        variant.label
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div style={{ paddingTop: "8px" }}>
            <p style={{ fontWeight: 700, fontSize: "1.1em", marginBottom: "4px" }}>{app.name}</p>
            <p style={{ color: "var(--mid)", marginBottom: "2px" }}>{app.year}  ·  {app.tags}</p>
            {(appStoreLink || websiteLink) ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "10px",
                  marginTop: "12px",
                }}
              >
                {appStoreLink ? (
                  <a
                    href={appStoreLink.url}
                    aria-label={`Download ${app.name} on the App Store`}
                    style={{
                      display: "inline-block",
                      lineHeight: 0,
                    }}
                  >
                    <img
                      src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83"
                      alt="Download on the App Store"
                      style={{
                        display: "block",
                        height: "40px",
                        width: "auto",
                      }}
                    />
                  </a>
                ) : null}
                {websiteLink ? (
                  <a
                    href={websiteLink.url}
                    aria-label={`Visit ${websiteLink.label}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: "40px",
                      padding: "0 14px",
                      borderRadius: "999px",
                      border: "1px solid color-mix(in srgb, var(--mid) 24%, transparent)",
                      background: "color-mix(in srgb, var(--fg) 3%, var(--bg))",
                      color: "var(--fg)",
                      fontSize: "0.95em",
                      fontWeight: 600,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {websiteLink.label}
                  </a>
                ) : null}
              </div>
            ) : null}
            {app.statusTag ? (
              <p
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 8px",
                  marginTop: (appStoreLink || websiteLink) ? "12px" : "8px",
                  borderRadius: "999px",
                  background: "color-mix(in srgb, var(--fg) 4%, var(--bg))",
                  border: "1px solid color-mix(in srgb, var(--mid) 18%, transparent)",
                  color: "var(--mid)",
                  fontSize: "0.76em",
                  fontWeight: 500,
                  letterSpacing: "0.01em",
                }}
              >
                {app.statusTag}
              </p>
            ) : null}
          </div>
          </div>

          {heroShot && (
            <button
              type="button"
              onClick={() => setExpandedShotIndex(app.screenshots.indexOf(heroShot))}
              aria-label={`Open hero screenshot for ${app.name}`}
              style={{
                appearance: "none",
                display: "block",
                width: "100%",
                padding: 0,
                margin: "0 0 24px",
                border: "none",
                background: "transparent",
                cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'%3E%3Ccircle cx='15' cy='15' r='10' fill='white' fill-opacity='0.92' stroke='black' stroke-width='2.4'/%3E%3Cpath d='M22.5 22.5 31 31' stroke='black' stroke-width='3' stroke-linecap='round'/%3E%3Cpath d='M15 10.5v9M10.5 15h9' stroke='black' stroke-width='2.4' stroke-linecap='round'/%3E%3C/svg%3E") 15 15, zoom-in`,
              }}
            >
              <img
                src={resolveAssetUrl(heroShot.src)}
                alt={heroShot.alt || `${app.name} hero screenshot`}
                style={{
                  display: "block",
                  width: "100%",
                  borderRadius: "22px",
                  border: "1px solid color-mix(in srgb, var(--mid) 40%, transparent)",
                  boxShadow: "0 18px 40px rgba(0,0,0,0.14)",
                  background: "var(--bg)",
                }}
              />
            </button>
          )}

          <p style={{ marginBottom: "28px", fontSize: "1.05em" }}>{app.desc}</p>

        <div className="ab">
          {app.body.map((blk, i) => (
            blk.kind === "h" ? (
              <h2 key={i} style={{ fontWeight: 700, fontSize: "1em", marginTop: "24px", marginBottom: "8px" }}>{blk.text}</h2>
            ) : blk.kind === "img" ? (
              <figure key={i} style={{ margin: "0 0 18px" }}>
                <img
                  src={resolveAssetUrl(blk.src)}
                  alt={blk.alt || ""}
                  style={{
                    display: "block",
                    width: "100%",
                    maxWidth: "360px",
                    borderRadius: "18px",
                    boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
                  }}
                />
              </figure>
            ) : blk.kind === "img-row" ? (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "16px",
                  margin: "0 0 18px",
                  maxWidth: "560px",
                }}
              >
                {blk.images.map((image, imageIndex) => {
                  const isVideo = /\.(mp4|webm|mov)$/i.test(image.src);
                  const isGif = /\.gif$/i.test(image.src);
                  const isLoaded = loadedMedia.has(image.src);
                  return (
                    <figure key={imageIndex} style={{ margin: 0 }}>
                      <div
                        style={{
                          position: "relative",
                          overflow: "hidden",
                          borderRadius: "18px",
                          boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
                          background: "color-mix(in srgb, var(--fg) 4%, var(--bg))",
                          border: image.placeholderSrc && !isLoaded
                            ? "1px solid color-mix(in srgb, var(--mid) 22%, transparent)"
                            : "1px solid transparent",
                          minHeight: "180px",
                        }}
                      >
                        {image.placeholderSrc ? (
                          <img
                            src={resolveAssetUrl(image.placeholderSrc)}
                            alt=""
                            aria-hidden="true"
                            style={{
                              display: "block",
                              width: "100%",
                              opacity: 0,
                              pointerEvents: "none",
                            }}
                          />
                        ) : null}
                        {isVideo ? (
                          <video
                            src={resolveAssetUrl(image.src)}
                            aria-label={image.alt || ""}
                            autoPlay
                            muted
                            loop
                            playsInline
                            preload="metadata"
                            onLoadedData={() => {
                              setLoadedMedia(prev => {
                                if (prev.has(image.src)) return prev;
                                const next = new Set(prev);
                                next.add(image.src);
                                return next;
                              });
                            }}
                            style={{
                              display: "block",
                              width: "100%",
                              position: image.placeholderSrc ? "absolute" : "relative",
                              inset: image.placeholderSrc ? 0 : "auto",
                              opacity: isLoaded ? 1 : 0,
                              transition: "opacity 0.24s ease",
                            }}
                          />
                        ) : (
                          <img
                            src={resolveAssetUrl(image.src)}
                            alt={image.alt || ""}
                            onLoad={() => {
                              setLoadedMedia(prev => {
                                if (prev.has(image.src)) return prev;
                                const next = new Set(prev);
                                next.add(image.src);
                                return next;
                              });
                            }}
                            style={{
                              display: "block",
                              width: "100%",
                              position: image.placeholderSrc ? "absolute" : "relative",
                              inset: image.placeholderSrc ? 0 : "auto",
                              opacity: image.placeholderSrc ? (isLoaded ? 1 : 0) : 1,
                              transition: "opacity 0.24s ease",
                            }}
                          />
                        )}
                        {isGif ? (
                          <span
                            style={{
                              position: "absolute",
                              right: "10px",
                              bottom: "10px",
                              padding: "4px 7px",
                              borderRadius: "999px",
                              background: "rgba(255,255,255,0.72)",
                              backdropFilter: "blur(6px)",
                              color: "rgba(17,17,17,0.62)",
                              fontSize: "0.68em",
                              fontWeight: 700,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              pointerEvents: "none",
                            }}
                          >
                            GIF
                          </span>
                        ) : null}
                      </div>
                      {image.caption ? (
                        <figcaption style={{ marginTop: "10px", fontSize: "0.95em", lineHeight: 1.45, color: "var(--mid)" }}>
                          {image.caption}
                        </figcaption>
                      ) : null}
                    </figure>
                  );
                })}
              </div>
            ) : (
              <p key={i} style={{ marginBottom: "14px" }}>{blk.text}</p>
            )
          ))}
        </div>

        {app.screenshots && app.screenshots.length > 0 && (
          <div style={{ marginTop: "32px" }}>
            <p style={{ fontWeight: 700, marginBottom: "6px" }}>Screenshots</p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "12px",
                maxWidth: "720px",
                marginTop: "14px",
              }}
            >
              {(showScreenshotsAtBottom ? app.screenshots : galleryShots).map((shot, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setExpandedShotIndex(app.screenshots.indexOf(shot))}
                  style={{
                    appearance: "none",
                    display: "block",
                    width: "100%",
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    textAlign: "left",
                    cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'%3E%3Ccircle cx='15' cy='15' r='10' fill='white' fill-opacity='0.92' stroke='black' stroke-width='2.4'/%3E%3Cpath d='M22.5 22.5 31 31' stroke='black' stroke-width='3' stroke-linecap='round'/%3E%3Cpath d='M15 10.5v9M10.5 15h9' stroke='black' stroke-width='2.4' stroke-linecap='round'/%3E%3C/svg%3E") 15 15, zoom-in`,
                  }}
                  aria-label={`Open ${shot.device || "app"} screenshot ${i + 1}`}
                >
                  <img
                    src={resolveAssetUrl(shot.src)}
                    alt={shot.alt || `${app.name} screenshot ${i + 1}`}
                    style={{
                      display: "block",
                      width: "100%",
                      borderRadius: "14px",
                      border: "1px solid var(--mid)",
                      boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
                      background: "var(--bg)",
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {expandedShotIndex !== null && app.screenshots?.[expandedShotIndex] && (
          <button
            type="button"
            onClick={() => setExpandedShotIndex(null)}
            aria-label="Close expanded screenshot"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              border: "none",
              background: "rgba(0,0,0,0.78)",
              padding: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <div
              onClick={event => event.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: "1100px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                cursor: "default",
              }}
            >
              <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
                <span
                  style={{
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.35)",
                    borderRadius: "999px",
                    padding: "6px 12px",
                    fontSize: "0.9em",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  Close
                </span>
              </div>
              <img
                src={resolveAssetUrl(app.screenshots[expandedShotIndex].src)}
                alt={app.screenshots[expandedShotIndex].alt || `${app.name} screenshot ${expandedShotIndex + 1}`}
                style={{
                  display: "block",
                  maxWidth: "100%",
                  maxHeight: "82vh",
                  borderRadius: "18px",
                  boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
                  background: "#fff",
                }}
              />
            </div>
          </button>
        )}

        {otherLinks.length > 0 && (
          <div style={{ marginTop: "32px", paddingTop: "20px", borderTop: "1px solid var(--mid)" }}>
            <p style={{ fontWeight: 700, marginBottom: "8px" }}>Links</p>
            {otherLinks.map((link, i) => (
              <a key={i} href={link.url} className="nav-link" style={{ display: "inline-block", marginRight: "8px" }}>
                <span className="nav-link-title">{link.label}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ArticleDetail({ article, navigate, theme, onTheme, routeHash }) {
  const [activeId, setActiveId] = useState(null);
  const [tocOpen, setTocOpen] = useState(false);
  const contentRef = useRef(null);

  const headings = useMemo(() => {
    return [...article.body.matchAll(/^(#{2,3}) (.+)$/gm)].map(match => ({
      level: match[1],
      text: match[2],
      id: `h-${match[2].toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    }));
  }, [article]);

  const html = useMemo(() => {
    let md = article.body;
    headings.forEach(h => {
      const escapedLevel = h.level.replace(/#/g, "\\#");
      const escapedText = h.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      md = md.replace(new RegExp(`^${escapedLevel} ${escapedText}$`, "m"), `${h.level} <span id="${h.id}">${h.text}</span>`);
    });
    return rewriteLocalAssetUrlsInHtml(marked.parse(md));
  }, [article, headings]);

  useEffect(() => {
    if (!contentRef.current || headings.length === 0) return;
    const els = headings.map(h => document.getElementById(h.id)).filter(Boolean);
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) setActiveId(entry.target.id);
      });
    }, { rootMargin: "-10% 0px -80% 0px" });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [headings]);

  useEffect(() => {
    if (!routeHash) return;
    const id = routeHash.replace(/^#/, "");
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView();
    });
  }, [article, routeHash]);

  return (
    <div style={{ animation: "fadeUp 0.2s ease", padding: "40px var(--gap)" }}>
      <div className="detail-topbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: "32px" }}>
        <RouteLink to={ROUTES.writing} navigate={navigate} style={{ color: "var(--mid)", textDecoration: "underline", textDecorationColor: "var(--ul)" }}>
          ← All writing
        </RouteLink>
        <CompactThemeToggle theme={theme} onTheme={onTheme} />
      </div>

      <div className="article-grid" style={{ display: "grid", gridTemplateColumns: headings.length ? "minmax(0,1fr) 180px" : "1fr", gap: "60px", maxWidth: "760px", alignItems: "start" }}>
        <div>
          <p style={{ fontWeight: 700, marginBottom: "4px" }}>{article.title}</p>
          <p style={{ color: "var(--mid)", marginBottom: "28px" }}>{article.date}</p>
          <div ref={contentRef} className="ab" dangerouslySetInnerHTML={{ __html: html }} />
        </div>

        {headings.length > 0 && (
          <nav className="toc-sidebar" style={{ position: "sticky", top: "40px" }}>
            <p style={{ fontWeight: 700, marginBottom: "8px" }}>Contents</p>
            {headings.map(h => (
              <a key={h.id} href={`#${h.id}`} className={"toc-link" + (activeId === h.id ? " on" : "")}>
                {h.text}
              </a>
            ))}
          </nav>
        )}
      </div>

      {headings.length > 0 && (
        <button
          className="toc-fab"
          onClick={() => setTocOpen(o => !o)}
          aria-label={tocOpen ? "Close table of contents" : "Open table of contents"}
          aria-expanded={tocOpen}
        >
          {tocOpen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h10" />
            </svg>
          )}
        </button>
      )}

      {tocOpen && (
        <div className="toc-overlay" onClick={() => setTocOpen(false)}>
          <div className="toc-sheet" onClick={e => e.stopPropagation()}>
            <p style={{ fontWeight: 700, marginBottom: "12px" }}>Contents</p>
            {headings.map(h => (
              <a
                key={h.id}
                href={`#${h.id}`}
                onClick={() => setTocOpen(false)}
                className={"toc-link" + (activeId === h.id ? " on" : "")}
                style={{ fontSize: "15px", padding: "10px 8px" }}
              >
                {h.text}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AllArticles({ navigate, theme, onTheme }) {
  const groups = [];
  DATA.articles.forEach(article => {
    if (groups.length && groups[groups.length - 1].date === article.date) {
      groups[groups.length - 1].items.push(article);
    } else {
      groups.push({ date: article.date, items: [article] });
    }
  });

  return (
    <div style={{ animation: "fadeUp 0.2s ease", padding: "40px var(--gap)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: "32px" }}>
        <RouteLink to={ROUTES.home} navigate={navigate} style={{ color: "var(--mid)", textDecoration: "underline", textDecorationColor: "var(--ul)" }}>
          ← Home
        </RouteLink>
        <CompactThemeToggle theme={theme} onTheme={onTheme} />
      </div>

      <div style={{ maxWidth: "620px" }}>
        <p style={{ fontWeight: 700, marginBottom: "4px" }}>All writing</p>
        <p style={{ color: "var(--mid)", marginBottom: "28px" }}>{DATA.articles.length} total</p>
        {groups.map(group => (
          <div key={group.date} style={{ marginBottom: "24px" }}>
            <p style={{ color: "var(--mid)", marginBottom: "10px" }}>{group.date}</p>
            {group.items.map(article => (
              <RouteLink
                key={article.slug}
                to={ROUTES.article(article.slug)}
                navigate={navigate}
                className="nav-link"
                style={{ marginBottom: "2px" }}
              >
                <span className="nav-link-title">{article.title}</span>
              </RouteLink>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function HomePage({ navigate, theme, onTheme }) {
  const LAUNCH_JIGGLE_DURATION_MS = 2000;
  const shouldRunSessionIntro = useMemo(() => {
    if (hasPlayedHomeIntroForPage) return false;
    hasPlayedHomeIntroForPage = true;
    return true;
  }, []);
  const [hoverIcon, setHoverIcon] = useState(null);
  const [hoverNameIndex, setHoverNameIndex] = useState(null);
  const [introHoverIcon, setIntroHoverIcon] = useState(null);
  const [introHoverNameIndex, setIntroHoverNameIndex] = useState(null);
  const [isIntroHoverActive, setIsIntroHoverActive] = useState(() => shouldRunSessionIntro);
  const [launchHoverIcon, setLaunchHoverIcon] = useState(null);
  const [jiggleIconIndex, setJiggleIconIndex] = useState(null);
  const [jiggleTick, setJiggleTick] = useState(0);
  const [bridgeSide, setBridgeSide] = useState(null);
  const [failedDockIcons, setFailedDockIcons] = useState(() => new Set());
  const [hoverNamePose, setHoverNamePose] = useState({ x: -0.5, ry: 18, rx: -9, rz: 0, z: 10, y: -3, s: 1.4 });
  const [isAboutMetaVisible, setIsAboutMetaVisible] = useState(false);
  const [buildInfo, setBuildInfo] = useState(BUILD_INFO_FALLBACK);
  const [hardwareFrameRect, setHardwareFrameRect] = useState(null);
  const [isHardwareExpanded, setIsHardwareExpanded] = useState(false);
  const [isHardwareTransitioning, setIsHardwareTransitioning] = useState(false);
  const [isHardwareTeaserVisible, setIsHardwareTeaserVisible] = useState(() => !shouldRunSessionIntro);
  const [isCompactViewport, setIsCompactViewport] = useState(() => window.innerWidth <= 700);
  const hasBuildInfo = buildInfo.hasData;
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDarkMode = theme === "dark" || (theme === "system" && prefersDark);
  const hardwareShellRef = useRef(null);
  const hardwareMeasureRafRef = useRef(null);
  const hardwareTransitionTimeoutRef = useRef(null);
  const HARDWARE_ZOOM_MS = 260;
  const HARDWARE_ASPECT_RATIO = 568 / 320;
  const hardwareZoomTransition = `${HARDWARE_ZOOM_MS}ms cubic-bezier(0.2, 0.9, 0.22, 1.12)`;
  const hardwareTeaserRevealTransition = "1s cubic-bezier(0.22, 1, 0.36, 1)";

  const randomizeNamePose = () => {
    setHoverNamePose({
      x: -0.5 + (Math.random() * 1.4 - 0.7),
      ry: 18 + (Math.random() * 14 - 7),
      rx: -9 + (Math.random() * 10 - 5),
      rz: Math.random() * 8 - 4,
      z: 10 + (Math.random() * 8 - 4),
      y: -3 + (Math.random() * 2.2 - 1.1),
      s: 1.4 + (Math.random() * 0.08 - 0.04),
    });
  };
  const lastNameIndex = DATA.name.length - 1;
  const bridgeTransition = "transform 0.42s cubic-bezier(0.22, 1.55, 0.36, 1)";
  const activeHoverNameIndex = hoverNameIndex != null ? hoverNameIndex : (isIntroHoverActive ? introHoverNameIndex : null);
  const activeHoverIcon = hoverIcon != null
    ? hoverIcon
    : (launchHoverIcon != null ? launchHoverIcon : (isIntroHoverActive ? introHoverIcon : null));
  const hardwareTargetRect = (() => {
    const maxWidth = window.innerWidth - 40;
    const maxHeight = window.innerHeight - 40;
    const width = Math.min(maxWidth, maxHeight * HARDWARE_ASPECT_RATIO);
    const height = width / HARDWARE_ASPECT_RATIO;
    return {
      left: (window.innerWidth - width) / 2,
      top: (window.innerHeight - height) / 2,
      width,
      height,
    };
  })();
  const hardwareAnimatedRect = isHardwareExpanded ? hardwareTargetRect : hardwareFrameRect;

  const measureHardwareFrame = () => {
    if (!hardwareShellRef.current) return;
    const rect = hardwareShellRef.current.getBoundingClientRect();
    setHardwareFrameRect(prev => {
      if (
        prev &&
        Math.abs(prev.left - rect.left) < 0.5 &&
        Math.abs(prev.top - rect.top) < 0.5 &&
        Math.abs(prev.width - rect.width) < 0.5 &&
        Math.abs(prev.height - rect.height) < 0.5
      ) {
        return prev;
      }
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    });
  };

  const scheduleHardwareMeasure = () => {
    if (hardwareMeasureRafRef.current != null) return;
    hardwareMeasureRafRef.current = requestAnimationFrame(() => {
      hardwareMeasureRafRef.current = null;
      measureHardwareFrame();
    });
  };

  const clearHardwareTransitionTimeout = () => {
    if (hardwareTransitionTimeoutRef.current != null) {
      clearTimeout(hardwareTransitionTimeoutRef.current);
      hardwareTransitionTimeoutRef.current = null;
    }
  };

  const finishHardwareTransitionLater = () => {
    clearHardwareTransitionTimeout();
    hardwareTransitionTimeoutRef.current = setTimeout(() => {
      setIsHardwareTransitioning(false);
      hardwareTransitionTimeoutRef.current = null;
    }, HARDWARE_ZOOM_MS);
  };

  const openHardwareZoom = () => {
    measureHardwareFrame();
    setIsHardwareTransitioning(true);
    setIsHardwareExpanded(true);
    finishHardwareTransitionLater();
  };

  const closeHardwareZoom = () => {
    setIsHardwareTransitioning(true);
    setIsHardwareExpanded(false);
    finishHardwareTransitionLater();
  };

  useEffect(() => {
    if (!shouldRunSessionIntro) {
      setIntroHoverNameIndex(null);
      setIntroHoverIcon(null);
      setIsIntroHoverActive(false);
      return undefined;
    }
    const allNameIndices = [...DATA.name]
      .map((char, i) => (char === " " ? null : i))
      .filter(i => i != null);
    const nameIndices = allNameIndices.length
      ? [allNameIndices[Math.floor(Math.random() * allNameIndices.length)]]
      : [];
    const introStartDelay = 1000;
    const nameStepDelay = LAUNCH_JIGGLE_DURATION_MS;
    const settleDelay = 560;
    const timers = [];
    let step = 0;

    const tick = () => {
      if (step < nameIndices.length) {
        setIntroHoverNameIndex(nameIndices[step]);
        setIntroHoverIcon(null);
      } else {
        setIntroHoverNameIndex(null);
        setIntroHoverIcon(null);
        setIsIntroHoverActive(false);
        return;
      }
      step += 1;
      timers.push(setTimeout(tick, nameStepDelay));
    };

    timers.push(setTimeout(tick, introStartDelay));
    timers.push(setTimeout(() => {
      setIntroHoverNameIndex(null);
      setIntroHoverIcon(null);
      setIsIntroHoverActive(false);
    }, introStartDelay + nameStepDelay * nameIndices.length + settleDelay));

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [LAUNCH_JIGGLE_DURATION_MS, shouldRunSessionIntro]);

  useEffect(() => {
    if (!shouldRunSessionIntro) {
      setIsHardwareTeaserVisible(true);
      return undefined;
    }

    const introStartDelay = 1000;
    const nameStepDelay = LAUNCH_JIGGLE_DURATION_MS;
    const settleDelay = 560;
    const revealTimeout = setTimeout(() => {
      setIsHardwareTeaserVisible(true);
    }, introStartDelay + nameStepDelay + settleDelay);

    return () => clearTimeout(revealTimeout);
  }, [LAUNCH_JIGGLE_DURATION_MS, shouldRunSessionIntro]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(routeHref("/build-info.json"), { signal: controller.signal, cache: "no-store" })
      .then(resp => (resp.ok ? resp.json() : null))
      .then(data => {
        setBuildInfo(parseBuildInfoPayload(data));
      })
      .catch(() => {
        // Keep fallback values when build metadata file is missing.
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!shouldRunSessionIntro) {
      setJiggleIconIndex(null);
      setLaunchHoverIcon(null);
      return undefined;
    }
    if (!DATA.apps.length) return undefined;
    const launchDelay = 900;
    const jiggleDuration = LAUNCH_JIGGLE_DURATION_MS;
    const frameMs = 85;
    let intervalId = null;
    let stopTimeout = null;
    const startTimeout = setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * DATA.apps.length);
      setJiggleIconIndex(randomIndex);
      setLaunchHoverIcon(randomIndex);
      setJiggleTick(0);
      intervalId = setInterval(() => {
        setJiggleTick(t => t + 1);
      }, frameMs);
      stopTimeout = setTimeout(() => {
        if (intervalId != null) clearInterval(intervalId);
        setJiggleIconIndex(null);
        setLaunchHoverIcon(null);
      }, jiggleDuration);
    }, launchDelay);

    return () => {
      clearTimeout(startTimeout);
      if (stopTimeout != null) clearTimeout(stopTimeout);
      if (intervalId != null) clearInterval(intervalId);
    };
  }, [LAUNCH_JIGGLE_DURATION_MS, shouldRunSessionIntro]);

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === "Escape") closeHardwareZoom();
    };
    if (!isHardwareExpanded) return undefined;

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isHardwareExpanded]);

  useEffect(() => {
    if (!isHardwareExpanded) return undefined;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [isHardwareExpanded]);

  useEffect(() => {
    scheduleHardwareMeasure();
  });

  useEffect(() => {
    const handleViewportChange = () => scheduleHardwareMeasure();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, { passive: true });
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setIsCompactViewport(window.innerWidth <= 700);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => () => {
    if (hardwareMeasureRafRef.current != null) cancelAnimationFrame(hardwareMeasureRafRef.current);
    clearHardwareTransitionTimeout();
  }, []);

  return (
    <div style={{ padding: "40px var(--gap)", animation: "fadeUp 0.2s ease" }}>
      <div style={{ marginBottom: "32px" }}>
        <div className="site-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", marginBottom: "4px" }}>
          <div className="site-header-brand" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <p
              onMouseLeave={() => {
                setHoverNameIndex(null);
                if (bridgeSide === "name") setBridgeSide(null);
              }}
              style={{
              fontWeight: 900,
              fontSize: "24px",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              perspective: "300px",
              display: "inline-flex",
              letterSpacing: "-0.01em",
              transformStyle: "preserve-3d",
              transform: bridgeSide === "dock" ? "translateX(-3px)" : "translateX(0)",
              transition: bridgeTransition,
              cursor: "default",
            }}
            >
              {[...DATA.name].map((char, i) => {
                const transforms = [
                  "rotateY(-10deg) rotateX(4deg)",
                  "rotateY(7deg) rotateX(-5deg)",
                  "rotateY(-6deg) rotateX(6deg)",
                  "rotateY(11deg) rotateX(-3deg)",
                  "rotateY(-8deg) rotateX(5deg)",
                  "",
                  "rotateY(9deg) rotateX(-4deg)",
                  "rotateY(-7deg) rotateX(3deg)",
                ];
                const baseTransform = transforms[i] || "none";
                const isIntroNameHover = isIntroHoverActive && hoverNameIndex == null && activeHoverNameIndex === i;
                const activePose = isIntroNameHover
                  ? {
                    x: hoverNamePose.x * 0.26,
                    ry: hoverNamePose.ry * 0.3,
                    rx: hoverNamePose.rx * 0.3,
                    rz: hoverNamePose.rz * 0.3,
                    z: hoverNamePose.z * 0.28,
                    y: hoverNamePose.y * 0.28,
                    s: 1 + (hoverNamePose.s - 1) * 0.42,
                  }
                  : hoverNamePose;
                const isHovered = activeHoverNameIndex === i;
                const distance = activeHoverNameIndex == null ? 0 : i - activeHoverNameIndex;
                const absDistance = Math.abs(distance);
                const isNeighbor = activeHoverNameIndex != null && !isHovered && char !== " ";
                const bubbleStrength = isNeighbor ? Math.max(0, 1 - Math.min(Math.abs(distance), 3) / 3) : 0;
                const bubbleX = bubbleStrength ? Math.sign(distance || 1) * (3.1 * bubbleStrength) : 0;
                const bubbleY = bubbleStrength ? -(1.4 * bubbleStrength) : 0;
                const hoverTransform = `${baseTransform} translateX(${activePose.x.toFixed(2)}px) rotateY(${activePose.ry.toFixed(2)}deg) rotateX(${activePose.rx.toFixed(2)}deg) rotateZ(${activePose.rz.toFixed(2)}deg) translateZ(${activePose.z.toFixed(2)}px) translateY(${activePose.y.toFixed(2)}px) scale(${activePose.s.toFixed(3)})`;
                const neighborTransform = `${baseTransform} translateX(${bubbleX.toFixed(2)}px) translateY(${bubbleY.toFixed(2)}px)`;
                const letterTransition = isIntroNameHover
                  ? "transform 1.6s cubic-bezier(0.37, 0, 0.63, 1), color 0.58s ease-in-out, text-shadow 0.58s ease-in-out, font-weight 0.58s ease-in-out"
                  : "transform 0.42s cubic-bezier(0.22, 1.55, 0.36, 1), color 0.2s ease, text-shadow 0.2s ease, font-weight 0.2s ease";
                const grayRamp = isDarkMode
                  ? ["#9f9f9f", "#b2b2b2", "#c5c5c5", "#d8d8d8"]
                  : ["#2f2f2f", "#4a4a4a", "#666666", "#828282"];
                const tonedGray = grayRamp[Math.min(absDistance, grayRamp.length - 1)];
                return (
                  <span
                    key={i}
                    onMouseEnter={() => {
                      setBridgeSide(i === lastNameIndex ? "name" : null);
                      randomizeNamePose();
                      setHoverNameIndex(i);
                    }}
                    style={{
                      display: "inline-block",
                      minWidth: char === " " ? "0.36em" : "0.62em",
                      textAlign: "center",
                      fontWeight: isHovered ? 950 : 900,
                      transformOrigin: "50% 50%",
                      transform: isHovered ? hoverTransform : (isNeighbor ? neighborTransform : baseTransform),
                      color: char === " "
                        ? "inherit"
                        : (activeHoverNameIndex == null ? "inherit" : (isHovered ? "var(--fg)" : tonedGray)),
                      textShadow: isHovered ? "0 0 0.35px currentColor, 0 0 0.35px currentColor" : "none",
                      transition: letterTransition,
                    }}
                  >
                    {char === " " ? "\u00A0" : char}
                  </span>
                );
              })}
            </p>

            <div
              className="site-icons"
              style={{
                display: "flex",
                alignItems: "center",
                perspective: "600px",
                overflow: "visible",
                transform: bridgeSide === "name" ? "translateX(4px)" : "translateX(0)",
                transition: bridgeTransition,
              }}
            >
              {DATA.apps.map((app, i) => {
                const tilts = [
                  { rx: -8, ry: -22, rz: -6 },
                  { rx: 6, ry: -10, rz: 4 },
                  { rx: -4, ry: 14, rz: -3 },
                  { rx: 10, ry: 26, rz: 8 },
                  { rx: -6, ry: -16, rz: 5 },
                  { rx: 8, ry: 18, rz: -4 },
                  { rx: -3, ry: 8, rz: 7 },
                  { rx: 5, ry: -28, rz: -2 },
                ];
                const tilt = tilts[i % tilts.length];
                const isIntroIconHover = isIntroHoverActive && hoverIcon == null && activeHoverIcon === i;
                const isHover = activeHoverIcon === i;
                const isJiggleTarget = jiggleIconIndex === i;
                const isSimulatedHover = hoverIcon == null && launchHoverIcon === i;
                const isJiggling = isJiggleTarget;
                const baseTransform = i === 1
                  ? "rotateX(16deg) rotateY(-30deg) rotateZ(14deg) scale(1.12) translateY(-1px)"
                  : i === 0
                    ? "none"
                    : `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) rotateZ(${tilt.rz}deg)`;
                const hoverTransform = "rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1.55) translateY(-4px)";
                const jiggleAngle = (Math.sin(jiggleTick * 1.35) * 3.8) + (Math.sin(jiggleTick * 0.72) * 1.4);
                const jiggleLift = Math.max(0, Math.sin(jiggleTick * 1.35)) * 1.8;
                const restingTransform = isJiggling
                  ? `${baseTransform} rotateZ(${jiggleAngle.toFixed(2)}deg) translateY(${-jiggleLift.toFixed(2)}px)`
                  : baseTransform;
                const hoverJiggleTransform = `${hoverTransform} rotateZ(${(jiggleAngle * 0.75).toFixed(2)}deg) translateY(${-Math.max(0, jiggleLift * 0.7).toFixed(2)}px)`;
                return (
                  <RouteLink
                    key={app.slug}
                    to={ROUTES.app(app.slug)}
                    navigate={navigate}
                    aria-label={app.name}
                    onMouseEnter={() => {
                      setBridgeSide(i === 0 ? "dock" : null);
                      setHoverIcon(i);
                    }}
                    onMouseLeave={() => {
                      setHoverIcon(null);
                      if (i === 0) setBridgeSide(null);
                    }}
                    style={{
                      width: 32,
                      height: 32,
                      padding: 0,
                      background: "none",
                      borderRadius: 7,
                      marginLeft: i === 0 ? 0 : -7,
                      marginRight: 0,
                      transform: isHover
                        ? ((isJiggling && isSimulatedHover) ? hoverJiggleTransform : hoverTransform)
                        : restingTransform,
                      transformStyle: "preserve-3d",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      flexShrink: 0,
                      position: "relative",
                      boxShadow: isHover
                        ? "0 8px 18px rgba(0,0,0,0.22), 0 2px 4px rgba(0,0,0,0.14)"
                        : "0 4px 8px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.12)",
                      zIndex: isHover ? 20 : DATA.apps.length - i,
                      transition: "transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.18s ease",
                      overflow: "visible",
                    }}
                  >
                    {app.icon && !failedDockIcons.has(app.slug) ? (
                      <img
                        src={resolveAssetUrl(app.icon)}
                        width="32"
                        height="32"
                        alt={app.name}
                        onError={() => {
                          setFailedDockIcons(prev => {
                            if (prev.has(app.slug)) return prev;
                            const next = new Set(prev);
                            next.add(app.slug);
                            return next;
                          });
                        }}
                        style={{ display: "block", borderRadius: 4, pointerEvents: "none" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 4,
                          background: app.bg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "18px",
                          lineHeight: 1,
                          pointerEvents: "none",
                        }}
                        aria-hidden="true"
                      >
                        {app.label}
                      </div>
                    )}
                  </RouteLink>
                );
              })}
            </div>
          </div>
          <CompactThemeToggle theme={theme} onTheme={onTheme} />
        </div>
      </div>

      <div className="main-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 0 }}>
        <div style={{ paddingRight: "40px", marginBottom: "32px" }}>
          <p style={{ fontWeight: 700, marginBottom: "10px" }}>Apps</p>
          {DATA.apps.map((app, i) => (
            <React.Fragment key={app.slug}>
              {app.groupStart && app.groupLabel && (
                <p style={{ color: "var(--mid)", marginTop: "20px", marginBottom: "10px", textTransform: "none" }}>{app.groupLabel}</p>
              )}
              <RouteLink
                to={ROUTES.app(app.slug)}
                navigate={navigate}
                className={"app-row" + (activeHoverIcon === i ? " is-hover" : "")}
                style={{ display: "block", textDecoration: "none", color: "inherit", marginTop: app.groupStart && !app.groupLabel ? "20px" : undefined }}
                onMouseEnter={() => setHoverIcon(i)}
                onMouseLeave={() => setHoverIcon(null)}
              >
                <span style={{ textDecoration: "underline", textDecorationColor: "var(--ul)" }}>{app.name}</span>
                {app.year && <span style={{ color: "var(--mid)" }}> — {app.year}</span>}
                {app.tags && (() => {
                  const homeTags = app.tags
                    .split(" · ")
                    .map(tag => (tag === "Open Source (Contributor)" ? "(Contributor)" : tag))
                    .filter(tag => tag !== "Open Source")
                    .join(" · ");
                  return homeTags ? <span style={{ color: "var(--mid)" }}> · {homeTags}</span> : null;
                })()}
              </RouteLink>
            </React.Fragment>
          ))}
          <figure
            className="hardware-teaser"
            style={{
              margin: (isHardwareTeaserVisible || !isCompactViewport) ? "28px 0 0" : "0",
              maxHeight: (isHardwareTeaserVisible || !isCompactViewport) ? "420px" : "0",
              overflow: (isCompactViewport && !isHardwareTeaserVisible) ? "hidden" : "visible",
              transition: shouldRunSessionIntro && isCompactViewport
                ? `max-height ${hardwareTeaserRevealTransition}, margin ${hardwareTeaserRevealTransition}`
                : "none",
              pointerEvents: isHardwareTeaserVisible ? "auto" : "none",
            }}
          >
            <figcaption
              style={{
                marginBottom: "10px",
                color: "var(--mid)",
                opacity: isHardwareTeaserVisible ? 1 : 0,
                transition: shouldRunSessionIntro ? `opacity ${hardwareTeaserRevealTransition}` : "none",
              }}
            >
              Hardware
            </figcaption>
            <button
              type="button"
              onClick={openHardwareZoom}
              aria-label="Expand Hardware demo video"
              style={{
                appearance: "none",
                display: "block",
                width: "100%",
                padding: 0,
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'%3E%3Ccircle cx='15' cy='15' r='10' fill='white' fill-opacity='0.92' stroke='black' stroke-width='2.4'/%3E%3Cpath d='M22.5 22.5 31 31' stroke='black' stroke-width='3' stroke-linecap='round'/%3E%3Cpath d='M15 10.5v9M10.5 15h9' stroke='black' stroke-width='2.4' stroke-linecap='round'/%3E%3C/svg%3E") 15 15, zoom-in`,
                transform: isHardwareTeaserVisible ? "translateX(0)" : "translateX(calc(-100vw - 40px))",
                transition: shouldRunSessionIntro ? `transform ${hardwareTeaserRevealTransition}` : "none",
              }}
            >
              <div
                ref={hardwareShellRef}
                style={{
                  marginLeft: "-10px",
                  position: "relative",
                  overflow: "hidden",
                  aspectRatio: `${HARDWARE_ASPECT_RATIO}`,
                  borderRadius: "18px",
                  boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
                  background: "color-mix(in srgb, var(--fg) 4%, var(--bg))",
                  border: "1px solid color-mix(in srgb, var(--mid) 16%, transparent)",
                }}
              />
            </button>
          </figure>
        </div>

        <div style={{ paddingRight: "40px", marginBottom: "32px" }}>
          <p style={{ fontWeight: 700, marginBottom: "10px" }}>Writing</p>
          {(() => {
            const capped = DATA.articles.slice(0, 10);
            const groups = [];
            capped.forEach(article => {
              if (groups.length && groups[groups.length - 1].date === article.date) {
                groups[groups.length - 1].items.push(article);
              } else {
                groups.push({ date: article.date, items: [article] });
              }
            });
            return groups.map(group => (
              <div key={group.date} style={{ marginBottom: "20px" }}>
                <p style={{ color: "var(--mid)", marginBottom: "10px", textTransform: "none" }}>{group.date}</p>
                {group.items.map(article => (
                  <RouteLink key={article.slug} to={ROUTES.article(article.slug)} navigate={navigate} className="nav-link nav-link-fit" style={{ marginBottom: "2px" }}>
                    <span className="nav-link-title">{article.title}</span>
                  </RouteLink>
                ))}
              </div>
            ));
          })()}
          {DATA.articles.length > 10 && (
            <RouteLink to={ROUTES.writing} navigate={navigate} className="nav-link nav-link-fit">
              <span className="nav-link-title">View all {DATA.articles.length} articles →</span>
            </RouteLink>
          )}
        </div>

        <div style={{ paddingRight: "40px", marginBottom: "32px" }}>
          <p style={{ fontWeight: 700, marginBottom: "10px" }}>
            <span
              style={{ position: "relative", display: "inline-block", cursor: hasBuildInfo ? "help" : "default" }}
              onMouseEnter={() => {
                if (hasBuildInfo) setIsAboutMetaVisible(true);
              }}
              onMouseLeave={() => setIsAboutMetaVisible(false)}
            >
              About
              {hasBuildInfo && isAboutMetaVisible && (
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "calc(100% + 8px)",
                    background: "var(--bg)",
                    color: "var(--mid)",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    padding: "7px 9px",
                    whiteSpace: "nowrap",
                    fontWeight: 400,
                    fontSize: "12px",
                    lineHeight: 1.3,
                    zIndex: 20,
                    boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
                  }}
                >
                  {buildInfo.label}
                </span>
              )}
            </span>
          </p>
          <p style={{ color: "var(--mid)", maxWidth: "220px" }}>
            iOS &amp; macOS developer in Vancouver. 🍁
          </p>
        </div>

        <div style={{ marginBottom: "32px" }}>
          <p style={{ fontWeight: 700, marginBottom: "10px" }}>Contact</p>
          <p style={{ color: "var(--mid)", marginBottom: "12px" }}>{DATA.location}</p>
          {DATA.links.map(link => (
            <a key={link.label} href={link.url} className="nav-link nav-link-fit" style={{ marginBottom: "2px" }}>
              <span className="nav-link-title">{link.label}</span>
            </a>
          ))}
          <div className="theme-picker-inline" style={{ marginTop: "20px" }}>
            <CompactThemeToggle theme={theme} onTheme={onTheme} alwaysVisible />
          </div>
        </div>
      </div>

      {(isHardwareExpanded || isHardwareTransitioning) && (
        <button
          type="button"
          onClick={closeHardwareZoom}
          aria-label="Close expanded hardware video"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 220,
            border: "none",
            background: "rgba(0,0,0,0.82)",
            padding: 0,
            cursor: "pointer",
            transition: isHardwareTransitioning ? `background ${hardwareZoomTransition}` : "none",
          }}
        />
      )}

      {isHardwareTeaserVisible && hardwareAnimatedRect && (
        <div
          style={{
            position: "fixed",
            left: `${hardwareAnimatedRect.left}px`,
            top: `${hardwareAnimatedRect.top}px`,
            width: `${hardwareAnimatedRect.width}px`,
            height: `${hardwareAnimatedRect.height}px`,
            overflow: "hidden",
            borderRadius: isHardwareExpanded ? "20px" : "18px",
            boxShadow: isHardwareExpanded
              ? "0 24px 80px rgba(0,0,0,0.42)"
              : "0 10px 24px rgba(0,0,0,0.18)",
            background: "#000",
            zIndex: isHardwareExpanded ? 221 : 10,
            pointerEvents: "none",
            transition: isHardwareTransitioning
              ? [
                  `left ${hardwareZoomTransition}`,
                  `top ${hardwareZoomTransition}`,
                  `width ${hardwareZoomTransition}`,
                  `height ${hardwareZoomTransition}`,
                  `border-radius ${hardwareZoomTransition}`,
                  `box-shadow ${hardwareZoomTransition}`,
                ].join(", ")
              : "none",
          }}
        >
          <video
            src={resolveAssetUrl("assets/apps/actuators-demo-1.mov")}
            aria-label="PA Actuator demo video"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              background: "#000",
            }}
          />
        </div>
      )}
    </div>
  );
}

function NotFoundPage({ navigate, theme, onTheme }) {
  return (
    <div style={{ padding: "40px var(--gap)", animation: "fadeUp 0.2s ease", maxWidth: "620px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: "32px" }}>
        <RouteLink to={ROUTES.home} navigate={navigate} style={{ color: "var(--mid)", textDecoration: "underline", textDecorationColor: "var(--ul)" }}>
          ← Home
        </RouteLink>
        <CompactThemeToggle theme={theme} onTheme={onTheme} />
      </div>

      <p style={{ fontWeight: 700, marginBottom: "8px" }}>Page not found</p>
      <p style={{ color: "var(--mid)", marginBottom: "24px" }}>
        The route you requested does not exist.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <RouteLink to={ROUTES.home} navigate={navigate} className="nav-link">
          <span className="nav-link-title">Home</span>
        </RouteLink>
        <RouteLink to={ROUTES.writing} navigate={navigate} className="nav-link">
          <span className="nav-link-title">Writing</span>
        </RouteLink>
      </div>
    </div>
  );
}

function TweaksPanel({ theme, onTheme, font, onFont }) {
  return (
    <div style={{
      position: "fixed",
      bottom: 24,
      right: 24,
      zIndex: 9999,
      background: "var(--bg)",
      border: "1px solid var(--mid)",
      padding: 20,
      width: 220,
      fontSize: 13,
    }}>
      <p style={{ fontWeight: 700, marginBottom: 12 }}>Tweaks</p>

      <p style={{ color: "var(--mid)", marginBottom: 6 }}>Theme</p>
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {["light", "dark", "system"].map(value => (
          <button
            key={value}
            onClick={() => onTheme(value)}
            style={{
              flex: 1,
              padding: "4px 0",
              background: theme === value ? "var(--fg)" : "transparent",
              color: theme === value ? "var(--bg)" : "var(--fg)",
              border: "1px solid var(--mid)",
              cursor: "pointer",
              font: "inherit",
              textTransform: "capitalize",
            }}
          >
            {value}
          </button>
        ))}
      </div>

      <p style={{ color: "var(--mid)", marginBottom: 6 }}>Font</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {FONT_OPTIONS.map(option => (
          <button
            key={option.label}
            onClick={() => onFont(option.label)}
            style={{
              textAlign: "left",
              padding: "6px 8px",
              background: font === option.label ? "var(--fg)" : "transparent",
              color: font === option.label ? "var(--bg)" : "var(--fg)",
              border: "none",
              cursor: "pointer",
              fontFamily: option.stack,
              fontSize: 13,
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CompactThemeToggle({ theme, onTheme, alwaysVisible = false }) {
  const order = ["light", "system", "dark"];
  const items = {
    light: {
      title: "Light",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ),
    },
    system: {
      title: "System",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="14" rx="2" />
          <path d="M8 22h8M12 18v4" />
        </svg>
      ),
    },
    dark: {
      title: "Dark",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ),
    },
  };

  const cur = items[theme] || items.system;
  const cycle = () => {
    const next = order[(order.indexOf(theme) + 1) % order.length];
    onTheme(next);
  };

  return (
    <div className={alwaysVisible ? "compact-theme-wrap" : "compact-theme-wrap compact-only"} style={alwaysVisible ? undefined : { display: "none" }}>
      <button
        onClick={cycle}
        title={`Appearance: ${cur.title}`}
        aria-label={`Appearance: ${cur.title}. Tap to switch.`}
        style={{
          background: "none",
          border: "none",
          padding: 6,
          margin: -6,
          cursor: "pointer",
          color: "var(--fg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          font: "inherit",
          borderRadius: 4,
          transition: "color 0.1s",
        }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--mid)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--fg)")}
      >
        {cur.icon}
      </button>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState(TWEAK_DEFAULTS.theme || "system");
  const [font, setFont] = useState(TWEAK_DEFAULTS.font || "DM Sans");
  const [tweaksVisible, setTweaksVisible] = useState(false);
  const [route, setRoute] = useState(() => resolveRouteFromLocation());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const opt = FONT_OPTIONS.find(o => o.label === font) || FONT_OPTIONS[0];
    document.body.style.fontFamily = opt.stack;
  }, [font]);

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      setRoute(resolveRouteFromLocation());
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  useEffect(() => {
    if (route.kind !== "app") return;
    if (APP_BY_SLUG.has(route.slug)) return;
    const canonicalSlug = APP_ALIAS_TO_SLUG.get(route.slug);
    if (!canonicalSlug) return;
    navigate(ROUTES.app(canonicalSlug), { replace: true });
  }, [route]);

  useEffect(() => {
    const app = route.kind === "app" ? APP_BY_SLUG.get(route.slug) : null;
    const article = route.kind === "article" ? ARTICLE_BY_SLUG.get(route.slug) : null;
    updatePageMetadata(route, app, article);
  }, [route]);

  useEffect(() => {
    const handler = event => {
      if (event.data?.type === "__activate_edit_mode") setTweaksVisible(true);
      if (event.data?.type === "__deactivate_edit_mode") setTweaksVisible(false);
    };
    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  const persist = next => {
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: next }, "*");
  };

  const onTheme = nextTheme => {
    setTheme(nextTheme);
    persist({ theme: nextTheme, font });
  };

  const onFont = nextFont => {
    setFont(nextFont);
    persist({ theme, font: nextFont });
  };

  const navigate = (to, options = {}) => {
    const { replace = false } = options;
    const nextUrl = routeHref(to);
    if (replace) {
      window.history.replaceState({}, "", nextUrl);
    } else {
      window.history.pushState({}, "", nextUrl);
    }
    setRoute(resolveRouteFromLocation());
    if (!nextUrl.includes("#")) window.scrollTo(0, 0);
  };

  let page = null;
  if (route.kind === "home") {
    page = <HomePage navigate={navigate} theme={theme} onTheme={onTheme} onFont={onFont} />;
  } else if (route.kind === "app") {
    const app = APP_BY_SLUG.get(APP_ALIAS_TO_SLUG.get(route.slug) || route.slug);
    page = app ? <AppDetail app={app} navigate={navigate} theme={theme} onTheme={onTheme} /> : <NotFoundPage navigate={navigate} theme={theme} onTheme={onTheme} />;
  } else if (route.kind === "writing") {
    page = <AllArticles navigate={navigate} theme={theme} onTheme={onTheme} />;
  } else if (route.kind === "article") {
    const article = ARTICLE_BY_SLUG.get(route.slug);
    page = article ? <ArticleDetail article={article} navigate={navigate} theme={theme} onTheme={onTheme} routeHash={route.hash} /> : <NotFoundPage navigate={navigate} theme={theme} onTheme={onTheme} />;
  } else {
    page = <NotFoundPage navigate={navigate} theme={theme} onTheme={onTheme} />;
  }

  return (
    <>
      {page}
      {tweaksVisible && <TweaksPanel theme={theme} onTheme={onTheme} font={font} onFont={onFont} />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

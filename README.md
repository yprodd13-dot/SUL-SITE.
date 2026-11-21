# SUL0557 website

This is your whole site: an intro page, a home page, a drum kits page and a museum page for cover arts and edits. A hidden admin panel lets you change everything from the browser.

```
index.html            ← the site (don't need to touch)
assets/               ← styles, scripts, logo, favicon
content/site.json     ← ALL your text, links, kits, gallery, colours, animations
uploads/              ← pictures/videos you add from the admin panel
studio-…/              ← the hidden admin panel (the folder with the random name)
_headers              ← small settings for Cloudflare Pages
```

The kit and gallery pictures in `uploads/` are samples marked "SAMPLE". Replace them in the admin panel.

---

## 1. Put it on GitHub (one time)

1. Go to github.com, click **New repository**, name it (for example `sul-site`), choose **Private** and create it.
2. Click **uploading an existing file**. Drag in everything **inside** this folder (`index.html`, `assets`, the `studio-…` folder, `content`, `uploads`, `_headers`, `README.md`). Then click **Commit changes**.

## 2. Host it free with Cloudflare Pages (one time)

GitHub Pages doesn't allow sites that sell things, so use Cloudflare Pages. It's free, it allows selling, and it updates on its own from your GitHub repo.

1. Make a free account at dash.cloudflare.com.
2. Go to **Workers & Pages → Create → Pages → Connect to Git**, then pick your `sul-site` repo.
3. Build settings: Framework preset **None**, build command **empty**, build output directory **`/`**. Click **Save and Deploy**.
4. Your site is live at `something.pages.dev`. To use your own domain, go to the project → **Custom domains** → add it.

From now on, every change saved to GitHub goes live in about a minute.

## 3. Open the admin panel

There are two ways in:
- **Its secret address:** `yoursite.com/` followed by the name of the `studio-…` folder and a `/`. Bookmark it.
- **From your site:** tap your logo **5 times fast** (top-left or in the footer). On a computer you can also type your secret word anywhere on the page, once you've set one. A password box pops up and takes you straight in.

**First time:** the admin panel asks you to create a password (10+ characters). Then press **🚀 Publish** once. Until you do, the logo taps on your site won't work, but you can always use the secret address.

**Connecting GitHub (once per device):**
1. On GitHub go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - **Repository access:** Only select repositories → `sul-site`
   - **Permissions → Contents:** Read and write
2. In the admin panel go to **🚀 Publish & Settings**, paste your username, repo and token, then click **Save & test connection**. The token is saved on that device, locked with your admin password.

In **Publish & Settings → Admin access & password** you can:
- change your password
- change the number of logo taps or turn them off
- set a secret word
- lock the panel with 🔒

### How safe is it?
- You can't edit anything without the password, and the panel locks again when you close the tab.
- The admin address is stored encrypted in your site's data, so it can't be found by reading the site's code.
- Publishing also needs your GitHub token, which is locked with your password on each device.
- Five wrong passwords in a row slow down further tries.
- Use a strong password you don't use anywhere else.
- For an extra login wall on top of this, you can add **Cloudflare Access** (free) to the admin folder from your Cloudflare dashboard.

### Editing
- **Drum Kits:** each kit's **GO TO link** can point to any page where you sell it (Payhip, Gumroad, Lemon Squeezy, a Stripe payment link, BeatStars, Google Drive).
- **Cover Arts & Edits:** upload pictures and videos (you can select many at once), or paste YouTube links.
- **Pages & Layout, Intro Page, Colors & Fonts, Background, Animations:** everything is editable, and the preview updates as you type.
- **Ctrl+Z** undoes changes. Nothing goes live until you press **🚀 Publish**.
- **No token on a device?** Use **Download update as .zip**, then upload the folders inside it to the repo on github.com.

## Updating the code later (keeps all your settings)

Your design lives in **`content/site.json`** and your files in **`uploads/`**. Everything else is code.

1. In the admin go to **🚀 Publish & Settings → Download backup (.json)** first, just in case.
2. Unzip the update. It only contains code (`index.html`, `assets/`, the `studio-…` admin folder, `README.md`) — **no `content/` or `uploads/`**, so your stuff can't be overwritten.
3. On github.com open your repo → **Add file → Upload files** → drag everything from the update in → **Commit changes**.
4. Wait a minute, then open your admin panel. If the update adds new features it sets them up automatically and asks you to press **🚀 Publish** once.

## What's new in v2
- **Size**: make the whole site bigger/smaller (separately for computers and phones) in **🎨 Size, Colors & Fonts**, or one part at a time with **Size of this section**.
- **🎵 Music Player**: background music with play / pause / skip / volume. Starts when people press PRESS START.
- **🔔 Popups & Updates**: windows that pop up when people open the site (once, once per visit, or every time).
- **🧩 Icons & Button Images**: swap any icon or button for your own picture.
- **Embed** section: paste embed code or a link (YouTube, Spotify, SoundCloud, Bandcamp…). Sites that block embedding (like [untitled]) show as a player card.
- **🎮 PIXEL CONNECT**: a pixel jigsaw game on its own page. Up to 20 pictures, 5–20 pieces, new picture every game.

## What's new in v3
- **TOOLS page** with 8 tools. Each one has a pixel icon that opens its own page (`#/tool/<name>`):
  DITHER LAB, Y2K COVER, GLOW STUDIO, TEXTURE LAB (you pick the textures, visitors scroll through them and choose a blend mode), FX MIXER (30 stackable effects), BG REMOVER (AI plus a quick mode and a touch-up brush), FILE CONVERTER (video and audio to MP3 or WAV; pictures to PNG, JPG, WEBP, BMP, ICO or PDF) and ZIP RENAMER (rename every file in a zip at once with a live preview; works on multi-GB zips because nothing is re-compressed).
- New **Arcade** layout look (numbered sections, holo bars, tilted window). You can switch back under Size, Colors & Fonts → Layout look.
- Admin: a new **🛠 Tools** tab (show or hide tools, rename them, change icons, reorder them, upload textures) and a **Tools** section type you can put on any page.
- All tools run in the visitor's browser and nothing gets uploaded. The AI background remover (@imgly/background-removal) and the MP3 encoder (lamejs) are free open-source libraries that load from jsdelivr.net the first time someone uses them.

### v3.2
- **Dither Lab** now has three types: error diffusion, patterns and halftone. Patterns and halftone dots come in 14 shapes (dots, squares, diamonds, lines, crosses, rings, stars, hearts, triangles, waves, checker and more). You can set pixel size, pattern/dot size, dot fullness and angle, use up to 8 of your own colours or ink & paper, and pick CMYK, RGB or original-colour halftones. There are also tone controls and 10 one-click presets.
- **BG Remover**: the new AI Pro engine uses BiRefNet (MIT licence, loaded with transformers.js), which handles hair and fine detail. If AI Pro can't start it falls back to AI Fast, then to plain-background mode. New refine controls: edge detail (a guided filter), hardness, shrink/grow, soften, remove leftover bits, fill holes and clean edge colours. There's also a smart edge-following brush, undo/redo, zoom up to 4×, result, red-overlay and mask views, extra background fills and a mask download.

## Custom domain (sul4ever.xyz)
The `CNAME` file tells GitHub Pages to serve the site at **sul4ever.xyz**. After uploading it:
1. In the repo, go to **Settings → Pages → Custom domain**, enter `sul4ever.xyz` and press Save.
2. Where you bought the domain, open the DNS settings and add:
   - four **A** records for `@` pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`
   - one **CNAME** record for `www` pointing to `yprodd13-dot.github.io`
3. Wait for DNS to update (from a few minutes up to a day), then tick **Enforce HTTPS** in Settings → Pages.
Your admin will then be at `sul4ever.xyz/studio-…/` (the same secret folder name as before).

## Testing on your computer
If you double-click `index.html`, the site won't load its content, because browsers block that. Run a small local server in this folder instead:
```
python3 -m http.server 8000
```
Then open http://localhost:8000 (and add your `studio-…` folder name to that address for the admin panel).

# VeoCraft AI

A small, beginner-friendly video-creation interface made with **HTML, CSS, and vanilla JavaScript**. It is designed to be uploaded directly to GitHub Pages: no Node.js, React, build step, account, subscriptions, or payment system is required.

> **Important:** GitHub Pages is static hosting. This project does not contain an AI video model or a private API key. With the default configuration, it runs in clearly labeled **Demo Mode** and plays a sample video that was not generated from the prompt. Real AI video generation requires a separate backend connected to a video-generation provider.

## What’s in the project

```text
veocraft-ai/
├── index.html
├── style.css
├── script.js
└── README.md
```

- **`index.html`** — page structure and content
- **`style.css`** — responsive dark/light styling and animations
- **`script.js`** — prompt controls, Demo Mode, saved-video library, local preferences, and the backend API hook
- **`README.md`** — this guide

The sample preview points to the public CC0 flower video hosted by MDN: <https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4>. It needs an internet connection. It is labeled as a demo sample in the interface; it is not a generated result.

## 1. Download the files

Download the project ZIP from the project delivery, then extract it. Alternatively, save the four project files into a folder named `veocraft-ai` while preserving the filenames and structure above.

## 2. Open it locally

1. Open the extracted `veocraft-ai` folder.
2. Double-click `index.html` to open it in a modern browser.
3. Try one of the example prompts and select **Generate video**. The app will display a sample clip in Demo Mode.

Most features work when opened directly from disk. Clipboard and media playback behavior can vary by browser; if anything is restricted, use a local static server or publish with GitHub Pages. No install or build command is needed.

## 3. Upload the files to GitHub

1. Sign in to GitHub and create a new repository (for example, `veocraft-ai`).
2. On the repository page, choose **Add file → Upload files**.
3. Upload `index.html`, `style.css`, `script.js`, and `README.md` to the **repository root** (not inside an extra nested folder).
4. Commit the upload to the default branch, usually `main`.

The HTML references `./style.css` and `./script.js`, so it also works when GitHub Pages serves the project from a repository subpath.

## 4. Enable GitHub Pages

1. Open the repository’s **Settings**.
2. Select **Pages** in the left navigation.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Select branch **`main`** and folder **`/ (root)`**, then select **Save**.
5. Wait for the Pages deployment to finish. The Pages panel will show the site URL, commonly `https://YOUR-USERNAME.github.io/veocraft-ai/`.
6. Open that URL and test the site. After future commits to the selected branch, GitHub Pages will publish the updates.

If you named the repository `YOUR-USERNAME.github.io`, the site is usually at `https://YOUR-USERNAME.github.io/` instead.

## 5. How the API integration is designed

The JavaScript keeps generation logic in one function:

```js
async function generateVideo(prompt, settings) { /* ... */ }
```

By default, `API_ENDPOINT` is an empty string. The function then returns the sample-video URL and marks the result as `mode: 'demo'`. The page explicitly says this is a sample and **not AI-generated**.

To connect a real provider later:

1. Build and deploy a backend API that accepts a prompt and settings.
2. In `script.js`, set `API_ENDPOINT` to your backend's public HTTPS endpoint, for example:

   ```js
   const API_ENDPOINT = 'https://your-backend.example.com/api/videos';
   ```

3. Make the backend accept a JSON `POST` request like:

   ```json
   {
     "prompt": "A cinematic sunset over a futuristic city",
     "settings": {
       "aspectRatio": "16:9",
       "duration": 5,
       "style": "Cinematic",
       "quality": "Standard"
     }
   }
   ```

4. Once the backend finishes generation, return JSON containing a reachable video URL:

   ```json
   { "videoUrl": "https://your-backend.example.com/videos/result.mp4" }
   ```

5. Configure the backend to allow requests from your published GitHub Pages origin (CORS), return useful HTTP error statuses, and provide a video URL that the browser is allowed to play. The frontend expects the complete video to be ready when the JSON response is returned; asynchronous job IDs/polling can be added to `generateVideo()` if your provider works that way.

The frontend sends the prompt and settings to your backend. It does **not** call an AI provider directly. If an endpoint is configured and fails, the app shows an error instead of quietly pretending the demo clip is AI-generated.

## 6. Why secret API keys must stay out of the frontend

Anything shipped to a browser—including HTML, JavaScript, source maps, and network requests—is visible to site visitors. A secret key placed in `script.js`, a public GitHub repository, or a frontend environment variable can be copied and abused. **Never paste a private provider key into this repository.**

Store the provider key as a secret in your backend host's environment-variable/secret manager. The backend should authenticate incoming requests as appropriate, validate prompts/settings, enforce rate limits and usage limits, call the AI provider using the server-side secret, and return only the result URL/status to the browser. A key in frontend code is not made safe by obfuscation or by putting the repository on GitHub Pages.

GitHub Pages cannot run server-side code or keep secrets private. Use a separate backend host or serverless function for the protected API work; connect this frontend to it through the endpoint setting above. The website frontend can stay on GitHub Pages.

## 7. Change the site name, colors, and text

- **Site name and logo:** Search and edit `VeoCraft AI` in `index.html`. The small geometric logo is inline SVG in the `.brand-mark` elements; you can replace that SVG with your own mark.
- **Colors:** Edit the CSS custom properties at the top of `style.css` under `:root`. The light theme overrides are under `:root[data-theme="light"]`.
- **Page copy:** Edit the headings, paragraph text, feature cards, and footer in `index.html`.
- **Example/random prompts:** Edit the `EXAMPLE_PROMPTS` array near the start of `script.js`; update the visible example buttons in `index.html` to match.
- **Video sample:** Change `DEMO_VIDEO_URL` in `script.js` to a sample MP4 you have permission to use. Keep the Demo Mode labels unless the URL is a real, verified result from a connected AI backend.
- **Font:** The site requests Manrope and DM Mono from Google Fonts. If you want no external font request, remove the `@import` line in `style.css`; the system font fallbacks will still work.

## Browser storage and privacy

Saved prompt history, theme preference, and saved video metadata are stored in the visitor’s `localStorage` on that browser/device. They are not uploaded by this static frontend. Clearing browser site data removes them. Video files are **not** copied into localStorage: the app stores their URL, prompt, date, and settings, so the URL must remain accessible for later playback/download.

## License and use

The source code is provided for you to edit and publish. Check the license/terms for any replacement demo media, backend provider, or generated video you connect. The included sample clip is marked CC0 by MDN and is not presented as an AI output.

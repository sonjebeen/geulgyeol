# GeulGyeol (글결)

> An AI-assisted Korean Hangul handwriting coach that improves one repeated habit while preserving the writer's personal style.

## Live Demo

**[Open GeulGyeol in your browser](https://geulgyeol-six.vercel.app/)**

No installation or account is required. The interface opens in English and includes a Korean language toggle.

## What It Does

GeulGyeol asks a learner to write the same Korean sentence three times. Instead of judging the result against a single perfect font, it compares the learner's own attempts and identifies the least stable habit to practice next.

The browser records stroke coordinates, timing, speed, rhythm, spacing, and input type. Character-cell input associates each drawing with the known Hangul character in the practice sentence, so the app can provide character-level feedback without depending on general-purpose OCR. A personal centerline is recalculated from the user's writing on every attempt, including Hangul blocks with a final consonant (batchim).

## Core Features

- Touch, Pencil/stylus, and mouse input
- iPad-friendly responsive handwriting canvas
- Character-cell Hangul input and per-character motion analysis
- Comparison of three handwriting attempts
- Personal centerline, balance, spacing, slant, rhythm, and consistency measurements
- One focused coaching recommendation instead of an overwhelming list of corrections
- Before-and-after practice with an updated score
- English-first interface with Korean localization
- Optional GPT-5.6 vision coaching with an automatic on-device fallback

## How Codex and GPT-5.6 Were Used

### Codex: Product Engineering and Iteration

Codex was used as the primary engineering agent throughout development, with the product direction and testing feedback provided by the creator. It helped turn the original hackathon idea into a working web application by:

- Designing the Next.js and TypeScript application structure
- Implementing Pointer Events for touch, Pencil/stylus, and mouse input
- Building the character-cell canvas, three-attempt workflow, and motion-analysis pipeline
- Developing Hangul-specific correction logic for personal centerlines, syllable balance, and batchim
- Iterating on handwriting recognition and beautification after repeated hands-on testing
- Creating the English/Korean interface, responsive styling, logo, and favicon integration
- Writing and running regression tests, validating production builds, and preparing the GitHub and Vercel deployment

Codex was especially useful for rapid iteration: observations such as “the corrected letters are only being stretched” or “characters with batchim look awkward” were translated into concrete algorithm and interface changes, then tested in the running product.

### GPT-5.6: Optional Vision and Structured Coaching

The project contains a real server-side GPT-5.6 integration in [`app/api/analyze/route.ts`](app/api/analyze/route.ts) using the OpenAI Responses API.

When `OPENAI_API_KEY` is configured:

1. The browser creates a comparison image containing the learner's three attempts.
2. The server sends that image, the Korean practice sentence, and aggregated motion measurements to `gpt-5.6`.
3. GPT-5.6 compares the visual evidence with the motion data and returns feedback through a strict JSON schema.
4. The app presents one recurring issue, supporting evidence, a focused exercise, and an optional character-level finding.

The GPT-5.6 prompt is intentionally constrained. It must preserve stable traits as personal style, avoid guessing a specific character when confidence is low, never infer stroke order from pixels alone, and avoid exaggerated or medical claims. API requests use `store: false`, and the API key remains on the server.

The public demo does not expose a paid API key. If no key is available or the API request fails, GeulGyeol automatically uses its browser-based motion-analysis engine, so the complete practice flow still works for free.

## Built With

- Next.js
- React
- TypeScript
- HTML Canvas and Pointer Events
- CSS
- OpenAI Responses API
- GPT-5.6
- Codex
- Vercel
- GitHub

## Run Locally

Node.js 22.13 or newer is recommended.

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js.

To enable GPT-5.6 coaching, create `.env.local` and add a server-side API key:

```env
OPENAI_API_KEY=your_key_here
```

Never place the API key in browser code or commit it to the repository.

## Project Structure

- `app/page.tsx` — handwriting canvases, input capture, three-attempt analysis, local coaching, and result UI
- `app/api/analyze/route.ts` — optional GPT-5.6 Responses API coaching route
- `app/globals.css` — responsive product interface and iPad layout
- `tests/rendered-html.test.mjs` — rendered-page regression checks
- `vercel.json` — Vercel deployment configuration

## Privacy and Fallback Behavior

Raw pointer-event history is analyzed in the browser and is not stored by this project. In local mode, no handwriting image is sent to an external AI service. In GPT-5.6 mode, a rendered comparison image and aggregated analysis data are sent to the server for that coaching request; the OpenAI request is configured with `store: false`.

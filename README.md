# GeulGyeol (글결)

> A Korean Hangul handwriting coach that improves one repeated habit while preserving the writer's personal style.

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
- Browser-based coaching that works without a paid AI API

## How Codex and GPT-5.6 Were Used

### Codex with GPT-5.6: Product Engineering and Iteration

Codex, using GPT-5.6 as the development model, was the primary engineering tool used to build this project. GPT-5.6 was used through the Codex development environment—not through a separately purchased API key and not as a paid service inside the deployed app. The creator provided the product direction, handwriting tests, and iterative feedback, while Codex helped turn those decisions into a working application by:

- Designing the Next.js and TypeScript application structure
- Implementing Pointer Events for touch, Pencil/stylus, and mouse input
- Building the character-cell canvas, three-attempt workflow, and motion-analysis pipeline
- Developing Hangul-specific correction logic for personal centerlines, syllable balance, and batchim
- Iterating on handwriting recognition and beautification after repeated hands-on testing
- Creating the English/Korean interface, responsive styling, logo, and favicon integration
- Writing and running regression tests, validating production builds, and preparing the GitHub and Vercel deployment

Codex and GPT-5.6 were especially useful for rapid iteration: observations such as “the corrected letters are only being stretched” or “characters with batchim look awkward” were translated into concrete algorithm and interface changes, then tested in the running product.

### Runtime AI Disclosure

No OpenAI API key was purchased or configured for the submitted public demo. The deployed application does not call GPT-5.6, and users do not consume paid OpenAI API tokens. The feedback visible in the live app is produced by the project's browser-based motion-analysis and rule-based coaching logic.

The repository contains an experimental, inactive API adapter in [`app/api/analyze/route.ts`](app/api/analyze/route.ts). It was prepared as a possible future extension, but it is not an external service used by the current deployment. Without an API key, the route returns the already-generated local feedback before making any request to OpenAI. It is therefore not counted as part of the services used in this submission.

In short: **GPT-5.6 helped create the software through Codex; GPT-5.6 is not called by the live software.**

## Built With

- Next.js
- React
- TypeScript
- HTML Canvas and Pointer Events
- CSS
- Codex with GPT-5.6 for development
- Vercel
- GitHub

## Run Locally

Node.js 22.13 or newer is recommended.

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js. No API key is required for the submitted experience.

## Project Structure

- `app/page.tsx` — handwriting canvases, input capture, three-attempt analysis, local coaching, and result UI
- `app/api/analyze/route.ts` — inactive experimental adapter that returns local feedback when no API key is configured
- `app/globals.css` — responsive product interface and iPad layout
- `tests/rendered-html.test.mjs` — rendered-page regression checks
- `vercel.json` — Vercel deployment configuration

## Privacy and Fallback Behavior

Raw pointer-event history is analyzed in the browser and is not stored by this project. The submitted Vercel deployment has no OpenAI API key, so it does not send handwriting images or analysis data to GPT-5.6 or any other external AI service.

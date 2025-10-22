
  # ExamTracker

  This is a code bundle for ExamTracker. The original project is available at https://www.figma.com/design/4fUMXPYWfYXf28hqr9Vqye/ExamTracker.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  
# ExamTracker
## PDF parsing and OCR

- pdfjs-dist: This app uses `pdfjs-dist` to read PDF text. In the browser, a PDF worker is required for performance. The code attempts to set
  `GlobalWorkerOptions.workerSrc` to `pdfjs-dist/build/pdf.worker.min.mjs` at runtime. If your bundler cannot resolve that path,
  configure the worker explicitly in your build setup.

- Tesseract.js: OCR fallback uses `tesseract.js` with languages `swe+eng`. Ensure language data is available when using the CDN or local installation.
  In development without network, install `tesseract.js` locally. In production behind a CDN, verify CORS is set to allow worker and script loads.

- Deep OCR: Enable “Djup OCR” in Settings to OCR-scan all pages (slower, better recall). Quick OCR mode stops as soon as questions are detected.

## Debugging

- When not in production mode (e.g., `VITE_MODE!=='production'`), the PDF parser attaches a `__debug` field to the parsed result with counts and detector info
  (lines built, header/footer filtering, OCR pages attempted).

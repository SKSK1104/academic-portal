# Local Assessment PDF Parser Implementation Plan

Goal: Replace the external assessment PDF parser with browser-local PDF rendering and OCR for UASA and PBD reports.

Architecture: Render each PDF page in the browser with PDF.js, run OCR locally with Tesseract.js, classify UASA/PBD report layouts, extract table cells by coordinates, validate against the authenticated school roster, preview results, then save only confirmed structured results and an optional private source PDF to the Academic Portal Supabase project.

Global constraints: No identifiable assessment PDF is sent to an external AI service. Existing MyKid-based roster matching remains authoritative. UASA stores grades; PBD stores TP1-TP6. PBD summary reports cross-check individual PBD results. Existing public/private access boundaries stay unchanged.

Tasks: add local OCR dependencies; implement page rendering/OCR and SPPB table extraction; switch pdfImport.ts to local parsing before private storage upload; expose parsing progress in Import Center; build on Vercel; test UASA, PBD individual, and PBD summary sample reports; verify no parse-assessment-pdf invocation remains in the browser path.
# Pristine Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Academic Portal 2.0 around the approved **Pristine** light visual direction while preserving live data, URLs and approved workflows.

**Architecture:** Keep the existing React/Vite/Supabase stack and routing. Replace fragile embedded PostgREST relation filtering in teacher analytics with explicit enrolment/assessment/subject queries and client-side joins so class/subject scope is exact. Apply one restrained light design system globally, using the real SK Simpang Kuda crest as the brand anchor and reserving red for intervention only.

**Tech Stack:** React 19, Vite 8, TypeScript 7, Supabase JS, Recharts, Lucide.

**Spec:** Approved conversation mockup direction: one-word visual target **Pristine**.

## Global Constraints

- Keep production URL unchanged.
- Do not wipe or mutate existing student progress/data.
- GitHub `SKSK1104/academic-portal` remains source of truth.
- Use the supplied SK Simpang Kuda crest; do not substitute an initials badge.
- Light theme; warm white/ivory base, deep ink typography, school yellow signature accent, red only for intervention/warnings.
- No rainbow semantic card coding, noisy gradients, tiny typography, generic SaaS glass cards, or collapsible teacher intervention lists.
- Academic scope must be exact for selected year, class, assessment and subject.
- Preserve TOV, AR, ETR, MTM, intervention, attendance, TH, MBPK and future AR rounds.
- PBD keeps equivalent class/subject scoping and TP/intervention analytics.

---

### Task 1: Brand shell and pristine design system
**Files:** Modify `src/components/AppShell.tsx`, `src/styles.css`; create `src/lib/schoolLogo.ts`.
- [ ] Replace synthetic SK badge with supplied crest.
- [ ] Restyle public and teacher shells to the Pristine light system.
- [ ] Increase typography scale and establish square/low-radius editorial panels.
- [ ] Preserve responsive navigation and existing routes.
- [ ] Build through Vercel and verify production readiness.

### Task 2: Academic analysis scope and information architecture
**Files:** Modify `src/pages/AcademicAnalysisPage.tsx`.
- [ ] Query selected enrolments explicitly before marks so class filtering cannot leak school-wide rows.
- [ ] Load subjects explicitly and join client-side; avoid schema-cache relationship aliases.
- [ ] Show Bilangan Calon, Hadir, TH, MBPK, MTM, Intervensi and Purata for the selected subject.
- [ ] Make TOV → AR1 → AR2… → UASA/ETR trajectory the primary visualization.
- [ ] Keep grade distribution readable with counts and percentages.
- [ ] Keep teacher intervention pupils fully visible and use available width.
- [ ] Verify 1 Cahaya + Sains + AR1 resolves to class-level data, not school-wide totals.

### Task 3: PBD parity
**Files:** Modify `src/pages/PbdAnalysisPage.tsx`.
- [ ] Use the same explicit scoping strategy as Academic Analysis.
- [ ] Preserve separate PBD rounds and TP1–TP6 distribution.
- [ ] Show class-level candidate and MBPK summary plus selected-subject MTM/intervention.
- [ ] Keep intervention names openly visible for teachers.
- [ ] Verify build and production deployment.

### Task 4: Operational pages and regression pass
**Files:** Existing teacher/public pages through shared CSS; targeted edits only if required.
- [ ] Confirm Pengisian AR still exposes TOV, AR and ETR and reads existing AR1 data.
- [ ] Confirm Import Data remains functional without reintroducing technical filler copy.
- [ ] Confirm public aggregate pages remain anonymous.
- [ ] Confirm mobile layout does not clip core controls or tables.
- [ ] Final production deployment check and smoke-test accessible routes.

import '../intelligence.css';
import { useEffect, useState } from 'react';
import { MI_COLORS, MI_LABELS, tagCodes, type PsyProfile } from '../lib/intelligence';
import { loadDominantTags } from '../lib/intelligenceData';

// Read-only. Loads tags for the given enrolments; failures just mean no tags.
export function useIntelligenceTags(enrolmentIds: string[]) {
  const [tags, setTags] = useState<Map<string, PsyProfile>>(new Map());
  const key = [...enrolmentIds].sort().join(',');
  useEffect(() => {
    let alive = true;
    loadDominantTags(key ? key.split(',') : []).then((m) => { if (alive) setTags(m); });
    return () => { alive = false; };
  }, [key]);
  return tags;
}

export function IntelligenceTag({ profile }: { profile?: PsyProfile }) {
  const codes = tagCodes(profile);
  if (!codes.length) return null;
  return <span className="mi-tags" title={profile?.format === 'T4_APTITUD' ? 'Kekuatan (Ujian Aptitud Tahun 4)' : 'Kecerdasan dominan'}>
    {codes.map((code) => <span key={code} className="mi-tag" style={{ borderColor: MI_COLORS[code], color: MI_COLORS[code] }}>{MI_LABELS[code]}</span>)}
  </span>;
}

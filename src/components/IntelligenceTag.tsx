import '../intelligence.css';
import { useEffect, useState } from 'react';
import { MI_COLORS, MI_LABELS, isMiProfile, type PsyProfile } from '../lib/intelligence';
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
  if (!profile || !isMiProfile(profile)) return null;
  return <span className="mi-tags" title="Kecerdasan dominan">
    {profile.dominant!.map((code) => <span key={code} className="mi-tag" style={{ borderColor: MI_COLORS[code], color: MI_COLORS[code] }}>{MI_LABELS[code]}</span>)}
  </span>;
}

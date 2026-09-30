import { Component, type ReactNode } from 'react';
import { IntelligenceTag } from './IntelligenceTag';
import type { PsyProfile } from '../lib/intelligence';

// Safety guard: if drawing a tag ever fails, hide just that tag
// instead of letting the error blank the whole analysis page.
class TagGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* tag is optional; ignore */ }
  render() { return this.state.failed ? null : this.props.children; }
}

export function SafeIntelligenceTag({ profile }: { profile?: PsyProfile }) {
  if (!profile) return null;
  return <TagGuard><IntelligenceTag profile={profile} /></TagGuard>;
}

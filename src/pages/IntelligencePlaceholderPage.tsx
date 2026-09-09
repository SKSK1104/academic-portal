import { BrainCircuit } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/PageHeader';

export function IntelligencePlaceholderPage() {
  return <>
    <PageHeader eyebrow="MODUL MASA HADAPAN" title="Kecerdasan Pelbagai" description="Modul ini telah diperuntukkan dalam Portal 2.0 dan tidak menghalang modul lain." />
    <GlassCard className="placeholder-card">
      <BrainCircuit size={44}/><h2>Sedia untuk format sumber</h2>
      <p>Apabila contoh PDF tersedia, parser boleh dipasang pada Import Center tanpa mengubah aliran portal yang lain.</p>
    </GlassCard>
  </>;
}

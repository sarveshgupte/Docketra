import React from 'react';
import { PlatformShell } from '../components/platform/PlatformShell';
import { PageSection } from './platform/PlatformShared';

const READ_ONLY_NOTES = [
  'This is a read-only strategy page. No operational data is created or edited here.',
  'Current implementation is intentionally frontend-only and does not introduce any new backend API dependencies.',
];

const BulletList = ({ items }) => (
  <ul className="list-disc pl-6 text-sm text-[var(--dt-text-muted)] space-y-2">
    {items.map((item) => <li key={item}>{item}</li>)}
  </ul>
);

export const CompanyBrainPage = () => (
  <PlatformShell
    moduleLabel="Firm Memory"
    title="Company Brain"
    subtitle="A living map of your firm’s clients, work, documents, processes, decisions, and institutional memory."
  >
    <PageSection title="Read-only placeholder" description="This landing page explains the Company Brain model and roadmap inside your firm workspace.">
      <BulletList items={READ_ONLY_NOTES} />
    </PageSection>

    <PageSection title="What Company Brain connects">
      <BulletList items={[
        'Clients and prospective clients',
        'Dockets, tasks, deadlines, and review queues',
        'Documents and linked context',
        'SOPs, checklists, templates, and internal instructions',
        'Team members, responsibilities, notes, and decisions',
      ]} />
    </PageSection>

    <PageSection title="How this helps your firm">
      <BulletList items={[
        'Understand what work is pending and why',
        'See client history before acting',
        'Reuse checklists and process knowledge',
        'Reduce dependency on individual memory',
        'Help new team members understand how the firm works',
      ]} />
    </PageSection>

    <PageSection title="Current foundation" description="Today, Docketra already connects core memory-building layers for your firm.">
      <BulletList items={[
        'Work',
        'Clients',
        'Knowledge Intake',
        'Relationships',
        'Reports',
      ]} />
    </PageSection>

    <PageSection title="Coming next">
      <BulletList items={[
        'Client memory views',
        'Knowledge records',
        'Process templates',
        'Linked checklists',
        'Knowledge gaps',
        'Connected client/work maps',
      ]} />
    </PageSection>
  </PlatformShell>
);

export default CompanyBrainPage;

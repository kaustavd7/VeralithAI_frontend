import type { HealSession } from '../../api/types';

interface Props {
  sessions: HealSession[];
}

// §13 pre-commitment — empty body in Phase 0.2; the slot exists above
// DiagnosisHero so Phase 0.2.5 can populate it without page restructure.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function HealHistory(_props: Props) {
  return <></>;
}

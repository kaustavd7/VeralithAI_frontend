import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import styles from './graph.module.css';
import type {
  Claim,
  CompletenessJudgment,
  ContextChunk,
  FaithfulnessJudgment,
  SubQuestion,
  SufficiencyJudgment,
} from '../../api/types';

interface Props {
  query: string;
  subQuestions: SubQuestion[];
  sufficiency: SufficiencyJudgment[];
  claims: Claim[];
  faithfulness: FaithfulnessJudgment[];
  chunks: ContextChunk[];
  completeness: CompletenessJudgment | null | undefined;
}

type Edge = { x1: number; y1: number; x2: number; y2: number; claimId: number; rank: number };
type ClaimStatus = 'grounded' | 'unsupported' | 'extra';

function Caret({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`${styles.caret} ${open ? styles.caretOpen : ''}`} onClick={onClick} aria-label={open ? 'Collapse' : 'Expand'}>
      <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
        <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/* Node-link evidence graph: the query decomposes into sub-question lanes; each
   lane holds the claims answering it (cells), and every grounded claim draws a
   curve to the context chunk that grounds it. Hover a lane, claim, or chunk to
   light up its whole chain. Lanes collapse. */
export function TraceGraph({ query, subQuestions, sufficiency, claims, faithfulness, chunks, completeness }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const claimEls = useRef(new Map<number, HTMLElement>());
  const chunkEls = useRef(new Map<number, HTMLElement>());
  const [edges, setEdges] = useState<Edge[]>([]);
  const [hoverClaim, setHoverClaim] = useState<number | null>(null);
  const [hoverChunk, setHoverChunk] = useState<number | null>(null);
  const [hoverLane, setHoverLane] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const faithByClaim = new Map(faithfulness.map((f) => [f.claim_id, f]));
  const suffBySubQ = new Map(sufficiency.map((s) => [s.sub_question_id, s]));
  const extraSet = new Set(completeness?.extra_claim_ids ?? []);
  const claimIndex = new Map(claims.map((c, i) => [c.id, i]));

  const assign = new Map<number, number | null>();
  const full = completeness?.claim_assignments ?? [];
  if (full.length) {
    for (const a of full) assign.set(a.claim_id, a.sub_question_id);
  } else {
    for (const m of completeness?.mappings ?? []) {
      if (m.covered_by_claim_id != null) assign.set(m.covered_by_claim_id, m.sub_question_id);
    }
    for (const id of extraSet) assign.set(id, null);
  }

  const substantive = claims.filter((c) => c.claim_type !== 'conversational');
  const conv = claims.filter((c) => c.claim_type === 'conversational');
  const lanes = subQuestions.map((sq) => ({
    sq,
    covered: suffBySubQ.get(sq.id)?.verdict === 'Y',
    claims: substantive.filter((c) => assign.get(c.id) === sq.id),
  }));
  const extra = substantive.filter((c) => assign.get(c.id) === null);
  const unattributed = full.length ? [] : substantive.filter((c) => !assign.has(c.id));

  const statusOf = (c: Claim): ClaimStatus => {
    if (faithByClaim.get(c.id)?.verdict === 'N') return 'unsupported';
    if (assign.get(c.id) === null) return 'extra';
    return 'grounded';
  };

  const setClaimEl = useCallback((id: number) => (el: HTMLElement | null) => {
    if (el) claimEls.current.set(id, el); else claimEls.current.delete(id);
  }, []);
  const setChunkEl = useCallback((rank: number) => (el: HTMLElement | null) => {
    if (el) chunkEls.current.set(rank, el); else chunkEls.current.delete(rank);
  }, []);

  const collapsibleKeys: string[] = [];
  lanes.forEach((l) => { if (l.claims.length) collapsibleKeys.push(`q${l.sq.id}`); });
  if (extra.length) collapsibleKeys.push('g-extra');
  if (conv.length) collapsibleKeys.push('g-conv');
  if (unattributed.length) collapsibleKeys.push('g-unattr');
  const isOpen = (k: string) => !collapsed.has(k);
  const toggle = (k: string) => setCollapsed((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  // Measure claim→chunk edges from the DOM (re-runs on resize AND collapse).
  useLayoutEffect(() => {
    const measure = () => {
      const cont = containerRef.current;
      if (!cont) return;
      const cb = cont.getBoundingClientRect();
      const next: Edge[] = [];
      for (const c of claims) {
        const f = faithByClaim.get(c.id);
        if (!f || f.verdict !== 'Y') continue;
        const cel = claimEls.current.get(c.id);
        if (!cel) continue;
        const r = cel.getBoundingClientRect();
        for (const rank of f.grounding_chunk_ranks) {
          const kel = chunkEls.current.get(rank);
          if (!kel) continue;
          const kr = kel.getBoundingClientRect();
          next.push({ x1: r.right - cb.left, y1: r.top + r.height / 2 - cb.top, x2: kr.left - cb.left, y2: kr.top + kr.height / 2 - cb.top, claimId: c.id, rank });
        }
      }
      setEdges(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claims, faithfulness, chunks, subQuestions, completeness, collapsed]);

  const anyHover = hoverClaim !== null || hoverChunk !== null || hoverLane !== null;
  const claimActive = (c: Claim): boolean => {
    if (!anyHover) return true;
    if (hoverClaim === c.id) return true;
    if (hoverLane !== null && assign.get(c.id) === hoverLane) return true;
    if (hoverChunk !== null) return (faithByClaim.get(c.id)?.grounding_chunk_ranks ?? []).includes(hoverChunk);
    return false;
  };
  const chunkActive = (rank: number): boolean => {
    if (!anyHover) return true;
    if (hoverChunk === rank) return true;
    const ids = claims
      .filter((c) => (hoverClaim !== null ? c.id === hoverClaim : hoverLane !== null ? assign.get(c.id) === hoverLane : false))
      .map((c) => c.id);
    return edges.some((e) => e.rank === rank && ids.includes(e.claimId));
  };
  const edgeActive = (e: Edge): boolean => {
    if (hoverClaim !== null) return e.claimId === hoverClaim;
    if (hoverChunk !== null) return e.rank === hoverChunk;
    if (hoverLane !== null) return assign.get(e.claimId) === hoverLane;
    return true;
  };

  const renderClaim = (c: Claim) => {
    const st = statusOf(c);
    const active = claimActive(c);
    return (
      <div
        key={c.id}
        ref={setClaimEl(c.id)}
        className={`${styles.claim} ${styles[st]} ${anyHover ? (active ? styles.on : styles.dim) : ''}`}
        title={c.text}
        onMouseEnter={() => setHoverClaim(c.id)}
        onMouseLeave={() => setHoverClaim(null)}
      >
        <span className={styles.ref}>R{claimIndex.get(c.id)}</span>
        <span className={styles.claimText}>{c.text}</span>
        {st === 'unsupported' && <span className={styles.miniBad}>not in context</span>}
      </div>
    );
  };

  const renderGroup = (key: string, tag: React.ReactNode, label: string, items: Claim[]) => (
    <div className={styles.lane}>
      <div className={styles.laneHead}>
        <Caret open={isOpen(key)} onClick={() => toggle(key)} />
        {tag}
        <span className={styles.qText}>{label}</span>
        <span className={styles.count}>{items.length}</span>
      </div>
      {isOpen(key) && items.map(renderClaim)}
    </div>
  );

  return (
    <div className={styles.wrap}>
      <div className={`${styles.node} ${styles.queryNode}`}>
        <span className={styles.lvlTag}>Query</span>
        <span className={styles.queryText}>{query}</span>
      </div>

      <div className={styles.colHeads}>
        <span>Sub-questions &amp; the claims answering them</span>
        <span>Retrieved context</span>
      </div>

      <div className={styles.container} ref={containerRef}>
        <svg className={styles.edgeLayer} aria-hidden="true">
          {edges.map((e, i) => {
            const dx = Math.max(24, (e.x2 - e.x1) * 0.45);
            return (
              <path
                key={i}
                d={`M ${e.x1} ${e.y1} C ${e.x1 + dx} ${e.y1}, ${e.x2 - dx} ${e.y2}, ${e.x2} ${e.y2}`}
                className={`${styles.edge} ${anyHover ? (edgeActive(e) ? styles.edgeOn : styles.edgeDim) : ''}`}
                fill="none"
              />
            );
          })}
        </svg>

        <div className={styles.lanes}>
          {lanes.map((lane, li) => {
            const key = `q${lane.sq.id}`;
            const hasClaims = lane.claims.length > 0;
            return (
              <div
                key={lane.sq.id}
                className={`${styles.lane} ${lane.covered ? '' : styles.laneMiss}`}
                onMouseEnter={() => setHoverLane(lane.sq.id)}
                onMouseLeave={() => setHoverLane(null)}
              >
                <div className={styles.laneHead}>
                  {hasClaims && <Caret open={isOpen(key)} onClick={() => toggle(key)} />}
                  <span className={styles.qTag}>Q{li}</span>
                  <span className={styles.qText}>{lane.sq.text}</span>
                  <span className={`${styles.cover} ${lane.covered ? styles.coverOk : styles.coverMiss}`}>
                    {lane.covered ? 'covered' : 'not retrieved'}
                  </span>
                </div>
                {hasClaims
                  ? isOpen(key) && lane.claims.map(renderClaim)
                  : <div className={styles.laneEmpty}>No grounded claim answers this — {lane.covered ? 'the model didn’t address it.' : 'retrieval returned nothing.'}</div>}
              </div>
            );
          })}

          {unattributed.length > 0 && renderGroup('g-unattr', <span className={styles.qTagNeutral}>·</span>, 'Supporting the answer', unattributed)}
          {extra.length > 0 && renderGroup('g-extra', <span className={styles.qTagExtra}>+</span>, 'Extra — not asked', extra)}
          {conv.length > 0 && renderGroup('g-conv', <span className={styles.qTagNeutral}>~</span>, 'Not scored — conversational', conv)}
        </div>

        <div className={styles.chunksCol}>
          <div className={styles.chunksLabel}>Context chunks</div>
          {chunks.map((ch) => {
            const active = chunkActive(ch.rank);
            return (
              <div
                key={ch.rank}
                ref={setChunkEl(ch.rank)}
                className={`${styles.chunk} ${anyHover ? (active ? styles.on : styles.dim) : ''}`}
                title={ch.text}
                onMouseEnter={() => setHoverChunk(ch.rank)}
                onMouseLeave={() => setHoverChunk(null)}
              >
                <span className={styles.chunkRef}>#{ch.rank}{ch.source ? ` · ${ch.source}` : ''}</span>
                <span className={styles.chunkText}>{ch.text}</span>
              </div>
            );
          })}
          {chunks.length === 0 && <div className={styles.laneEmpty}>No context retrieved.</div>}
        </div>
      </div>
    </div>
  );
}

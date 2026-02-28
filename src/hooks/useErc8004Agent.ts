import { useState, useEffect, useCallback } from 'react';
import { useWillow } from './useWillow';

// ── Types ──────────────────────────────────────────────────────────────

export interface AgentReputationSummary {
  score: number;
  tier: string;
  checkpoint_success_rate: number;
  verification_accuracy: number;
  active_days: number;
  last_updated: number;
}

export interface AgentRegistrationJson {
  type: string;
  name: string;
  description: string;
  services: { name: string; endpoint: string }[];
  x402_support: boolean;
  active: boolean;
  registrations: { chain_id: number; registry: string; agent_id: number }[];
  supported_trust: string[];
  reputation?: AgentReputationSummary;
}

export interface Erc8004Registration {
  chain_id: number;
  registry_address: number[];
  agent_id: number;
  agent_uri: string;
  registered_at: number;
}

export interface ReputationAttestation {
  did: string;
  score: number;
  tier: string;
  metrics: Record<string, unknown>;
  proof: string;
  block_height: number;
  last_updated: number;
}

export interface ReputationHistoryEvent {
  event_type: string;
  score_delta: number;
  new_score: number;
  block_height: number;
  timestamp: number;
  reference: string | null;
}

export interface ReputationHistoryResponse {
  did: string;
  events: ReputationHistoryEvent[];
  total_events: number;
}

// ── Hook ───────────────────────────────────────────────────────────────

interface UseErc8004AgentResult {
  registration: AgentRegistrationJson | null;
  ethAddress: string | null;
  erc8004Details: Erc8004Registration | null;
  reputationAttestation: ReputationAttestation | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * React hook for fetching ERC-8004 agent information.
 *
 * @param did - The Willow DID to look up. If omitted, no data is fetched.
 */
export function useErc8004Agent(did?: string): UseErc8004AgentResult {
  const { client } = useWillow();
  const [registration, setRegistration] = useState<AgentRegistrationJson | null>(null);
  const [ethAddress, setEthAddress] = useState<string | null>(null);
  const [erc8004Details, setErc8004Details] = useState<Erc8004Registration | null>(null);
  const [reputationAttestation, setReputationAttestation] = useState<ReputationAttestation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!did || !client) return;

    setLoading(true);
    setError(null);

    try {
      const apiUrl = (client as any).apiUrl ?? (client as any).config?.apiUrl ?? '';

      // Fetch ETH address
      const ethResp = await fetch(`${apiUrl}/did/${encodeURIComponent(did)}/eth-address`);
      if (ethResp.ok) {
        const ethBody = await ethResp.json();
        setEthAddress(ethBody.data?.eth_address ?? null);
      } else {
        setEthAddress(null);
      }

      // Fetch ERC-8004 registration details
      const detailsResp = await fetch(`${apiUrl}/did/${encodeURIComponent(did)}/erc8004`);
      if (detailsResp.ok) {
        const detailsBody = await detailsResp.json();
        setErc8004Details(detailsBody.data ?? null);
      } else {
        setErc8004Details(null);
      }

      // Fetch agent registration JSON
      const regResp = await fetch(`${apiUrl}/agent/${encodeURIComponent(did)}/registration.json`);
      if (regResp.ok) {
        const regBody = await regResp.json();
        setRegistration(regBody.data ?? null);
      } else {
        setRegistration(null);
      }

      // Fetch reputation attestation
      const attResp = await fetch(`${apiUrl}/agent/${encodeURIComponent(did)}/reputation-attestation`);
      if (attResp.ok) {
        const attBody = await attResp.json();
        setReputationAttestation(attBody.data ?? null);
      } else {
        setReputationAttestation(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [did, client]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    registration,
    ethAddress,
    erc8004Details,
    reputationAttestation,
    loading,
    error,
    refetch: fetchData,
  };
}

// ── Agent Discovery Types ──────────────────────────────────────────────

export interface AgentReputationBrief {
  score: number;
  tier: string;
}

export interface Erc8004AgentListItem {
  did: string;
  eth_address: string | null;
  agent_uri: string;
  chain_id: number;
  agent_id: number;
  reputation: AgentReputationBrief;
  validation_count: number;
  average_validation_score: number;
  registered_at: number;
}

export interface Erc8004AgentListResponse {
  agents: Erc8004AgentListItem[];
  total: number;
  offset: number;
  limit: number;
}

// ── Agent Discovery Hook ──────────────────────────────────────────────

interface UseErc8004AgentDiscoveryResult {
  agents: Erc8004AgentListItem[];
  total: number;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * React hook for discovering ERC-8004 registered agents.
 *
 * @param options - Optional filters: limit, offset, minScore, tier.
 */
export function useErc8004AgentDiscovery(options?: {
  limit?: number;
  offset?: number;
  minScore?: number;
  tier?: string;
}): UseErc8004AgentDiscoveryResult {
  const { client } = useWillow();
  const [agents, setAgents] = useState<Erc8004AgentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!client) return;

    setLoading(true);
    setError(null);

    try {
      const apiUrl = (client as any).apiUrl ?? (client as any).config?.apiUrl ?? '';
      const params: string[] = [];
      if (options?.limit !== undefined) params.push(`limit=${options.limit}`);
      if (options?.offset !== undefined) params.push(`offset=${options.offset}`);
      if (options?.minScore !== undefined) params.push(`min_score=${options.minScore}`);
      if (options?.tier !== undefined) params.push(`tier=${encodeURIComponent(options.tier)}`);
      const qs = params.length > 0 ? `?${params.join('&')}` : '';

      const resp = await fetch(`${apiUrl}/agents${qs}`);
      if (resp.ok) {
        const body = await resp.json();
        const data = body.data ?? {};
        setAgents(data.agents ?? []);
        setTotal(data.total ?? 0);
      } else {
        setAgents([]);
        setTotal(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [client, options?.limit, options?.offset, options?.minScore, options?.tier]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    agents,
    total,
    loading,
    error,
    refetch: fetchData,
  };
}

// ── Validation Registry Types ──────────────────────────────────────────

export interface Erc8004ValidationRecord {
  request_hash: string;
  subgrove_id: string;
  block_range: [number, number];
  state_root: string;
  response: number;
  status: string;
  tee_verified: boolean;
  tee_type: string | null;
  submitted_at_block: number;
  challenge_deadline: number | null;
  tag: string;
}

export interface Erc8004ValidationStatusResponse {
  did: string;
  validations: Erc8004ValidationRecord[];
  total: number;
}

export interface ValidationStatusBreakdown {
  trusted: number;
  pending_challenge: number;
  tee_attested: number;
  disputed: number;
  invalidated: number;
}

export interface DisputeStats {
  disputes_won_as_defendant: number;
  disputes_lost_as_defendant: number;
  disputes_won_as_challenger: number;
  disputes_lost_as_challenger: number;
}

export interface Erc8004ValidationSummary {
  did: string;
  count: number;
  average_response: number;
  status_breakdown: ValidationStatusBreakdown;
  dispute_stats: DisputeStats;
}

// ── Validation Hook ───────────────────────────────────────────────────

interface UseErc8004ValidationResult {
  validationStatus: Erc8004ValidationStatusResponse | null;
  validationSummary: Erc8004ValidationSummary | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * React hook for fetching ERC-8004 validation data (status + summary).
 *
 * @param did - The Willow DID to look up. If omitted, no data is fetched.
 * @param limit - Max number of validation records to fetch (default 50, max 100).
 * @param subgroveId - Optional subgrove filter.
 */
export function useErc8004Validation(
  did?: string,
  limit?: number,
  subgroveId?: string,
): UseErc8004ValidationResult {
  const { client } = useWillow();
  const [validationStatus, setValidationStatus] = useState<Erc8004ValidationStatusResponse | null>(null);
  const [validationSummary, setValidationSummary] = useState<Erc8004ValidationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!did || !client) return;

    setLoading(true);
    setError(null);

    try {
      const apiUrl = (client as any).apiUrl ?? (client as any).config?.apiUrl ?? '';
      const encodedDid = encodeURIComponent(did);

      // Fetch validation status
      const statusParams: string[] = [];
      if (limit !== undefined) statusParams.push(`limit=${limit}`);
      if (subgroveId !== undefined) statusParams.push(`subgrove_id=${encodeURIComponent(subgroveId)}`);
      const statusQs = statusParams.length > 0 ? `?${statusParams.join('&')}` : '';
      const statusResp = await fetch(`${apiUrl}/agent/${encodedDid}/validation-status${statusQs}`);
      if (statusResp.ok) {
        const statusBody = await statusResp.json();
        setValidationStatus(statusBody.data ?? null);
      } else {
        setValidationStatus(null);
      }

      // Fetch validation summary
      const summaryQs = subgroveId !== undefined ? `?subgrove_id=${encodeURIComponent(subgroveId)}` : '';
      const summaryResp = await fetch(`${apiUrl}/agent/${encodedDid}/validation-summary${summaryQs}`);
      if (summaryResp.ok) {
        const summaryBody = await summaryResp.json();
        setValidationSummary(summaryBody.data ?? null);
      } else {
        setValidationSummary(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [did, client, limit, subgroveId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    validationStatus,
    validationSummary,
    loading,
    error,
    refetch: fetchData,
  };
}

// ── Reputation Hook ────────────────────────────────────────────────────

interface UseErc8004ReputationResult {
  attestation: ReputationAttestation | null;
  history: ReputationHistoryResponse | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * React hook for fetching ERC-8004 reputation data (attestation + history).
 *
 * @param did - The Willow DID to look up. If omitted, no data is fetched.
 * @param historyLimit - Max number of history events to fetch (default 50, max 100).
 */
export function useErc8004Reputation(
  did?: string,
  historyLimit?: number,
): UseErc8004ReputationResult {
  const { client } = useWillow();
  const [attestation, setAttestation] = useState<ReputationAttestation | null>(null);
  const [history, setHistory] = useState<ReputationHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!did || !client) return;

    setLoading(true);
    setError(null);

    try {
      const apiUrl = (client as any).apiUrl ?? (client as any).config?.apiUrl ?? '';
      const encodedDid = encodeURIComponent(did);

      // Fetch attestation
      const attResp = await fetch(`${apiUrl}/agent/${encodedDid}/reputation-attestation`);
      if (attResp.ok) {
        const attBody = await attResp.json();
        setAttestation(attBody.data ?? null);
      } else {
        setAttestation(null);
      }

      // Fetch history
      const limitParam = historyLimit !== undefined ? `?limit=${historyLimit}` : '';
      const histResp = await fetch(`${apiUrl}/agent/${encodedDid}/reputation-history${limitParam}`);
      if (histResp.ok) {
        const histBody = await histResp.json();
        setHistory(histBody.data ?? null);
      } else {
        setHistory(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [did, client, historyLimit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    attestation,
    history,
    loading,
    error,
    refetch: fetchData,
  };
}

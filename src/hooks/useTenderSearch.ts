import { useState, useCallback, useEffect, useRef } from 'react';
import { Sector, Tender, AgentState, TenderSearchState, SupplierProfile } from '@/types/tender';

const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function useTenderSearch() {
  const [state, setState] = useState<TenderSearchState>({
    isSearching: false,
    selectedSector: null,
    supplierProfile: null,
    agents: [],
    tenders: [],
    selectedTenders: new Set(),
  });

  const abortControllersRef = useRef<AbortController[]>([]);
  const timeoutRefsRef = useRef<{
    streamingUrl?: NodeJS.Timeout;
    execution?: NodeJS.Timeout;
  }>({});

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllersRef.current.forEach(c => c.abort());
      if (timeoutRefsRef.current.streamingUrl) clearTimeout(timeoutRefsRef.current.streamingUrl);
      if (timeoutRefsRef.current.execution) clearTimeout(timeoutRefsRef.current.execution);
    };
  }, []);

  const createAgentsFromLinks = (links: string[]): AgentState[] => {
    return links.map((url, index) => {
      let name = 'Unknown Site';
      try {
        const urlObj = new URL(url);
        name = urlObj.hostname.replace('www.', '');
      } catch {
        name = url.substring(0, 30);
      }
      
      return {
        id: `agent-${index}`,
        url: url,
        name: name,
        status: 'pending' as const,
        message: 'Waiting to start...',
        tenders: [],
      };
    });
  };

  const calculateScore = (tender: Tender, profile: SupplierProfile): number => {
    let score = 0;

    // Sector match
    if (tender.industryCategory === profile.sector) {
      score += 50;
    }

    // Country match
    if (tender.countryRegion?.toLowerCase() === profile.country.toLowerCase()) {
      score += 30;
    }

    // Company size match
    if (tender.requiredCompanySize && profile.companySize) {
      if (tender.requiredCompanySize === profile.companySize || tender.requiredCompanySize === 'any') {
        score += 15;
      }
    }

    // Certifications match
    if (tender.requiredCertifications?.length > 0 && profile.certifications) {
      const missingCerts = tender.requiredCertifications.filter(
        (cert: string) => !profile.certifications?.some(
          (pc: string) => pc.toLowerCase() === cert.toLowerCase()
        )
      );
      if (missingCerts.length === 0) {
        score += 10;
      }
    }

    // Deadline bonus
    const deadline = new Date(tender.submissionDeadline);
    const today = new Date();
    const daysRemaining = Math.max(0, Math.floor((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    if (daysRemaining > 0) {
      score += Math.max(0, 20 - daysRemaining);
    }

    // Complexity preference
    if (tender.complexityLevel && profile.companySize) {
      if (profile.companySize === 'SME' && tender.complexityLevel === 'low') {
        score += 5;
      } else if (profile.companySize === 'enterprise' && tender.complexityLevel === 'high') {
        score += 5;
      }
    }

    return score > 0 ? score : 0;
  };

  const analyzeMatch = (tender: Tender, profile: SupplierProfile): { reason: string; missing: string[] } => {
    const missing: string[] = [];
    const reasons: string[] = [];

    if (tender.industryCategory === profile.sector) {
      reasons.push(`Matches your ${profile.sector} sector`);
    } else {
      missing.push(`Sector: ${profile.sector} vs tender ${tender.industryCategory}`);
    }

    if (tender.countryRegion?.toLowerCase() === profile.country.toLowerCase()) {
      reasons.push('Local opportunity');
    } else {
      missing.push(`Country: ${profile.country} vs ${tender.countryRegion}`);
    }

    if (tender.requiredCompanySize && profile.companySize) {
      if (tender.requiredCompanySize === profile.companySize || tender.requiredCompanySize === 'any') {
        reasons.push(`Suitable for ${profile.companySize}s`);
      } else {
        missing.push(`Size requirement: ${tender.requiredCompanySize}`);
      }
    }

    if (tender.requiredCertifications?.length > 0 && profile.certifications) {
      const missingCerts = tender.requiredCertifications.filter(
        (cert: string) => !profile.certifications?.some(
          (pc: string) => pc.toLowerCase() === cert.toLowerCase()
        )
      );
      if (missingCerts.length === 0) {
        reasons.push(`Has all ${tender.requiredCertifications.length} required certs`);
      } else if (missingCerts.length > 0) {
        missing.push(`Need: ${missingCerts.join(', ')}`);
      }
    }

    const daysRemaining = Math.max(0, Math.floor(
      (new Date(tender.submissionDeadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    ));
    if (daysRemaining > 0) {
      reasons.push(`${daysRemaining} days to prepare`);
    }

    return {
      reason: reasons.length > 0 ? reasons.join('; ') : 'Basic match',
      missing: missing,
    };
  };

  const startSearch = useCallback(async (sector: Sector, links: string[], profile: SupplierProfile) => {
    const initialAgents = createAgentsFromLinks(links);
    
    setState(prev => ({
      ...prev,
      isSearching: true,
      selectedSector: sector,
      supplierProfile: profile,
      agents: initialAgents,
      tenders: [],
      selectedTenders: new Set(),
    }));

    const localProfile = profile;

    // Clear any existing abort controllers and timeouts
    abortControllersRef.current.forEach(c => c.abort());
    if (timeoutRefsRef.current.streamingUrl) clearTimeout(timeoutRefsRef.current.streamingUrl);
    if (timeoutRefsRef.current.execution) clearTimeout(timeoutRefsRef.current.execution);
    abortControllersRef.current = [];
    timeoutRefsRef.current = {};

    // Launch all agents in parallel
    const agentPromises = links.map(async (url, index) => {
      const agentId = `agent-${index}`;
      const abortController = new AbortController();
      abortControllersRef.current.push(abortController);
      let connectionTimedOut = false;

      try {
        // Update agent to connecting
        setState(prev => ({
          ...prev,
          agents: prev.agents.map(a =>
            a.id === agentId
              ? { ...a, status: 'connecting', message: 'Connecting to TinyFish...' }
              : a
          ),
        }));

        // Connection timeout (30s)
        const connectionTimeout = setTimeout(() => {
          connectionTimedOut = true;
        }, 30000);

        // Fetch from edge function
        const response = await fetch(`${SUPABASE_URL}/functions/v1/tinyfish-tender-search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ sector, url, agentId }),
          signal: abortController.signal,
        });

        clearTimeout(connectionTimeout);

        if (connectionTimedOut) {
          throw new Error('Connection timeout - agent took too long to start');
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        // Stream processing
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let receivedStreamingUrl = false;

        // Timeout for first STREAMING_URL (60s)
        timeoutRefsRef.current.streamingUrl = setTimeout(() => {
          if (!receivedStreamingUrl) {
            console.warn(`Agent ${agentId}: No streaming URL after 60s`);
            setState(prev => ({
              ...prev,
              agents: prev.agents.map(a =>
                a.id === agentId
                  ? { ...a, status: 'searching', message: 'Processing (no live preview)' }
                  : a
              ),
            }));
          }
        }, 60000);

        // Overall execution timeout (5min)
        timeoutRefsRef.current.execution = setTimeout(() => {
          console.warn(`Agent ${agentId}: Execution timeout after 5min`);
          setState(prev => ({
            ...prev,
            agents: prev.agents.map(a =>
              a.id === agentId
                ? { ...a, status: 'complete', message: 'Timed out - incomplete results', tenders: a.tenders || [] }
                : a
            ),
          }));
          abortController.abort();
        }, 300000);

        if (!reader) {
          throw new Error('No response body reader');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(line.slice(6));

              // STARTED event
              if (data.type === 'STARTED') {
                setState(prev => ({
                  ...prev,
                  agents: prev.agents.map(a =>
                    a.id === agentId
                      ? { ...a, status: 'connecting', message: 'Agent started, browsing...' }
                      : a
                  ),
                }));
                continue;
              }

              // STREAMING_URL event
              if (data.type === 'STREAMING_URL' && data.streamingUrl) {
                receivedStreamingUrl = true;
                if (timeoutRefsRef.current.streamingUrl) {
                  clearTimeout(timeoutRefsRef.current.streamingUrl);
                  timeoutRefsRef.current.streamingUrl = undefined;
                }
                setState(prev => ({
                  ...prev,
                  agents: prev.agents.map(a =>
                    a.id === agentId
                      ? { ...a, status: 'searching', message: 'Browsing website...', streamingUrl: data.streamingUrl }
                      : a
                  ),
                }));
                continue;
              }

              // STATUS event (from PROGRESS)
              if (data.type === 'STATUS' && data.message) {
                setState(prev => ({
                  ...prev,
                  agents: prev.agents.map(a =>
                    a.id === agentId ? { ...a, message: data.message } : a
                  ),
                }));
                continue;
              }

              // COMPLETE event
              if (data.type === 'COMPLETE') {
                if (timeoutRefsRef.current.execution) {
                  clearTimeout(timeoutRefsRef.current.execution);
                  timeoutRefsRef.current.execution = undefined;
                }

                let tenders: any[] = [];
                const resultData = data.result || data.tenders;

                if (resultData) {
                  if (typeof resultData === 'string') {
                    try {
                      const jsonMatch = resultData.match(/```json\s*([\s\S]*?)\s*```/) ||
                                        resultData.match(/```\s*([\s\S]*?)\s*```/);
                      const parsed = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(resultData);
                      resultData = parsed;
                    } catch (e) {
                      console.error(`Agent ${agentId}: Failed to parse result`, e);
                      resultData = null;
                    }
                  }

                  if (resultData?.tenderdetails && Array.isArray(resultData.tenderdetails)) {
                    tenders = resultData.tenderdetails;
                  } else if (Array.isArray(resultData)) {
                    tenders = resultData;
                  }
                }

                const newTenders: Tender[] = tenders.map((t: any) => ({
                  id: generateId(),
                  tenderTitle: t['Tender Title'] || t.tenderTitle || 'Unknown',
                  tenderId: t['Tender ID'] || t.tenderId || 'N/A',
                  issuingAuthority: t['Issuing Authority'] || t.issuingAuthority || 'Unknown',
                  countryRegion: t['Country / Region'] || t.countryRegion || 'Singapore',
                  tenderType: t['Tender Type'] || t.tenderType || 'N/A',
                  publicationDate: t['Publication Date'] || t.publicationDate || 'N/A',
                  submissionDeadline: t['Submission Deadline'] || t.submissionDeadline || 'N/A',
                  tenderStatus: t['Tender Status'] || t.tenderStatus || 'Open',
                  officialTenderUrl: t['Official Tender URL'] || t.officialTenderUrl || url,
                  briefDescription: t['Brief Description'] || t.briefDescription || 'No description',
                  eligibilityCriteria: t['Eligibility Criteria'] || t.eligibilityCriteria || 'See tender',
                  industryCategory: t['Industry / Category'] || t.industryCategory || sector,
                  sourceUrl: url,
                  complexityLevel: t['Complexity Level'] || t.complexityLevel,
                  requiredCompanySize: t['Required Company Size'] || t.requiredCompanySize,
                  requiredCertifications: t['Required Certifications'] || t.requiredCertifications || [],
                  evaluationCriteria: t['Evaluation Criteria'] || t.evaluationCriteria,
                  scopeOfWork: t['Scope of Work'] || t.scopeOfWork,
                  estimatedContractValue: t['Estimated Contract Value'] || t.estimatedContractValue || null,
                }));

                const scoredTenders = newTenders.map(tender => ({
                  ...tender,
                  score: localProfile ? calculateScore(tender, localProfile) : 1,
                  matchReason: localProfile ? analyzeMatch(tender, localProfile).reason : '',
                  missingRequirements: localProfile ? analyzeMatch(tender, localProfile).missing : [],
                }));

                setState(prev => ({
                  ...prev,
                  tenders: [...prev.tenders, ...scoredTenders],
                  agents: prev.agents.map(a =>
                    a.id === agentId
                      ? { ...a, status: 'complete', message: `Found ${scoredTenders.length} tenders`, tenders: scoredTenders }
                      : a
                  ),
                }));
                continue;
              }

              // ERROR event
              if (data.type === 'ERROR') {
                if (timeoutRefsRef.current.execution) {
                  clearTimeout(timeoutRefsRef.current.execution);
                  timeoutRefsRef.current.execution = undefined;
                }
                setState(prev => ({
                  ...prev,
                  agents: prev.agents.map(a =>
                    a.id === agentId
                      ? { ...a, status: 'error', message: data.error || 'Unknown error' }
                      : a
                  ),
                }));
                continue;
              }

              // DONE event
              if (data.type === 'DONE') {
                if (timeoutRefsRef.current.execution) {
                  clearTimeout(timeoutRefsRef.current.execution);
                  timeoutRefsRef.current.execution = undefined;
                }
                setState(prev => ({
                  ...prev,
                  agents: prev.agents.map(a =>
                    a.id === agentId && a.status === 'searching'
                      ? { ...a, status: 'complete', message: 'Search complete' }
                      : a
                  ),
                }));
                continue;
              }

            } catch (e) {
              // Skip malformed lines
              if (e instanceof Error && e.message.includes('aborted')) {
                throw e; // re-throw abort errors
              }
              console.error(`Agent ${agentId}: Parse error`, e);
            }
          }
        }

      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log(`Agent ${agentId} aborted`);
          return;
        }

        console.error(`Agent ${agentId} error:`, error);
        setState(prev => ({
          ...prev,
          agents: prev.agents.map(a =>
            a.id === agentId
              ? { ...a, status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }
              : a
          ),
        }));
      }
    });

    await Promise.allSettled(agentPromises);

    // Final cleanup
    abortControllersRef.current.forEach(c => c.abort());
    if (timeoutRefsRef.current.streamingUrl) clearTimeout(timeoutRefsRef.current.streamingUrl);
    if (timeoutRefsRef.current.execution) clearTimeout(timeoutRefsRef.current.execution);

    setState(prev => ({ ...prev, isSearching: false }));
  }, []);

  const toggleTenderSelection = useCallback((tenderId: string) => {
    setState(prev => {
      const newSelected = new Set(prev.selectedTenders);
      if (newSelected.has(tenderId)) {
        newSelected.delete(tenderId);
      } else {
        newSelected.add(tenderId);
      }
      return { ...prev, selectedTenders: newSelected };
    });
  }, []);

  const clearSelection = useCallback(() => {
    setState(prev => ({ ...prev, selectedTenders: new Set() }));
  }, []);

  const resetSearch = useCallback(() => {
    abortControllersRef.current.forEach(c => c.abort());
    if (timeoutRefsRef.current.streamingUrl) clearTimeout(timeoutRefsRef.current.streamingUrl);
    if (timeoutRefsRef.current.execution) clearTimeout(timeoutRefsRef.current.execution);
    abortControllersRef.current = [];
    timeoutRefsRef.current = {};
    setState({
      isSearching: false,
      selectedSector: null,
      supplierProfile: null,
      agents: [],
      tenders: [],
      selectedTenders: new Set(),
    });
  }, []);

  return {
    ...state,
    startSearch,
    toggleTenderSelection,
    clearSelection,
    resetSearch,
  };
}

import { useState, useCallback, useRef } from 'react';
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

  const createAgentsFromLinks = (links: string[]): AgentState[] => {
    return links.map((url, index) => {
      // Extract domain name for display
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
    const missingRequirements: string[] = [];

    // Sector match: highest weight
    if (tender.industryCategory === profile.sector) {
      score += 50;
    } else {
      missingRequirements.push('Industry sector mismatch');
    }

    // Country match: important
    if (tender.countryRegion.toLowerCase() === profile.country.toLowerCase()) {
      score += 30;
    } else {
      missingRequirements.push('Country/region mismatch');
    }

    // Company size match
    if (tender.requiredCompanySize && profile.companySize) {
      if (tender.requiredCompanySize === profile.companySize || tender.requiredCompanySize === 'any') {
        score += 15;
      } else {
        missingRequirements.push(`Company size: ${profile.companySize} vs required ${tender.requiredCompanySize}`);
      }
    }

    // Certifications match
    if (tender.requiredCertifications && tender.requiredCertifications.length > 0 && profile.certifications) {
      const missingCerts = tender.requiredCertifications.filter(
        (cert: string) => !profile.certifications?.some(
          (pc: string) => pc.toLowerCase() === cert.toLowerCase()
        )
      );
      if (missingCerts.length === 0) {
        score += 10;
      } else {
        missingRequirements.push(`Missing certifications: ${missingCerts.join(', ')}`);
      }
    }

    // Deadline bonus: sooner deadline gets more points (inverse of days remaining)
    const deadline = new Date(tender.submissionDeadline);
    const today = new Date();
    const daysRemaining = Math.max(0, Math.floor((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    if (daysRemaining > 0) {
      score += Math.max(0, 20 - daysRemaining); // Max 20 points for immediate deadlines
    } else {
      missingRequirements.push('Deadline has passed');
    }

    // Complexity preference: SMEs may prefer low complexity, enterprises can handle high
    if (tender.complexityLevel && profile.companySize) {
      if (profile.companySize === 'SME' && tender.complexityLevel === 'low') {
        score += 5;
      } else if (profile.companySize === 'enterprise' && tender.complexityLevel === 'high') {
        score += 5;
      }
    }

    // Ensure minimum score of 1 for non-zero matches
    if (score > 0) score = Math.max(1, score);

    return score;
  };

  const analyzeMatch = (tender: Tender, profile: SupplierProfile): { reason: string; missing: string[] } => {
    const missing: string[] = [];
    const reasons: string[] = [];

    if (tender.industryCategory === profile.sector) {
      reasons.push(`Matches your ${profile.sector} sector`);
    } else {
      missing.push(`Sector: ${profile.sector} vs tender ${tender.industryCategory}`);
    }

    if (tender.countryRegion.toLowerCase() === profile.country.toLowerCase()) {
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

    if (tender.requiredCertifications && tender.requiredCertifications.length > 0 && profile.certifications) {
      const missingCerts = tender.requiredCertifications.filter(
        (cert: string) => !profile.certifications?.some(
          (pc: string) => pc.toLowerCase() === cert.toLowerCase()
        )
      );
      if (missingCerts.length === 0 && tender.requiredCertifications.length > 0) {
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
    // Initialize agents from provided links
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

    // Store profile locally for scoring (avoid closure staleness)
    const localProfile = profile;

    // Clear any existing abort controllers
    abortControllersRef.current.forEach(controller => controller.abort());
    abortControllersRef.current = [];

    // Launch all agents in parallel with SSE streaming
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
              ? { ...a, status: 'connecting' as const, message: 'Connecting to TinyFish...' }
              : a
          ),
        }));

        // Set a timeout for connection (30 seconds)
        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => {
            connectionTimedOut = true;
            resolve({ type: 'TIMEOUT', agentId });
          }, 30000);
        });

        // Use fetch with SSE streaming
        const fetchPromise = fetch(`${SUPABASE_URL}/functions/v1/tinyfish-tender-search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            sector,
            url: url,
            agentId,
          }),
          signal: abortController.signal,
        });

        const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

        // Check if timeout occurred
        if (connectionTimedOut) {
          throw new Error('Connection timeout - agent took too long to start');
        }

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let receivedStreamingUrl = false;

        // Set a timeout for receiving the first STREAMING_URL event (60 seconds)
        const streamingUrlTimeout = setTimeout(() => {
          if (!receivedStreamingUrl) {
            console.warn(`Agent ${agentId}: No streaming URL received after 60 seconds, continuing without live preview`);
            setState(prev => ({
              ...prev,
              agents: prev.agents.map(a =>
                a.id === agentId
                  ? {
                      ...a,
                      status: 'searching' as const,
                      message: 'Processing (no live preview available)',
                    }
                  : a
              ),
            }));
          }
        }, 60000);

        // Set an overall execution timeout (5 minutes) to prevent agents from running forever
        const executionTimeout = setTimeout(() => {
          console.warn(`Agent ${agentId}: Execution timeout after 5 minutes`);
          setState(prev => ({
            ...prev,
            agents: prev.agents.map(a =>
              a.id === agentId
                ? {
                    ...a,
                    status: 'complete' as const,
                    message: 'Timed out - incomplete results',
                    tenders: a.tenders || [],
                  }
                : a
            ),
          }));
          // Force close the reader
          abortController.abort();
        }, 300000);

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  // Handle streaming URL - show live preview immediately
                  if (data.type === 'STREAMING_URL' && data.streamingUrl) {
                    receivedStreamingUrl = true;
                    clearTimeout(streamingUrlTimeout);
                    console.log(`Agent ${agentId} received streaming URL:`, data.streamingUrl);
                    setState(prev => ({
                      ...prev,
                      agents: prev.agents.map(a =>
                        a.id === agentId
                          ? {
                              ...a,
                              status: 'searching' as const,
                              message: 'Browsing website...',
                              streamingUrl: data.streamingUrl,
                            }
                          : a
                      ),
                    }));
                  }

                  // Handle status updates
                  if (data.type === 'STATUS' && data.message) {
                    setState(prev => ({
                      ...prev,
                      agents: prev.agents.map(a =>
                        a.id === agentId
                          ? { ...a, message: data.message }
                          : a
                      ),
                    }));
                  }

                   // Handle completion with tenders
                   if (data.type === 'COMPLETE' && data.tenders) {
                     // eslint-disable-next-line @typescript-eslint/no-explicit-any
                     const newTenders: Tender[] = data.tenders.map((t: any) => ({
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
                       // New classification fields
                       complexityLevel: t['Complexity Level'] || t.complexityLevel,
                       requiredCompanySize: t['Required Company Size'] || t.requiredCompanySize,
                       requiredCertifications: t['Required Certifications'] || t.requiredCertifications || [],
                       evaluationCriteria: t['Evaluation Criteria'] || t.evaluationCriteria,
                       scopeOfWork: t['Scope of Work'] || t.scopeOfWork,
                       estimatedContractValue: t['Estimated Contract Value'] || t.estimatedContractValue || null,
                     }));

                     // Calculate scores and match analysis for each tender based on supplier profile
                     const scoredTenders = newTenders.map(tender => {
                       const score = localProfile ? calculateScore(tender, localProfile) : 1;
                       const analysis = localProfile ? analyzeMatch(tender, localProfile) : { reason: '', missing: [] };
                       return {
                         ...tender,
                         score,
                         matchReason: analysis.reason,
                         missingRequirements: analysis.missing,
                       };
                     });

                     clearTimeout(executionTimeout);
                     setState(prev => ({
                       ...prev,
                       tenders: [...prev.tenders, ...scoredTenders],
                       agents: prev.agents.map(a =>
                         a.id === agentId
                           ? {
                               ...a,
                               status: 'complete' as const,
                               message: `Found ${scoredTenders.length} tenders`,
                               tenders: scoredTenders,
                             }
                           : a
                       ),
                     }));
                   }

                 // Handle errors
                 if (data.type === 'ERROR') {
                   clearTimeout(executionTimeout);
                    clearTimeout(streamingUrlTimeout);
                    setState(prev => ({
                      ...prev,
                      agents: prev.agents.map(a =>
                        a.id === agentId
                          ? {
                              ...a,
                              status: 'error' as const,
                              message: data.error || 'Unknown error',
                            }
                          : a
                      ),
                    }));
                  }

                  // Handle done
                  if (data.type === 'DONE') {
                    clearTimeout(streamingUrlTimeout);
                    clearTimeout(executionTimeout);
                    setState(prev => ({
                      ...prev,
                      agents: prev.agents.map(a =>
                        a.id === agentId && a.status === 'searching'
                          ? {
                              ...a,
                              status: 'complete' as const,
                              message: 'Search complete',
                            }
                          : a
                      ),
                    }));
                  }
                } catch (e) {
                  // Ignore parsing errors
                }
              }
            }
          }
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          console.log(`Agent ${agentId} aborted`);
          return;
        }
        console.error(`Agent ${agentId} error:`, error);
        setState(prev => ({
          ...prev,
          agents: prev.agents.map(a =>
            a.id === agentId
              ? {
                  ...a,
                  status: 'error' as const,
                  message: error instanceof Error ? error.message : 'Unknown error',
                }
              : a
          ),
        }));
      }
    });

    // Wait for all agents to complete
    await Promise.allSettled(agentPromises);

    setState(prev => ({
      ...prev,
      isSearching: false,
    }));
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
    abortControllersRef.current.forEach(controller => controller.abort());
    abortControllersRef.current = [];
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

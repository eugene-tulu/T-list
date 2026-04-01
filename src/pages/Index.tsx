import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Header } from '@/components/tender/Header';
import { SectorSelector } from '@/components/tender/SectorSelector';
import { SupplierProfileForm } from '@/components/tender/SupplierProfileForm';
import { LinkConfigPage } from '@/components/tender/LinkConfigPage';
import { AgentPreviewGrid } from '@/components/tender/AgentPreviewGrid';
import { TenderResultsList } from '@/components/tender/TenderResultsList';
import { CompareButton } from '@/components/tender/CompareButton';
import { CompareModal } from '@/components/tender/CompareModal';
import { useTenderSearch } from '@/hooks/useTenderSearch';
import { useSupplierProfile } from '@/hooks/useSupplierProfile';
import { Sector, SupplierProfile } from '@/types/tender';

type ViewState = 'supplier-profile' | 'config' | 'search';

const Index = () => {
  const {
    isSearching,
    selectedSector,
    agents,
    tenders,
    selectedTenders,
    startSearch,
    toggleTenderSelection,
    clearSelection,
    resetSearch,
  } = useTenderSearch();

  const { profile: savedProfile, saveProfile, loading: profileLoading } = useSupplierProfile();

  const [view, setView] = useState<ViewState>('supplier-profile');
  const [pendingProfile, setPendingProfile] = useState<SupplierProfile | null>(null);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // Use saved profile if available and no pending profile
  useEffect(() => {
    if (!pendingProfile && savedProfile && view === 'supplier-profile') {
      setPendingProfile(savedProfile);
    }
  }, [savedProfile, pendingProfile, view]);

  const selectedTendersList = tenders.filter(t => selectedTenders.has(t.id));

  // Sort tenders by score (highest first)
  const sortedTenders = useMemo(() => {
    return [...tenders].sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [tenders]);

  const handleBackToForm = () => {
    setPendingProfile(null);
    setView('supplier-profile');
  };

  const handleSupplierProfileComplete = async (profile: SupplierProfile) => {
    // Save profile to Supabase
    await saveProfile(profile);
    setPendingProfile(profile);
    setView('config');
  };

  const handleStartSearchWithLinks = (links: string[]) => {
    if (pendingProfile) {
      startSearch(pendingProfile.sector, links, pendingProfile);
      setView('search');
    }
  };

  const handleReset = () => {
    resetSearch();
    setPendingProfile(null);
    setView('supplier-profile');
  };

  const handleCompare = () => {
    setIsCompareOpen(true);
  };

  const handleCloseCompare = () => {
    setIsCompareOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="py-8">
        <AnimatePresence mode="wait">
          {view === 'supplier-profile' && (
            <SupplierProfileForm
              key="supplier-profile"
              sector={null}
              onBack={() => {}}
              onComplete={handleSupplierProfileComplete}
            />
          )}

          {view === 'config' && pendingProfile && (
            <LinkConfigPage
              key="config"
              sector={pendingProfile.sector}
              onBack={handleBackToForm}
              onStartSearch={handleStartSearchWithLinks}
            />
          )}

          {view === 'search' && selectedSector && (
            <div key="results" className="space-y-8">
              {/* Back Button */}
              <div className="max-w-7xl mx-auto px-4">
                <button
                  onClick={handleReset}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
                >
                  ← Start new search
                </button>
              </div>

              {/* Agent Preview Grid */}
              <AgentPreviewGrid
                agents={agents}
                sector={selectedSector}
              />

              {/* Results List */}
              <TenderResultsList
                tenders={sortedTenders}
                selectedTenders={selectedTenders}
                onToggleSelect={toggleTenderSelection}
                isSearching={isSearching}
              />

              {/* Empty state when no results yet */}
              {!isSearching && tenders.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    No tenders found. Try different links or sector.
                  </p>
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Compare Button - only show when we have results */}
      {tenders.length > 0 && (
        <CompareButton
          selectedCount={selectedTenders.size}
          onCompare={handleCompare}
        />
      )}

      {/* Compare Modal */}
      <CompareModal
        isOpen={isCompareOpen}
        onClose={handleCloseCompare}
        tenders={selectedTendersList}
      />
    </div>
  );
};

export default Index;

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Globe, 
  Loader2,
  Search,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sector } from '@/types/tender';

interface LinkConfigPageProps {
  sector: Sector;
  onBack: () => void;
  onStartSearch: (links: string[]) => void;
}

export function LinkConfigPage({ sector, onBack, onStartSearch }: LinkConfigPageProps) {
  const [isSearching, setIsSearching] = useState(false);

  // Universal tender portals from around the world
  const PORTALS = [
    { name: 'TendersOnTime', url: 'https://www.tendersontime.com/', description: 'Global tender database covering 100+ countries' },
    { name: 'BidDetail', url: 'https://www.biddetail.com/', description: 'International procurement opportunities' },
    { name: 'Devex', url: 'https://www.devex.com/', description: 'Global development and aid tenders' },
  ];

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 500));
      onStartSearch(PORTALS.map(p => p.url));
    } catch (error) {
      console.error('Error starting search:', error);
      onStartSearch(PORTALS.map(p => p.url));
    } finally {
      setIsSearching(false);
    }
  };

  const isLoading = isSearching;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-3xl mx-auto px-4 py-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onBack}
          className="hover:bg-primary/10"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Data Sources</h2>
          <p className="text-muted-foreground">
            Searching <span className="text-primary font-medium">{sector}</span> tenders from these universal portals
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Portal List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <div className="space-y-4">
            {PORTALS.map((portal, index) => (
              <div 
                key={index}
                className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 border border-border"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">{portal.name}</h4>
                  <p className="text-sm text-muted-foreground mb-2">{portal.description}</p>
                  <a 
                    href={portal.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {portal.url}
                  </a>
                </div>
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Search Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex justify-end"
        >
          <Button 
            onClick={handleSearch}
            disabled={isLoading}
            size="lg"
            className="min-w-[200px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting Search...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Start Search
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}

import { motion } from 'framer-motion';
import { Tender } from '@/types/tender';
import { Calendar, Building2, FileText, ExternalLink, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DailyBriefPanelProps {
  tenders: Tender[];
}

export function DailyBriefPanel({ tenders }: DailyBriefPanelProps) {
  // Get top 3 tenders by score
  const topTenders = [...tenders]
    .filter(t => t.score && t.score > 0)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 3);

  if (topTenders.length === 0) {
    return null;
  }

  const getScoreColor = (score: number) => {
    if (score >= 60) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 30) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 60) return 'Excellent Match';
    if (score >= 30) return 'Good Match';
    return 'Fair Match';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-7xl mx-auto px-4 mb-8"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/20 rounded-lg">
          <Star className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Your Daily Brief</h2>
          <p className="text-sm text-muted-foreground">
            Top {topTenders.length} matched opportunities for today
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {topTenders.map((tender, index) => (
          <motion.div
            key={tender.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white border-2 border-primary/20 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Header with title and score */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h3 className="text-lg font-bold text-foreground leading-tight">
                    {tender.tenderTitle}
                  </h3>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Badge 
                      variant="outline"
                      className={cn("text-sm font-semibold px-3 py-1", getScoreColor(tender.score || 0))}
                    >
                      {tender.score}% Match
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {getScoreLabel(tender.score || 0)}
                    </span>
                  </div>
                </div>

                {/* Meta info */}
                <div className="flex flex-wrap gap-4 mb-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span>{tender.issuingAuthority}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Deadline: {tender.submissionDeadline}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {tender.industryCategory}
                  </Badge>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {tender.briefDescription}
                </p>

                {/* Action */}
                <a
                  href={tender.officialTenderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  View Full Tender Details
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

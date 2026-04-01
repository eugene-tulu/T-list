import { motion } from 'framer-motion';
import { Calendar, Building2, FileText, ExternalLink, CheckCircle2, Target, AlertCircle } from 'lucide-react';
import { Tender } from '@/types/tender';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface TenderResultCardProps {
  tender: Tender;
  isSelected: boolean;
  onToggleSelect: () => void;
}

export function TenderResultCard({ tender, isSelected, onToggleSelect }: TenderResultCardProps) {
  const score = tender.score || 0;
  const scorePercentage = Math.min(score, 100); // Cap at 100 for display
  
  // Determine score color
  const getScoreColor = () => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressColor = () => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      onClick={onToggleSelect}
      className={cn(
        "relative cursor-pointer rounded-xl border-2 p-4 transition-all duration-200",
        "bg-white hover:shadow-lg",
        isSelected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border hover:border-primary/50"
      )}
    >
      {/* Selection Indicator */}
      <div className={cn(
        "absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
        isSelected
          ? "bg-primary border-primary"
          : "bg-white border-muted-foreground/30"
      )}>
        {isSelected && <CheckCircle2 className="w-4 h-4 text-primary-foreground" />}
      </div>

      {/* Score Badge - top left */}
      <div className="absolute top-3 left-3">
        <Badge variant="outline" className={cn("text-sm font-bold", getScoreColor())}>
          {score}% Match
        </Badge>
      </div>

      {/* Header */}
      <div className="pr-8 mb-3 mt-6">
        <h3 className="font-semibold text-foreground line-clamp-2 mb-1">
          {tender.tenderTitle}
        </h3>
        <p className="text-sm text-muted-foreground">
          ID: {tender.tenderId}
        </p>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Badge variant="secondary" className="text-xs">
          {tender.industryCategory}
        </Badge>
        <Badge
          variant={tender.tenderStatus === 'Open' ? 'default' : 'outline'}
          className="text-xs"
        >
          {tender.tenderStatus}
        </Badge>
        {tender.complexityLevel && (
          <Badge variant="outline" className="text-xs">
            {tender.complexityLevel}
          </Badge>
        )}
      </div>

      {/* Fit Score Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">Fit Score</span>
          <span className={cn("font-semibold", getScoreColor())}>{score}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className={cn("h-full transition-all", getProgressColor())}
            style={{ width: `${scorePercentage}%` }}
          />
        </div>
      </div>

      {/* Match Reason */}
      {tender.matchReason && (
        <div className="flex items-start gap-2 mb-2 text-xs">
          <Target className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
          <span className="text-muted-foreground">{tender.matchReason}</span>
        </div>
      )}

      {/* Missing Requirements */}
      {tender.missingRequirements && tender.missingRequirements.length > 0 && (
        <div className="flex items-start gap-2 mb-2 text-xs">
          <AlertCircle className="w-3 h-3 text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-orange-600 font-medium mb-1">Gaps:</p>
            <ul className="list-disc list-inside text-muted-foreground">
              {tender.missingRequirements.slice(0, 3).map((req, idx) => (
                <li key={idx}>{req}</li>
              ))}
              {tender.missingRequirements.length > 3 && (
                <li>+{tender.missingRequirements.length - 3} more</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Details */}
      <div className="space-y-2 text-sm mt-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Building2 className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{tender.issuingAuthority}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="w-4 h-4 flex-shrink-0" />
          <span>Deadline: {tender.submissionDeadline}</span>
        </div>
        {tender.requiredCompanySize && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-xs">Size: {tender.requiredCompanySize}</span>
          </div>
        )}
        {tender.estimatedContractValue && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-xs">Value: {tender.estimatedContractValue}</span>
          </div>
        )}
      </div>

      {/* Link */}
      <a
        href={tender.officialTenderUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:underline"
      >
        View Official Tender <ExternalLink className="w-3 h-3" />
      </a>
    </motion.div>
  );
}

export type Sector = string;
export type CompanySize = 'SME' | 'enterprise' | 'any';
export type ComplexityLevel = 'low' | 'medium' | 'high';

export interface Tender {
  id: string;
  tenderTitle: string;
  tenderId: string;
  issuingAuthority: string;
  countryRegion: string;
  tenderType: string;
  publicationDate: string;
  submissionDeadline: string;
  tenderStatus: string;
  officialTenderUrl: string;
  briefDescription: string;
  eligibilityCriteria: string;
  industryCategory: string;
  sourceUrl: string;
  score?: number;
  // Classification fields from TinyFish
  complexityLevel?: ComplexityLevel;
  requiredCompanySize?: CompanySize;
  requiredCertifications?: string[];
  evaluationCriteria?: string;
  scopeOfWork?: string;
  estimatedContractValue?: string | null;
  // Match analysis
  matchReason?: string;
  missingRequirements?: string[];
}

export interface SupplierProfile {
  companyName: string;
  country: string;
  sector: Sector;
  // Extended fields
  companySize?: CompanySize;
  pastProjects?: string;
  certifications?: string[];
  maxContractSize?: number; // In SGD or local currency
}

export interface AgentState {
  id: string;
  url: string;
  name: string;
  status: 'pending' | 'connecting' | 'searching' | 'complete' | 'error';
  message: string;
  streamingUrl?: string;
  tenders: Tender[];
}

export interface TenderSearchState {
  isSearching: boolean;
  selectedSector: Sector | null;
  supplierProfile: SupplierProfile | null;
  agents: AgentState[];
  tenders: Tender[];
  selectedTenders: Set<string>;
}

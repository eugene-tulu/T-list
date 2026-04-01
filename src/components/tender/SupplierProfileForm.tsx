import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Building2, Globe, Briefcase, Users, Award, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SupplierProfile, Sector, CompanySize } from '@/types/tender';

interface SupplierProfileFormProps {
  sector: Sector;
  onBack: () => void;
  onComplete: (profile: SupplierProfile) => void;
}

export function SupplierProfileForm({ sector: initialSector, onBack, onComplete }: SupplierProfileFormProps) {
  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState('');
  const [sector, setSector] = useState<string>(initialSector || '');
  const [companySize, setCompanySize] = useState<CompanySize>('SME');
  const [pastProjects, setPastProjects] = useState('');
  const [certifications, setCertifications] = useState('');
  const [maxContractSize, setMaxContractSize] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (companyName.trim() && country.trim() && sector.trim()) {
      onComplete({
        companyName: companyName.trim(),
        country: country.trim(),
        sector: sector.trim() as Sector,
        companySize: companySize,
        pastProjects: pastProjects.trim() || undefined,
        certifications: certifications.trim() ? certifications.split(',').map(c => c.trim()).filter(Boolean) : undefined,
        maxContractSize: maxContractSize ? parseFloat(maxContractSize) : undefined,
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-2xl mx-auto px-4 py-6"
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
          <h2 className="text-2xl font-bold text-foreground">Your Profile</h2>
          <p className="text-muted-foreground">
            Tell us about your company to personalize tender matching
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Name */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Company Name</h3>
              <p className="text-sm text-muted-foreground">Your business or organization name</p>
            </div>
          </div>
          <Input
            placeholder="e.g., Acme Construction Ltd"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            className="text-base"
          />
        </motion.div>

        {/* Country */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Country</h3>
              <p className="text-sm text-muted-foreground">Where is your company based?</p>
            </div>
          </div>
          <Input
            placeholder="e.g., Kenya, United States, United Kingdom"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            required
            className="text-base"
          />
        </motion.div>

        {/* Sector - Free form input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Industry Sector</h3>
              <p className="text-sm text-muted-foreground">What type of tenders are you looking for?</p>
            </div>
          </div>
          <Input
            placeholder="e.g., Construction, IT Services, Healthcare, Logistics"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            required
            className="text-base"
          />
        </motion.div>

        {/* Company Size */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Company Size</h3>
              <p className="text-sm text-muted-foreground">What best describes your organization?</p>
            </div>
          </div>
          <Select value={companySize} onValueChange={(value) => setCompanySize(value as CompanySize)}>
            <SelectTrigger className="text-base">
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SME">SME (Small/Medium Enterprise)</SelectItem>
              <SelectItem value="enterprise">Enterprise (Large corporation)</SelectItem>
              <SelectItem value="any">Any / Not sure</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* Past Projects */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Past Projects (Optional)</h3>
              <p className="text-sm text-muted-foreground">Briefly describe relevant experience</p>
            </div>
          </div>
          <Textarea
            placeholder="e.g., Completed 3 government IT infrastructure projects in the last 2 years..."
            value={pastProjects}
            onChange={(e) => setPastProjects(e.target.value)}
            className="text-base min-h-[100px]"
          />
        </motion.div>

        {/* Certifications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Award className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Certifications (Optional)</h3>
              <p className="text-sm text-muted-foreground">Comma-separated: ISO 9001, ISO 27001, etc.</p>
            </div>
          </div>
          <Input
            placeholder="e.g., ISO 9001, ISO 27001, SOC 2"
            value={certifications}
            onChange={(e) => setCertifications(e.target.value)}
            className="text-base"
          />
        </motion.div>

        {/* Max Contract Size */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Max Contract Size (Optional)</h3>
              <p className="text-sm text-muted-foreground">In SGD (Singapore Dollars)</p>
            </div>
          </div>
          <Input
            type="number"
            placeholder="e.g., 500000"
            value={maxContractSize}
            onChange={(e) => setMaxContractSize(e.target.value)}
            className="text-base"
          />
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex justify-end"
        >
          <Button
            type="submit"
            size="lg"
            disabled={!companyName.trim() || !country.trim() || !sector.trim()}
            className="min-w-[200px]"
          >
            Continue to Portal Selection
          </Button>
        </motion.div>
      </form>
    </motion.div>
  );
}

import { useState, useCallback, useEffect } from 'react';
import { SupplierProfile } from '@/types/tender';
import { supabase } from '@/integrations/supabase/client';

interface ProfileRow {
  id: string;
  user_id: string;
  company_name: string;
  country: string;
  sector: string;
  company_size: 'SME' | 'enterprise' | 'any' | null;
  past_projects: string | null;
  certifications: string[] | null;
  max_contract_size: number | null;
  created_at: string;
  updated_at: string;
}

function mapDbToProfile(db: ProfileRow): SupplierProfile {
  return {
    companyName: db.company_name,
    country: db.country,
    sector: db.sector,
    companySize: db.company_size || undefined,
    pastProjects: db.past_projects || undefined,
    certifications: db.certifications || undefined,
    maxContractSize: db.max_contract_size || undefined,
  };
}

interface ProfileInsert {
  user_id: string;
  company_name: string;
  country: string;
  sector: string;
  company_size: 'SME' | 'enterprise' | 'any' | null;
  past_projects: string | null;
  certifications: string[] | null;
  max_contract_size: number | null;
}

function mapProfileToInsert(profile: SupplierProfile, userId: string): ProfileInsert {
  return {
    user_id: userId,
    company_name: profile.companyName,
    country: profile.country,
    sector: profile.sector,
    company_size: profile.companySize || null,
    past_projects: profile.pastProjects || null,
    certifications: profile.certifications || null,
    max_contract_size: profile.maxContractSize || null,
  };
}

export function useSupplierProfile() {
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('supplier_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        setError(error.message);
      } else if (data) {
        setProfile(mapDbToProfile(data));
      }
      setLoading(false);
    };

    loadProfile();
  }, []);

  const saveProfile = useCallback(async (profileData: SupplierProfile) => {
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      return false;
    }

    const insertData = mapProfileToInsert(profileData, user.id);

    // Upsert (insert or update)
    const { error } = await supabase
      .from('supplier_profiles')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(insertData as any);

    if (error) {
      setError(error.message);
      return false;
    }

    setProfile(profileData);
    return true;
  }, []);

  const deleteProfile = useCallback(async () => {
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      return false;
    }

    const { error } = await supabase
      .from('supplier_profiles')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      setError(error.message);
      return false;
    }

    setProfile(null);
    return true;
  }, []);

  return {
    profile,
    loading,
    error,
    saveProfile,
    deleteProfile,
  };
}

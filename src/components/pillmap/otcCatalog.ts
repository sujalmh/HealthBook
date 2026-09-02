export const COMMON_OTCS = [
  { name: "St. John's Wort", dose: '300mg', shape: 'capsule' as const, color: '#F59E0B', desc: 'Herbal (Serotonin Risk)' },
  { name: 'Tylenol Extra Strength', dose: '500mg', shape: 'round' as const, color: '#EF4444', desc: 'Acetaminophen (APAP)' },
  { name: 'Advil Liqui-Gels', dose: '200mg', shape: 'capsule' as const, color: '#3B82F6', desc: 'Ibuprofen (NSAID)' },
  { name: 'Aleve', dose: '220mg', shape: 'oval' as const, color: '#0EA5E9', desc: 'Naproxen (NSAID)' },
  { name: 'Fish Oil Omega-3', dose: '1200mg', shape: 'capsule' as const, color: '#EAB308', desc: 'Supplement (Bleed Risk)' },
  { name: 'Calcium Carbonate', dose: '600mg', shape: 'round' as const, color: '#8B5CF6', desc: 'Mineral (Chelates Drugs)' },
  { name: 'Aspirin Low Dose', dose: '81mg', shape: 'round' as const, color: '#EC4899', desc: 'Antiplatelet' },
  { name: 'Vitamin D3', dose: '2000IU', shape: 'oval' as const, color: '#10B981', desc: 'Daily Supplement' }
] as const;

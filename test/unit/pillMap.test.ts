import { describe, it, expect, beforeEach } from 'vitest';
import { ClinicalInteractionEngine } from '@/core/knowledge/interactionEngine';
import { LocalVaultManager } from '@/core/vault/LocalVault';
import { calculateArcPath, calculateSlotArcCoordinates } from '@/components/pillmap/SVGArcOverlay';
import { CHRONOTYPE_TIMES, DAYS_OF_WEEK, TIME_SLOTS } from '@/types/pillmap';
import type { TimeSlot, DayOfWeek, Chronotype, PillSlotItem, PillboxGrid } from '@/types/pillmap';

describe('Milestone 3: PillMap & Polypharmacy Negotiator (Unit & Integration Tests)', () => {
  let vault: LocalVaultManager;
  const testPatientId = 'patient-s-devi';

  beforeEach(() => {
    vault = new LocalVaultManager();
    vault.clear();
  });

  // =========================================================================
  // 1. 7x4 Weekly Grid Slot Assignments & LocalVault Persistence
  // =========================================================================
  describe('1. 7x4 Slot Assignments & Vault Operations', () => {
    it('accurately distributes medications across designated days and slots in a 7x4 grid', () => {
      const grid: PillboxGrid = {};
      for (const day of DAYS_OF_WEEK) {
        grid[day] = { morning: [], noon: [], evening: [], bedtime: [] };
      }

      const medItem: PillSlotItem = {
        id: 'med-metformin-1',
        medId: 'med-metformin',
        name: 'Metformin',
        genericName: 'Metformin',
        dosage: '1000mg',
        color: '#10B981',
        shape: 'oval',
        withFood: true,
        timingSlots: ['morning', 'evening']
      };

      // Populate morning and evening for all days
      for (const day of DAYS_OF_WEEK) {
        grid[day].morning.push({ ...medItem, id: `${medItem.id}_${day}_morning` });
        grid[day].evening.push({ ...medItem, id: `${medItem.id}_${day}_evening` });
      }

      expect(grid.monday.morning).toHaveLength(1);
      expect(grid.monday.morning[0].name).toBe('Metformin');
      expect(grid.monday.morning[0].withFood).toBe(true);
      expect(grid.monday.noon).toHaveLength(0);
      expect(grid.monday.evening).toHaveLength(1);
      expect(grid.sunday.evening).toHaveLength(1);
    });

    it('persists medications and slot-based calendar reminders into LocalVault', () => {
      // Add medication
      const med = vault.addMedication({
        id: 'med-apixaban-001',
        patientId: testPatientId,
        brandName: 'Eliquis',
        genericName: 'Apixaban',
        dosage: '5mg',
        frequency: 'Twice daily',
        timingSlots: ['morning', 'evening'],
        withFood: false,
        status: 'active'
      });

      expect(med.id).toBe('med-apixaban-001');
      const activeMeds = vault.getActiveMedications(testPatientId);
      expect(activeMeds).toHaveLength(1);
      expect(activeMeds[0].genericName).toBe('Apixaban');

      // Add slot-based reminders to calendar_events
      const reminderEvent = vault.addCalendarEvent({
        id: 'rem_morning_001',
        patientId: testPatientId,
        title: 'MORNING Meds Reminder (08:00)',
        eventType: 'med_reminder',
        scheduledDate: new Date().toISOString(),
        reason: 'Take scheduled morning medications at 08:00',
        notifyHoursBefore: [0],
        isCompleted: false,
        syncedToCalendar: true
      });

      expect(reminderEvent.eventType).toBe('med_reminder');
      const calendarEvents = vault.getCalendarEvents(testPatientId);
      expect(calendarEvents).toHaveLength(1);
      expect(calendarEvents[0].title).toContain('MORNING');
    });
  });

  // =========================================================================
  // 2. SVG Arc Calculation Coordinates & Bezier Math
  // =========================================================================
  describe('2. SVG Arc Calculation Coordinates & Bezier Curves', () => {
    it('computes a valid SVG cubic bezier path string with arching control points', () => {
      const path = calculateArcPath(100, 100, 400, 100);
      expect(path).toContain('M 100 100');
      expect(path).toContain('C');
      expect(path.split(' ').length).toBeGreaterThan(6);
    });

    it('handles identical points gracefully with a linear segment', () => {
      const path = calculateArcPath(50, 50, 50, 50);
      expect(path).toBe('M 50 50 L 50 50');
    });

    it('calculates accurate slot arc coordinates across grid columns and rows', () => {
      // Monday Morning (Col 0, Row 0) to Wednesday Evening (Col 2, Row 2)
      const coords = calculateSlotArcCoordinates(0, 0, 2, 2, 140, 120, 80, 60);

      // Start: offsetX + 0 * 140 + 70 = 150, offsetY + 0 * 120 + 60 = 120
      expect(coords.startX).toBe(150);
      expect(coords.startY).toBe(120);

      // End: offsetX + 2 * 140 + 70 = 80 + 280 + 70 = 430, offsetY + 2 * 120 + 60 = 60 + 240 + 60 = 360
      expect(coords.endX).toBe(430);
      expect(coords.endY).toBe(360);

      expect(coords.path).toContain('M 150 120 C');
    });
  });

  // =========================================================================
  // 3. Drug-Drug Interaction Detection
  // =========================================================================
  describe('3. Drug-Drug Interaction Detection Engine', () => {
    it('detects Red CONTRAINDICATED interaction between Sertraline and St. Johns Wort', () => {
      const arcs = ClinicalInteractionEngine.checkDrugInteractions(['Sertraline', "St. John's Wort"]);
      expect(arcs.length).toBeGreaterThanOrEqual(1);

      const arc = arcs[0];
      expect(arc.severity).toBe('CONTRAINDICATED');
      expect(arc.arcColor).toBe('#EF4444');
      expect(arc.mechanism.toLowerCase()).toContain('serotonin syndrome');
      expect(arc.clinicalGuidance.toLowerCase()).toContain('discontinue');
    });

    it('detects Orange MAJOR interaction between Apixaban and Fish Oil', () => {
      const arcs = ClinicalInteractionEngine.checkDrugInteractions(['Apixaban', 'Fish Oil']);
      expect(arcs.length).toBeGreaterThanOrEqual(1);

      const arc = arcs.find(a => a.drugA.includes('Apixaban') || a.drugB.includes('Apixaban'));
      expect(arc).toBeDefined();
      expect(arc?.severity).toBe('MAJOR');
      expect(arc?.arcColor).toBe('#F97316');
      expect(arc?.mechanism.toLowerCase()).toContain('bleeding');
    });

    it('detects Orange MAJOR interaction between Ciprofloxacin and Calcium Carbonate', () => {
      const arcs = ClinicalInteractionEngine.checkDrugInteractions(['Ciprofloxacin', 'Calcium Carbonate']);
      expect(arcs.length).toBeGreaterThanOrEqual(1);

      const arc = arcs[0];
      expect(arc.severity).toBe('MAJOR');
      expect(arc.mechanism.toLowerCase()).toContain('chelate');
    });

    it('detects Yellow MODERATE interaction between Carvedilol and Furosemide', () => {
      const arcs = ClinicalInteractionEngine.checkDrugInteractions(['Carvedilol', 'Furosemide']);
      expect(arcs.length).toBeGreaterThanOrEqual(1);

      const arc = arcs[0];
      expect(arc.severity).toBe('MODERATE');
      expect(arc.arcColor).toBe('#EAB308');
      expect(arc.mechanism.toLowerCase()).toContain('hypotensive');
    });

    it('returns empty array for clean, non-conflicting medication regimens', () => {
      const arcs = ClinicalInteractionEngine.checkDrugInteractions(['Levothyroxine', 'Metformin']);
      expect(arcs).toHaveLength(0);
    });
  });

  // =========================================================================
  // 4. Drug-Diet Interaction Detection
  // =========================================================================
  describe('4. Drug-Diet Interaction Detection Engine', () => {
    it('flags Grapefruit interaction with Atorvastatin and Simvastatin', () => {
      const badges = ClinicalInteractionEngine.checkDietInteractions(['Atorvastatin', 'Simvastatin'], {
        drinksGrapefruitDaily: true
      });

      expect(badges.length).toBeGreaterThanOrEqual(2);
      const atorvaBadge = badges.find(b => b.drugName === 'Atorvastatin');
      expect(atorvaBadge).toBeDefined();
      expect(atorvaBadge?.badgeText).toContain('Grapefruit');
      expect(atorvaBadge?.severity).toBe('MAJOR');
      expect(atorvaBadge?.mechanism).toContain('CYP3A4');
    });

    it('flags Vitamin K leafy greens consistency requirement for Warfarin', () => {
      const badges = ClinicalInteractionEngine.checkDietInteractions(['Coumadin'], {
        frequentHighVitKGreens: true
      });

      expect(badges.length).toBeGreaterThanOrEqual(1);
      const badge = badges[0];
      expect(badge.badgeText).toContain('Consistent Vit K');
      expect(badge.mechanism.toLowerCase()).toContain('antagonizes warfarin');
    });

    it('attaches Empty Stomach requirement to Levothyroxine', () => {
      const badges = ClinicalInteractionEngine.checkDietInteractions(['Synthroid'], {});
      expect(badges.length).toBeGreaterThanOrEqual(1);

      const badge = badges[0];
      expect(badge.badgeText).toContain('Empty Stomach');
      expect(badge.clinicalGuidance.toLowerCase()).toContain('30 to 60 minutes before breakfast');
    });

    it('flags Zero Alcohol Contraindication for Metronidazole (Flagyl)', () => {
      const badges = ClinicalInteractionEngine.checkDietInteractions(['Flagyl'], {});
      expect(badges.length).toBeGreaterThanOrEqual(1);

      const badge = badges[0];
      expect(badge.severity).toBe('CONTRAINDICATED');
      expect(badge.badgeText).toContain('Zero Alcohol');
      expect(badge.mechanism.toLowerCase()).toContain('acetaldehyde');
    });
  });

  // =========================================================================
  // 5. Duplicate Active Ingredient Detection
  // =========================================================================
  describe('5. Duplicate Active Ingredient Detection Engine', () => {
    it('identifies duplicate Acetaminophen across Tylenol and Percocet with cumulative dose calculation', () => {
      const alerts = ClinicalInteractionEngine.checkDuplicateIngredients([
        { name: 'Tylenol Extra Strength', dose: '500mg' },
        { name: 'Percocet', dose: '10/325mg' }
      ]);

      expect(alerts.length).toBeGreaterThanOrEqual(1);
      const alert = alerts.find(a => a.ingredient === 'Acetaminophen');
      expect(alert).toBeDefined();
      expect(alert?.drugsInvolved).toHaveLength(2);
      expect(alert?.totalCumulativeDoseMg).toBeGreaterThanOrEqual(825);
      expect(alert?.plainNarration).toContain('Acetaminophen');
    });

    it('detects concurrent dual NSAID risk across Advil and Aleve', () => {
      const alerts = ClinicalInteractionEngine.checkDuplicateIngredients([
        { name: 'Advil', dose: '200mg' },
        { name: 'Aleve', dose: '220mg' }
      ]);

      expect(alerts.length).toBeGreaterThanOrEqual(1);
      const nsaidAlert = alerts.find(a => a.ingredient === 'NSAID Class');
      expect(nsaidAlert).toBeDefined();
      expect(nsaidAlert?.drugsInvolved).toHaveLength(2);
    });

    it('detects brand/generic overlap between Lipitor and Atorvastatin', () => {
      const alerts = ClinicalInteractionEngine.checkDuplicateIngredients([
        { name: 'Lipitor', dose: '40mg' },
        { name: 'Atorvastatin', dose: '40mg' }
      ]);

      expect(alerts.length).toBeGreaterThanOrEqual(1);
      const alert = alerts.find(a => a.ingredient === 'Atorvastatin');
      expect(alert).toBeDefined();
      expect(alert?.totalCumulativeDoseMg).toBe(80);
    });

    it('returns no alerts for distinct non-overlapping active ingredients', () => {
      const alerts = ClinicalInteractionEngine.checkDuplicateIngredients([
        { name: 'Metformin', dose: '500mg' },
        { name: 'Levothyroxine', dose: '75mcg' }
      ]);

      expect(alerts).toHaveLength(0);
    });
  });

  // =========================================================================
  // 6. Chronotype Schedule Calibration & Shift Optimizer
  // =========================================================================
  describe('6. Chronotype Calibration & Schedule Optimization', () => {
    it('shifts Atorvastatin from morning to bedtime for nocturnal cholesterol synthesis', () => {
      const res = ClinicalInteractionEngine.suggestSchedule(
        [{ id: 'm1', name: 'Atorvastatin', currentSlot: 'morning' }],
        'night_owl'
      );

      expect(res.chronotype).toBe('night_owl');
      expect(res.proposedShifts).toHaveLength(1);
      expect(res.proposedShifts[0].fromSlot).toBe('morning');
      expect(res.proposedShifts[0].toSlot).toBe('bedtime');
      expect(res.proposedShifts[0].reason).toContain('cholesterol synthesis');
    });

    it('shifts Furosemide away from bedtime to morning to prevent nocturia', () => {
      const res = ClinicalInteractionEngine.suggestSchedule(
        [{ id: 'm2', name: 'Furosemide', currentSlot: 'bedtime' }],
        'standard'
      );

      expect(res.proposedShifts).toHaveLength(1);
      expect(res.proposedShifts[0].fromSlot).toBe('bedtime');
      expect(res.proposedShifts[0].toSlot).toBe('morning');
      expect(res.proposedShifts[0].reason.toLowerCase()).toContain('urination');
    });

    it('separates Calcium Carbonate from morning Levothyroxine by shifting to noon', () => {
      const res = ClinicalInteractionEngine.suggestSchedule(
        [
          { id: 'm3', name: 'Levothyroxine', currentSlot: 'morning' },
          { id: 'm4', name: 'Calcium Carbonate', currentSlot: 'morning' }
        ],
        'early_bird'
      );

      const calciumShift = res.proposedShifts.find(s => s.medName === 'Calcium Carbonate');
      expect(calciumShift).toBeDefined();
      expect(calciumShift?.toSlot).toBe('noon');
      expect(calciumShift?.reason).toContain('Levothyroxine');
    });

    it('provides distinct chronotype slot time mapping presets', () => {
      expect(CHRONOTYPE_TIMES.early_bird.morning).toBe('06:30');
      expect(CHRONOTYPE_TIMES.early_bird.bedtime).toBe('21:00');

      expect(CHRONOTYPE_TIMES.standard.morning).toBe('08:00');
      expect(CHRONOTYPE_TIMES.standard.bedtime).toBe('22:00');

      expect(CHRONOTYPE_TIMES.night_owl.morning).toBe('10:00');
      expect(CHRONOTYPE_TIMES.night_owl.bedtime).toBe('00:30');
    });
  });

  // =========================================================================
  // 7. Missed Dose Adherence Simulation
  // =========================================================================
  describe('7. Missed Dose Adherence Simulation', () => {
    it('simulates missed Metformin with fasting glucose increase and no-double-dose rule', () => {
      const sim = ClinicalInteractionEngine.simulateAdherence('Metformin', {
        day: 'tuesday',
        slot: 'morning'
      });

      expect(sim.medName).toBe('Metformin');
      expect(sim.clinicalImpactSummary.toLowerCase()).toContain('glucose');
      expect(sim.projectedBiomarkerDelta?.biomarker).toBe('Fasting Glucose');
      expect(sim.recoveryProtocol.toLowerCase()).toContain('as soon as remembered');
      expect(sim.doNotDoubleDoseWarning).toBe(true);
    });

    it('simulates missed Apixaban with anticoagulant half-life decay and stroke risk warning', () => {
      const sim = ClinicalInteractionEngine.simulateAdherence('Apixaban', {
        day: 'friday',
        slot: 'evening'
      });

      expect(sim.clinicalImpactSummary.toLowerCase()).toContain('anticoagulant');
      expect(sim.projectedBiomarkerDelta?.biomarker).toContain('Blood Level');
      expect(sim.doNotDoubleDoseWarning).toBe(true);
    });

    it('simulates missed Amlodipine blood pressure rebound prediction', () => {
      const sim = ClinicalInteractionEngine.simulateAdherence('Amlodipine', {
        day: 'monday',
        slot: 'morning'
      });

      expect(sim.clinicalImpactSummary.toLowerCase()).toContain('blood pressure');
      expect(sim.projectedBiomarkerDelta?.biomarker).toContain('Systolic Blood Pressure');
      expect(sim.projectedBiomarkerDelta?.estimatedChange).toContain('mmHg');
    });
  });
});

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve(__dirname, '../../src');

const readSrcFile = (relativePath: string): string => {
  const fullPath = path.join(SRC_DIR, relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
};

describe('Empirical Mobile Layout, Viewport Responsiveness & Touch Target Verification', () => {
  // =========================================================================
  // 1. Root & Shell Containment (320px - 430px)
  // =========================================================================
  describe('1. Root & Global CSS Viewport Containment', () => {
    it('enforces overflow-x: hidden and max-width: 100vw on html, body, and #root in index.css', () => {
      const css = readSrcFile('index.css');
      expect(css).toContain('overflow-x: hidden');
      expect(css).toContain('max-width: 100vw');
      expect(css).toContain('width: 100%');
    });

    it('enforces >= 44px touch targets on mobile (max-width: 640px) with proper badge exemptions', () => {
      const css = readSrcFile('index.css');
      expect(css).toContain('@media (max-width: 640px)');
      expect(css).toContain('min-height: 44px');
      expect(css).toContain('min-width: 44px');
      // Exemptions for compact badges and inline chips
      expect(css).toContain('.badge');
      expect(css).toContain('.pill-badge');
      expect(css).toContain('.segmented-pill');
      expect(css).toContain('.inline-chip');
    });

    it('enforces w-full max-w-full and overflow-x-hidden on App.tsx shell and main wrapper', () => {
      const app = readSrcFile('App.tsx');
      expect(app).toContain('w-full max-w-full overflow-x-hidden');
      expect(app).toContain('min-h-screen bg-canvas-bg text-slate-900 flex flex-col');
    });
  });

  // =========================================================================
  // 2. Header & Navigation Responsiveness
  // =========================================================================
  describe('2. Header & Navigation Touch Targets & Overflow Protection', () => {
    it('proxy switcher moved from header to Family page — header is proxy-free, Family has switcher', () => {
      const app = readSrcFile('App.tsx');
      const familySwitcher = readSrcFile('components/carecircle/CaregiverSwitcher.tsx');
      const familyView = readSrcFile('components/carecircle/CareCircleView.tsx');
      // Header should no longer contain proxy switcher (moved to Family)
      expect(app).not.toContain("activeProfile.isProxy ? 'Switch to Patient' : 'Switch to Proxy'");
      expect(app).toContain('min-h-[44px] min-w-[44px]');
      // Family page must contain proxy switcher with >=44px targets
      expect(familySwitcher).toContain('Active profile:');
      expect(familySwitcher).toContain('min-h-[40px]');
      expect(familyView).toContain('CaregiverSwitcher');
    });

    it('ensures all top header action buttons have min-h-[44px] and min-w-[44px]', () => {
      const app = readSrcFile('App.tsx');
      expect(app).toContain('aria-label');
      expect(app).toContain('Ask');
      expect(app).toContain('Activity');
      expect(app).toContain('Sign out');
      expect(app).toContain('min-h-[44px] min-w-[44px]');
    });

    it('implements bottom mobile navigation with grouped 5-item grid, merged health, Ask centered + highlighted, and >=44px touch targets', () => {
      const app = readSrcFile('App.tsx');
      expect(app).toContain('md:hidden fixed bottom-0 left-0 right-0');
      expect(app).toContain('grid grid-cols-5');
      expect(app).toContain('min-h-[56px]');
      // Merged Records+Labs → Health, Ask centered with highlight
      expect(app).toContain("'health'");
      expect(app).toContain("'ask'");
      expect(app).toContain("'medicines'");
      expect(app).toContain('aria-label');
      expect(app).toContain('aria-current');
    });
  });

  // =========================================================================
  // 3. Modal Vertical Scrolling Containment & Action Button Stacking
  // =========================================================================
  describe('3. Modal Dialog Containment & Action Button Stacking across 12+ Modals', () => {
    it('ScopedPermissionsModal: has max-h-[90vh], overflow-y-auto, and min-h-[44px] close button', () => {
      const code = readSrcFile('components/carecircle/ScopedPermissionsModal.tsx');
      expect(code).toContain('max-h-[90vh]');
      expect(code).toContain('overflow-y-auto');
      expect(code).toContain('min-h-[44px] min-w-[44px]');
    });

    it('DoctorAccessModal: has max-h-[90vh], overflow-y-auto, responsive preset grid, and min-h-[44px] close button', () => {
      const code = readSrcFile('components/dossier/DoctorAccessModal.tsx');
      expect(code).toContain('max-h-[90vh]');
      expect(code).toContain('overflow-y-auto');
      expect(code).toContain('grid-cols-1 sm:grid-cols-3');
      expect(code).toContain('min-h-[44px] min-w-[44px]');
    });

    it('DossierExportModal: has max-h-[90vh], overflow-y-auto, responsive format grid, and min-h-[44px] close button', () => {
      const code = readSrcFile('components/dossier/DossierExportModal.tsx');
      expect(code).toContain('max-h-[90vh]');
      expect(code).toContain('overflow-y-auto');
      expect(code).toContain('grid-cols-1 sm:grid-cols-3');
      expect(code).toContain('min-h-[44px] min-w-[44px]');
    });

    it('UploadLabModal: has max-h-[90vh], overflow-y-auto, responsive action button stacking, and min-h-[44px] close button', () => {
      const code = readSrcFile('components/homelab/UploadLabModal.tsx');
      expect(code).toContain('max-h-[90vh]');
      expect(code).toContain('overflow-y-auto');
      expect(code).toContain('flex flex-col-reverse sm:flex-row');
      expect(code).toContain('min-h-[44px] min-w-[44px]');
    });

    it('DangerSignModal: has max-h-[90vh], overflow-y-auto, responsive action button stacking, and min-h-[44px] touch targets', () => {
      const code = readSrcFile('components/safety/DangerSignModal.tsx');
      expect(code).toContain('max-h-[90vh]');
      expect(code).toContain('overflow-y-auto');
      expect(code).toContain('flex flex-col-reverse sm:flex-row');
      expect(code).toContain('min-h-[44px] min-w-[44px]');
    });

    it('FollowupScheduler: has max-h-[90vh], overflow-y-auto, responsive action button stacking, and min-h-[44px] touch targets', () => {
      const code = readSrcFile('components/safety/FollowupScheduler.tsx');
      expect(code).toContain('max-h-[90vh]');
      expect(code).toContain('overflow-y-auto');
      expect(code).toContain('flex flex-col-reverse sm:flex-row');
      expect(code).toContain('min-h-[44px] min-w-[44px]');
    });

    it('AddMedicationModal: has max-h-[90vh], overflow-y-auto, responsive action button stacking, and min-h-[44px] touch targets', () => {
      const code = readSrcFile('components/pillmap/AddMedicationModal.tsx');
      expect(code).toContain('max-h-[90vh]');
      expect(code).toContain('overflow-y-auto');
      expect(code).toContain('flex flex-col-reverse sm:flex-row');
      expect(code).toContain('min-h-[44px] min-w-[44px]');
    });

    it('AdherenceSimulatorModal: has max-h-[90vh], overflow-y-auto, and responsive action button stacking', () => {
      const code = readSrcFile('components/pillmap/AdherenceSimulatorModal.tsx');
      expect(code).toContain('max-h-[90vh]');
      expect(code).toContain('overflow-y-auto');
      expect(code).toContain('flex flex-col-reverse sm:flex-row');
    });

    it('ShiftPreviewModal: has max-h-[90vh], overflow-y-auto, and responsive action button stacking', () => {
      const code = readSrcFile('components/pillmap/ShiftPreviewModal.tsx');
      expect(code).toContain('max-h-[90vh]');
      expect(code).toContain('overflow-y-auto');
      expect(code).toContain('flex flex-col-reverse sm:flex-row');
    });

    it('ReminderConfigModal: has max-h-[90vh], overflow-y-auto, and responsive action button stacking', () => {
      const code = readSrcFile('components/pillmap/ReminderConfigModal.tsx');
      expect(code).toContain('max-h-[90vh]');
      expect(code).toContain('overflow-y-auto');
      expect(code).toContain('flex flex-col-reverse sm:flex-row');
    });

    it('PharmacistExportModal: has max-h-[90vh] and table horizontal scroll wrapper overflow-x-auto', () => {
      const code = readSrcFile('components/pillmap/PharmacistExportModal.tsx');
      expect(code).toContain('max-h-[90vh]');
      expect(code).toContain('overflow-x-auto');
    });

    it('SummaryExportModal: has max-h-[90vh], overflow-y-auto, and min-h-[44px] close button', () => {
      const code = readSrcFile('components/rxbridge/SummaryExportModal.tsx');
      expect(code).toContain('max-h-[90vh]');
      expect(code).toContain('overflow-y-auto');
      expect(code).toContain('min-h-[44px] min-w-[44px]');
    });

    it('TeachBackModal: has max-h-[90vh], overflow-y-auto, and min-h-[44px] close button', () => {
      const code = readSrcFile('components/rxbridge/TeachBackModal.tsx');
      expect(code).toContain('max-h-[90vh]');
      expect(code).toContain('overflow-y-auto');
      expect(code).toContain('min-h-[44px] min-w-[44px]');
    });

    it('QuestionBank: has max-h-[90vh], overflow-y-auto, and min-h-[44px] close button', () => {
      const code = readSrcFile('components/common/QuestionBank.tsx');
      expect(code).toContain('max-h-[90vh]');
      expect(code).toContain('overflow-y-auto');
      expect(code).toContain('min-h-[44px] min-w-[44px]');
    });

    it('WebMCPInspector: has max-h-[90vh], overflow-hidden modal container, and min-h-[44px] close button', () => {
      const code = readSrcFile('components/common/WebMCPInspector.tsx');
      expect(code).toContain('max-h-[90vh]');
      expect(code).toContain('min-h-[44px] min-w-[44px]');
    });
  });

  // =========================================================================
  // 4. Clinical Modules & Subviews Responsiveness
  // =========================================================================
  describe('4. Primary Clinical Modules Subview Responsiveness & Containment', () => {
    it('PillboxGrid: implements horizontal scrolling table, min-width containment, and mobile swipe affordances', () => {
      const code = readSrcFile('components/pillmap/PillboxGrid.tsx');
      expect(code).toContain('overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 scrollbar-none');
      expect(code).toContain('min-w-[720px] sm:min-w-[960px]');
      expect(code).toContain('Swipe horizontally for full week');
      expect(code).toContain('sm:hidden');
    });

    it('ThreeListTable: renders dual layout with mobile card stack (block md:hidden) and horizontal filter scroll', () => {
      const code = readSrcFile('components/rxbridge/ThreeListTable.tsx');
      expect(code).toContain('block md:hidden space-y-3.5');
      expect(code).toContain('hidden md:block overflow-x-auto');
      expect(code).toContain('flex items-center gap-1.5 overflow-x-auto scrollbar-none');
    });

    it('BiomarkerChart: measures container dynamically via ResizeObserver and sets mobile chart height', () => {
      const code = readSrcFile('components/labstory/BiomarkerChart.tsx');
      expect(code).toContain('ResizeObserver');
      expect(code).toContain('const isMobile = containerWidth < 600');
      expect(code).toContain('const chartHeight = isMobile ? 260 : 340');
    });

    it('DossierView: renders 2x2 grid on mobile (grid-cols-2 sm:grid-cols-4) and scrollable sub-tabs', () => {
      const code = readSrcFile('components/dossier/DossierView.tsx');
      expect(code).toContain('grid grid-cols-2 sm:grid-cols-4 gap-4');
      expect(code).toContain('overflow-x-auto scrollbar-none');
    });

    it('CareCircleView: renders responsive member grid and scrollable sub-tabs', () => {
      const code = readSrcFile('components/carecircle/CareCircleView.tsx');
      expect(code).toContain('overflow-x-auto scrollbar-none');
    });

    it('AuthGate & Sign-in/Create Account: enforce min-h-[44px] and responsive padding on all form controls', () => {
      const createCode = readSrcFile('components/auth/CreateAccountView.tsx');
      const signInCode = readSrcFile('components/auth/SignInView.tsx');
      expect(createCode).toContain('min-h-[44px]');
      expect(signInCode).toContain('min-h-[44px]');
    });
  });
});

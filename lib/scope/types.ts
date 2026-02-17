/**
 * Multi-boutique scope types. Phase 2.
 * Policy: Region/Group views ONLY for ADMIN + MANAGER.
 */

export type ScopeKind = 'BOUTIQUE' | 'REGION' | 'GROUP' | 'SELECTION';

export type ScopeSelectionJson = {
  scope: ScopeKind;
  boutiqueId?: string;
  regionId?: string;
  groupId?: string;
  boutiqueIds?: string[];
};

export type ResolvedScope = {
  scope: ScopeKind;
  boutiqueIds: string[];
  label: string;
};

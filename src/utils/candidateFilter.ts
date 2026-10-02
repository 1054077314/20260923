/**
 * 候选房源筛选 / 排序的唯一口径。
 * ComparisonMatrix 与任何需要过滤候选清单的组件都走这里，
 * 不再各自实现一套搜索 / 租金 / 标签 / 配套逻辑。
 */

import { CandidateProperty } from '../types/rental';

export type RentRange = 'all' | 'under1k' | '1k-2k' | '2k-3.5k' | 'over3.5k';
export type CandidateSortBy = 'score' | 'rent' | 'commute';
export type CandidateSortOrder = 'asc' | 'desc';

export interface CandidateFilterState {
  searchQuery: string;
  rentFilter: RentRange;
  onlyPinned: boolean;
  selectedTagFilters: string[];
  selectedAmenityFilters: string[];
}

export const EMPTY_CANDIDATE_FILTER: CandidateFilterState = {
  searchQuery: '',
  rentFilter: 'all',
  onlyPinned: false,
  selectedTagFilters: [],
  selectedAmenityFilters: [],
};

export function isCandidateFilterActive(f: CandidateFilterState): boolean {
  return (
    f.searchQuery.trim() !== '' ||
    f.rentFilter !== 'all' ||
    f.onlyPinned ||
    f.selectedTagFilters.length > 0 ||
    f.selectedAmenityFilters.length > 0
  );
}

export function filterCandidates(
  candidates: CandidateProperty[],
  f: CandidateFilterState
): CandidateProperty[] {
  return candidates.filter((c) => {
    if (f.searchQuery.trim()) {
      const q = f.searchQuery.toLowerCase().trim();
      const matchTitle = (c.title || '').toLowerCase().includes(q);
      const matchCommunity = (c.community || '').toLowerCase().includes(q);
      const matchAddress = (c.address || '').toLowerCase().includes(q);
      const matchSubway = (c.subwayStation || '').toLowerCase().includes(q);
      const matchNotes = (c.notes || '').toLowerCase().includes(q);
      const matchPros = (c.pros || []).some((p) => p.toLowerCase().includes(q));
      const matchAmenities = (c.amenities || []).some((a) => a.toLowerCase().includes(q));
      if (
        !matchTitle &&
        !matchCommunity &&
        !matchAddress &&
        !matchSubway &&
        !matchNotes &&
        !matchPros &&
        !matchAmenities
      ) {
        return false;
      }
    }

    if (f.rentFilter === 'under1k' && c.rent > 1000) return false;
    if (f.rentFilter === '1k-2k' && (c.rent <= 1000 || c.rent > 2000)) return false;
    if (f.rentFilter === '2k-3.5k' && (c.rent <= 2000 || c.rent > 3500)) return false;
    if (f.rentFilter === 'over3.5k' && c.rent <= 3500) return false;

    if (f.selectedTagFilters.includes('near_subway') && (c.walkToSubwayMin ?? 999) > 10) return false;
    if (f.selectedTagFilters.includes('residential_utilities') && c.utilitiesType !== 'residential')
      return false;
    if (f.selectedTagFilters.includes('direct_landlord') && c.landlordType !== 'direct_landlord')
      return false;
    if (f.selectedTagFilters.includes('elevator') && !c.floor.includes('电梯')) return false;
    if (
      f.selectedTagFilters.includes('south_facing') &&
      !c.title.includes('南') &&
      !(c.pros || []).some((p) => p.includes('南'))
    )
      return false;

    if (f.selectedAmenityFilters.length > 0) {
      const candidateAmenities = new Set(c.amenities || []);
      for (const amenity of f.selectedAmenityFilters) {
        const hasAmenity =
          candidateAmenities.has(amenity) ||
          (c.pros || []).some((p) => p.includes(amenity)) ||
          (c.notes || '').includes(amenity);
        if (!hasAmenity) return false;
      }
    }

    if (f.onlyPinned && !c.isPinned) return false;

    return true;
  });
}

export function sortCandidates(
  candidates: CandidateProperty[],
  sortBy: CandidateSortBy,
  sortOrder: CandidateSortOrder,
  routeMinutes?: Record<string, number | null | undefined>
): CandidateProperty[] {
  return [...candidates].sort((a, b) => {
    const aPinned = a.isPinned ? 1 : 0;
    const bPinned = b.isPinned ? 1 : 0;
    if (aPinned !== bPinned) {
      return bPinned - aPinned;
    }

    let result = 0;
    if (sortBy === 'score') {
      result = (b.weightedScore || 0) - (a.weightedScore || 0);
    } else if (sortBy === 'rent') {
      // 未知租金（0）一律沉底，升序降序都不参与比较
      const aUnknown = a.rent <= 0;
      const bUnknown = b.rent <= 0;
      if (aUnknown !== bUnknown) return aUnknown ? 1 : -1;
      result = a.rent - b.rent;
    } else if (sortBy === 'commute') {
      // 真实路线耗时优先，手动录入的 commuteMinutes 仅作后备
      const aMin = routeMinutes?.[a.id] ?? a.commuteMinutes ?? 9999;
      const bMin = routeMinutes?.[b.id] ?? b.commuteMinutes ?? 9999;
      result = aMin - bMin;
    }
    return sortOrder === 'desc' ? result : -result;
  });
}

import React, { useState } from 'react';
import {
  RentalPlan,
  CandidateProperty,
  EvaluationWeights,
  CandidateRating,
} from '../types/rental';
import {
  calculateCandidateMonthlyTotal,
  calculateWeightedScore,
} from '../utils/calculations';
import { NeighborhoodSearchModal } from './NeighborhoodSearchModal';
import { PropertySourcesModal } from './PropertySourcesModal';
import { LiveListingScraperModal } from './LiveListingScraperModal';
import { CandidatePropertiesMap } from './CandidatePropertiesMap';
import { parseListingText } from '../utils/listingParser';
import {
  Building2,
  Sliders,
  Plus,
  Globe,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  Edit2,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MapPin,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Layers,
  X,
  Search,
  Filter,
  RotateCcw,
  Check,
  Tag,
  Compass,
  Star,
} from 'lucide-react';

interface ComparisonMatrixProps {
  plan: RentalPlan;
  onUpdatePlan: (plan: RentalPlan) => void;
  onSelectCandidateForInspection?: (candidateId: string) => void;
  focusMode?: boolean;
  theme?: 'light' | 'dark';
}

const DEFAULT_RATING: CandidateRating = {
  priceValue: 7.5,
  commute: 7.5,
  lightingVentilation: 7.5,
  soundproof: 7.5,
  spaceLayout: 7.5,
  surroundings: 7.5,
  hygieneSafety: 7.5,
};

const RATING_DIMENSIONS: { key: keyof CandidateRating; label: string; desc: string }[] = [
  { key: 'priceValue', label: '租金性价比', desc: '租金与杂费是否公道划算' },
  { key: 'commute', label: '通勤便利度', desc: '地铁步行距离与单程耗时' },
  { key: 'lightingVentilation', label: '采光通风', desc: '南向采光、日照与空气对流' },
  { key: 'soundproof', label: '隔音静音', desc: '远离主干道噪音、实心墙体' },
  { key: 'spaceLayout', label: '户型空间', desc: '开间格局、大衣柜与储物收纳' },
  { key: 'surroundings', label: '周边配套', desc: '商超便利店、外卖快递与安保' },
  { key: 'hygieneSafety', label: '房况成色', desc: '非串串房、家电新旧与洁净度' },
];

const PRESET_AMENITIES = [
  '独立卫浴',
  '燃气厨房',
  '阳台晾晒',
  '智能门锁',
  '洗衣机',
  '冰箱',
  '空调',
  '带电梯',
  '停车位',
  '集中供暖',
  '朝南采光',
  '宽带入户',
];

const PRESET_TAG_FILTERS = [
  { id: 'near_subway', label: '近地铁 (≤10min)' },
  { id: 'residential_utilities', label: '民用水电' },
  { id: 'direct_landlord', label: '房东直租' },
  { id: 'elevator', label: '带电梯' },
  { id: 'south_facing', label: '朝南向' },
];

type RentRange = 'all' | 'under1k' | '1k-2k' | '2k-3.5k' | 'over3.5k';

export const ComparisonMatrix: React.FC<ComparisonMatrixProps> = ({
  plan,
  onUpdatePlan,
  onSelectCandidateForInspection,
  focusMode,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const [showWeightSettings, setShowWeightSettings] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<CandidateProperty | null>(null);

  // Sorting
  const [sortBy, setSortBy] = useState<'score' | 'rent' | 'commute'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [rentFilter, setRentFilter] = useState<RentRange>('all');
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [selectedAmenityFilters, setSelectedAmenityFilters] = useState<string[]>([]);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Grounding modal state
  const [groundingModalOpen, setGroundingModalOpen] = useState(false);
  const [selectedGroundingCandidate, setSelectedGroundingCandidate] = useState<CandidateProperty | null>(null);

  // Form states for Candidate Modal
  const [formTitle, setFormTitle] = useState('');
  const [formCommunity, setFormCommunity] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formSubway, setFormSubway] = useState('');
  const [formWalkMin, setFormWalkMin] = useState(8);
  const [formCommuteMin, setFormCommuteMin] = useState(30);
  const [formArea, setFormArea] = useState(25);
  const [formFloor, setFormFloor] = useState('6F/18F 电梯');
  const [formRent, setFormRent] = useState(2500);
  const [formUtilities, setFormUtilities] = useState<'residential' | 'commercial'>('residential');
  const [formLandlord, setFormLandlord] = useState<CandidateProperty['landlordType']>('direct_landlord');
  const [formDepositTerms, setFormDepositTerms] = useState('押一付一');
  const [formPropertyFee, setFormPropertyFee] = useState(0);
  const [formInternetFee, setFormInternetFee] = useState(0);
  const [formWaterElecEst, setFormWaterElecEst] = useState(80);
  const [formContactName, setFormContactName] = useState('');
  const [formContactPhone, setFormContactPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formAmenities, setFormAmenities] = useState<string[]>([]);
  const [formPros, setFormPros] = useState<string[]>([]);
  const [formCons, setFormCons] = useState<string[]>([]);
  const [tempPro, setTempPro] = useState('');
  const [tempCon, setTempCon] = useState('');
  const [formRatings, setFormRatings] = useState<CandidateRating>(DEFAULT_RATING);
  const [sourcesModalOpen, setSourcesModalOpen] = useState(false);
  const [scraperModalOpen, setScraperModalOpen] = useState(false);
  const [smartPasteInput, setSmartPasteInput] = useState('');
  const [showMapView, setShowMapView] = useState(true);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const handleBatchImportScrapedListings = (newCandidates: CandidateProperty[]) => {
    onUpdatePlan({
      ...plan,
      candidates: [...plan.candidates, ...newCandidates],
      updatedAt: new Date().toISOString(),
    });
  };

  const handleSmartParse = () => {
    if (!smartPasteInput.trim()) return;
    const parsed = parseListingText(smartPasteInput);
    if (parsed.title) setFormTitle(parsed.title);
    if (parsed.community) setFormCommunity(parsed.community);
    if (parsed.rent) setFormRent(parsed.rent);
    if (parsed.areaSqMeters) setFormArea(parsed.areaSqMeters);
    if (parsed.floor) setFormFloor(parsed.floor);
    if (parsed.walkToSubwayMin) setFormWalkMin(parsed.walkToSubwayMin);
    if (parsed.depositTerms) setFormDepositTerms(parsed.depositTerms);
    if (parsed.contactPhone) setFormContactPhone(parsed.contactPhone);
    if (parsed.utilitiesType && (parsed.utilitiesType === 'residential' || parsed.utilitiesType === 'commercial')) {
      setFormUtilities(parsed.utilitiesType);
    }
    if (parsed.landlordType) {
      const map: Record<string, CandidateProperty['landlordType']> = {
        landlord: 'direct_landlord',
        sublessor: 'sublessor',
        agency: 'intermediary',
        apartment: 'brand_apartment',
      };
      if (map[parsed.landlordType]) setFormLandlord(map[parsed.landlordType]);
    }
    if (parsed.amenities && parsed.amenities.length > 0) {
      setFormAmenities((prev) => Array.from(new Set([...prev, ...(parsed.amenities || [])])));
    }
    if (parsed.pros && parsed.pros.length > 0) {
      setFormPros((prev) => Array.from(new Set([...prev, ...(parsed.pros || [])])));
    }
  };

  // Open modal for new candidate
  const handleOpenAddModal = () => {
    setEditingCandidate(null);
    setSmartPasteInput('');
    setFormTitle('');
    setFormCommunity('');
    setFormAddress('');
    setFormSubway('');
    setFormWalkMin(8);
    setFormCommuteMin(25);
    setFormArea(25);
    setFormFloor('8F/18F 电梯');
    setFormRent(plan.budget.maxMonthlyRent || 2500);
    setFormUtilities('residential');
    setFormLandlord('direct_landlord');
    setFormDepositTerms('押一付一');
    setFormPropertyFee(0);
    setFormInternetFee(0);
    setFormWaterElecEst(80);
    setFormContactName('');
    setFormContactPhone('');
    setFormNotes('');
    setFormAmenities(['民用水电', '独立卫浴', '阳台晾晒', '带电梯', '空调']);
    setFormPros(['民水民电', '独立卫浴']);
    setFormCons([]);
    setFormRatings({ ...DEFAULT_RATING });
    setIsModalOpen(true);
  };

  // Open modal for editing candidate
  const handleOpenEditModal = (c: CandidateProperty) => {
    setEditingCandidate(c);
    setFormTitle(c.title);
    setFormCommunity(c.community);
    setFormAddress(c.address);
    setFormSubway(c.subwayStation);
    setFormWalkMin(c.walkToSubwayMin);
    setFormCommuteMin(c.commuteMinutes);
    setFormArea(c.areaSqMeters);
    setFormFloor(c.floor);
    setFormRent(c.rent);
    setFormUtilities(c.utilitiesType);
    setFormLandlord(c.landlordType);
    setFormDepositTerms(c.depositTerms);
    setFormPropertyFee(c.extraMonthlyFees?.propertyFee || 0);
    setFormInternetFee(c.extraMonthlyFees?.internetFee || 0);
    setFormWaterElecEst(c.extraMonthlyFees?.waterElectricityEst || 80);
    setFormContactName(c.contactName || '');
    setFormContactPhone(c.contactPhone || '');
    setFormNotes(c.notes || '');
    setFormAmenities(c.amenities || ['民用水电', '阳台晾晒', '空调']);
    setFormPros(c.pros || []);
    setFormCons(c.cons || []);
    setFormRatings(c.ratings || { ...DEFAULT_RATING });
    setIsModalOpen(true);
  };

  const handleToggleFormAmenity = (amenity: string) => {
    if (formAmenities.includes(amenity)) {
      setFormAmenities(formAmenities.filter((a) => a !== amenity));
    } else {
      setFormAmenities([...formAmenities, amenity]);
    }
  };

  const handleSaveModal = () => {
    if (!formTitle.trim()) {
      alert('请填写房源标题或小区名称');
      return;
    }

    const calculatedScore = calculateWeightedScore(formRatings, plan.weights);

    const newCandidateData: CandidateProperty = {
      id: editingCandidate ? editingCandidate.id : `cand-${Date.now()}`,
      title: formTitle.trim(),
      community: formCommunity.trim() || formTitle.trim(),
      address: formAddress.trim(),
      subwayStation: formSubway.trim(),
      walkToSubwayMin: Number(formWalkMin) || 0,
      commuteMinutes: Number(formCommuteMin) || 0,
      areaSqMeters: Number(formArea) || 0,
      floor: formFloor.trim(),
      rent: Number(formRent) || 0,
      utilitiesType: formUtilities,
      extraMonthlyFees: {
        propertyFee: Number(formPropertyFee) || 0,
        internetFee: Number(formInternetFee) || 0,
        waterElectricityEst: Number(formWaterElecEst) || 0,
        cleaningFee: 0,
        other: 0,
      },
      landlordType: formLandlord,
      depositTerms: formDepositTerms,
      ratings: formRatings,
      amenities: formAmenities,
      pros: formPros,
      cons: formCons,
      notes: formNotes,
      contactName: formContactName,
      contactPhone: formContactPhone,
      inspectionStatus: editingCandidate ? editingCandidate.inspectionStatus : 'pending',
      inspectionDate: editingCandidate?.inspectionDate,
      checklistResults: editingCandidate?.checklistResults || {},
      weightedScore: calculatedScore,
      isPinned: editingCandidate ? editingCandidate.isPinned : false,
      neighborhoodInfo: editingCandidate?.neighborhoodInfo,
    };

    let updatedCandidates: CandidateProperty[];
    if (editingCandidate) {
      updatedCandidates = plan.candidates.map((c) =>
        c.id === editingCandidate.id ? newCandidateData : c
      );
    } else {
      updatedCandidates = [...plan.candidates, newCandidateData];
    }

    onUpdatePlan({
      ...plan,
      candidates: updatedCandidates,
      updatedAt: new Date().toISOString(),
    });

    setIsModalOpen(false);
  };

  const handleTogglePin = (candidateId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = plan.candidates.map((c) =>
      c.id === candidateId ? { ...c, isPinned: !c.isPinned } : c
    );
    onUpdatePlan({
      ...plan,
      candidates: updated,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDeleteCandidate = (id: string) => {
    if (confirm('确定删除该房源吗？')) {
      onUpdatePlan({
        ...plan,
        candidates: plan.candidates.filter((c) => c.id !== id),
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handleUpdateWeights = (newWeights: Partial<EvaluationWeights>) => {
    const updatedWeights = { ...plan.weights, ...newWeights };
    const updatedCandidates = plan.candidates.map((c) => ({
      ...c,
      weightedScore: calculateWeightedScore(c.ratings, updatedWeights),
    }));

    onUpdatePlan({
      ...plan,
      weights: updatedWeights,
      candidates: updatedCandidates,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleStatusChange = (
    candidateId: string,
    status: CandidateProperty['inspectionStatus']
  ) => {
    onUpdatePlan({
      ...plan,
      candidates: plan.candidates.map((c) =>
        c.id === candidateId ? { ...c, inspectionStatus: status } : c
      ),
      updatedAt: new Date().toISOString(),
    });
  };

  // Save neighborhood grounding search to a candidate
  const handleSaveNeighborhoodToCandidate = (
    candidateId: string,
    summary: string,
    sources: { title: string; url: string }[]
  ) => {
    const updated = plan.candidates.map((c) =>
      c.id === candidateId
        ? {
            ...c,
            neighborhoodInfo: {
              lastQueried: new Date().toISOString(),
              summary,
              sources,
            },
          }
        : c
    );
    onUpdatePlan({ ...plan, candidates: updated, updatedAt: new Date().toISOString() });
  };

  // Filter and sort candidates
  const filteredCandidates = plan.candidates.filter((c) => {
    // 1. Text Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
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

    // 2. Rent Range Filter
    if (rentFilter === 'under1k' && c.rent > 1000) return false;
    if (rentFilter === '1k-2k' && (c.rent <= 1000 || c.rent > 2000)) return false;
    if (rentFilter === '2k-3.5k' && (c.rent <= 2000 || c.rent > 3500)) return false;
    if (rentFilter === 'over3.5k' && c.rent <= 3500) return false;

    // 3. Location / Tag Filters
    if (selectedTagFilters.includes('near_subway') && c.walkToSubwayMin > 10) return false;
    if (selectedTagFilters.includes('residential_utilities') && c.utilitiesType !== 'residential')
      return false;
    if (selectedTagFilters.includes('direct_landlord') && c.landlordType !== 'direct_landlord')
      return false;
    if (selectedTagFilters.includes('elevator') && !c.floor.includes('电梯')) return false;
    if (
      selectedTagFilters.includes('south_facing') &&
      !c.title.includes('南') &&
      !(c.pros || []).some((p) => p.includes('南'))
    )
      return false;

    // 4. Amenities Filter
    if (selectedAmenityFilters.length > 0) {
      const candidateAmenities = new Set(c.amenities || []);
      for (const amenity of selectedAmenityFilters) {
        const hasAmenity =
          candidateAmenities.has(amenity) ||
          (c.pros || []).some((p) => p.includes(amenity)) ||
          (c.notes || '').includes(amenity);
        if (!hasAmenity) return false;
      }
    }

    // 5. Pinned / Starred Filter
    if (onlyPinned && !c.isPinned) return false;

    return true;
  });

  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    // 1. Pinned (高亮优选) candidates always pinned at the top
    const aPinned = a.isPinned ? 1 : 0;
    const bPinned = b.isPinned ? 1 : 0;
    if (aPinned !== bPinned) {
      return bPinned - aPinned;
    }

    // 2. Sort by selected metric
    let result = 0;
    if (sortBy === 'score') {
      result = (b.weightedScore || 0) - (a.weightedScore || 0);
    } else if (sortBy === 'rent') {
      result = a.rent - b.rent;
    } else if (sortBy === 'commute') {
      result = a.commuteMinutes - b.commuteMinutes;
    }
    return sortOrder === 'desc' ? result : -result;
  });

  const pinnedCount = plan.candidates.filter((c) => c.isPinned).length;

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    rentFilter !== 'all' ||
    onlyPinned ||
    selectedTagFilters.length > 0 ||
    selectedAmenityFilters.length > 0;

  const handleResetFilters = () => {
    setSearchQuery('');
    setRentFilter('all');
    setOnlyPinned(false);
    setSelectedTagFilters([]);
    setSelectedAmenityFilters([]);
  };

  const handleToggleTagFilter = (tagId: string) => {
    if (selectedTagFilters.includes(tagId)) {
      setSelectedTagFilters(selectedTagFilters.filter((t) => t !== tagId));
    } else {
      setSelectedTagFilters([...selectedTagFilters, tagId]);
    }
  };

  const handleToggleAmenityFilter = (amenity: string) => {
    if (selectedAmenityFilters.includes(amenity)) {
      setSelectedAmenityFilters(selectedAmenityFilters.filter((a) => a !== amenity));
    } else {
      setSelectedAmenityFilters([...selectedAmenityFilters, amenity]);
    }
  };

  return (
    <div className="w-full space-y-6 animate-fadeIn">
      {/* Title Section */}
      <div className="pt-2 pb-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1
              className={`font-editorial italic text-3xl sm:text-4xl tracking-tight font-normal ${
                isDark ? 'text-neutral-100' : 'text-neutral-950'
              }`}
            >
              房源对比
            </h1>
            <p
              className={`font-mono-code text-[11px] sm:text-xs tracking-[0.22em] uppercase mt-1.5 ${
                isDark ? 'text-neutral-500' : 'text-neutral-500'
              }`}
            >
              PROPERTY MATRIX & MULTI-CANDIDATE SHORTLIST
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!focusMode && (
              <button
                onClick={() => {
                  setSelectedGroundingCandidate(plan.candidates[0] || null);
                  setGroundingModalOpen(true);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-code rounded transition-colors border ${
                  isDark
                    ? 'text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border-neutral-800'
                    : 'text-neutral-700 bg-white hover:bg-neutral-50 border-neutral-200 shadow-2xs'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>周边配套检索 (AI Grounding)</span>
              </button>
            )}

            <button
              onClick={() => setShowWeightSettings(!showWeightSettings)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-code rounded transition-colors border ${
                isDark
                  ? 'text-neutral-400 bg-neutral-900 hover:bg-neutral-800 border-neutral-800'
                  : 'text-neutral-700 bg-white hover:bg-neutral-50 border-neutral-200 shadow-2xs'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-neutral-400" />
              <span>权重设置</span>
            </button>

            <button
              onClick={() => setSourcesModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-code rounded transition-colors border ${
                isDark
                  ? 'text-rose-300 bg-rose-950/30 hover:bg-rose-900/40 border-rose-900/50'
                  : 'text-rose-700 bg-rose-50/80 hover:bg-rose-100 border-rose-200/90 shadow-2xs font-medium'
              }`}
              title="查看各平台找房全渠道对比与避坑口令"
            >
              <Compass className="w-3.5 h-3.5 text-rose-500" />
              <span>房源从哪来？渠道与避坑</span>
            </button>

            <button
              onClick={() => setScraperModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-code font-semibold rounded transition-colors shadow-2xs border ${
                isDark
                  ? 'text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900 border-indigo-700/60'
                  : 'text-indigo-700 bg-indigo-50/90 hover:bg-indigo-100 border-indigo-200'
              }`}
              title="利用 Google 实时搜索全网抓取 58同城/安居客/贝壳/豆瓣等平台最新房源"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span>全网实时抓取房源</span>
            </button>

            <button
              onClick={() => setShowMapView(!showMapView)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-code font-semibold rounded transition-colors shadow-2xs border ${
                showMapView
                  ? isDark
                    ? 'text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900 border-emerald-600/70'
                    : 'text-emerald-700 bg-emerald-50/90 hover:bg-emerald-100 border-emerald-300'
                  : isDark
                  ? 'text-neutral-400 bg-neutral-900 hover:bg-neutral-800 border-neutral-700'
                  : 'text-neutral-600 bg-neutral-50 hover:bg-neutral-100 border-neutral-200'
              }`}
              title="切换城市房源地理坐标与 Google Maps 联动视图"
            >
              <MapPin className={`w-3.5 h-3.5 ${showMapView ? 'text-emerald-500 fill-emerald-500/20' : 'text-neutral-400'}`} />
              <span>{showMapView ? '地图联动已开启' : '开启地图联动'}</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono-code font-semibold rounded transition-colors shadow-xs ${
                isDark
                  ? 'text-neutral-900 bg-neutral-100 hover:bg-white'
                  : 'text-white bg-neutral-900 hover:bg-neutral-800'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ 录入房源</span>
            </button>
          </div>
        </div>

        {/* Collapsible Weights Customizer */}
        {showWeightSettings && (
          <div className="mt-4 pt-4 border-t border-neutral-800 bg-neutral-900/60 p-4 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono-code text-neutral-300">
                评价权重占比设置 // WEIGHTS (总计需为 100%)
              </span>
              <button
                onClick={() =>
                  handleUpdateWeights({
                    priceValue: 35,
                    commute: 25,
                    lightingVentilation: 10,
                    soundproof: 10,
                    spaceLayout: 5,
                    surroundings: 5,
                    hygieneSafety: 10,
                  })
                }
                className="text-[11px] text-neutral-400 hover:text-neutral-200 font-mono-code underline"
              >
                恢复默认配比
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {RATING_DIMENSIONS.map((dim) => (
                <div key={dim.key} className="bg-neutral-900 p-2.5 rounded border border-neutral-800">
                  <div className="text-[11px] font-medium text-neutral-400 mb-1">{dim.label}</div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={plan.weights[dim.key] || 0}
                      onChange={(e) =>
                        handleUpdateWeights({
                          [dim.key]: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      className="w-14 px-2 py-1 text-xs font-bold border border-neutral-700 rounded text-center bg-neutral-950 text-neutral-100 font-mono-code"
                    />
                    <span className="text-xs text-neutral-500">%</span>
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-1 line-clamp-1">{dim.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search & Filter Toolbar */}
      <div
        className={`rounded-lg border p-3.5 space-y-3 ${
          isDark
            ? 'bg-neutral-900/40 border-neutral-800/90'
            : 'bg-white border-neutral-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
        }`}
      >
        {/* Main Search Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Keyword Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索小区、路名、地铁站或特征标签..."
              className={`w-full pl-9 pr-8 py-2 rounded border text-xs font-mono-code outline-none ${
                isDark
                  ? 'border-neutral-800 text-neutral-200 bg-neutral-900 focus:border-neutral-500'
                  : 'border-neutral-200 text-neutral-900 bg-white focus:border-neutral-400 focus:ring-1 focus:ring-neutral-200'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Controls & Filter Drawer Toggle */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-neutral-400 text-[11px]">排序:</span>
            <div
              className={`flex items-center rounded p-0.5 border font-mono-code ${
                isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-neutral-100 border-neutral-200'
              }`}
            >
              <button
                onClick={() => {
                  setSortBy('score');
                  setSortOrder('desc');
                }}
                className={`px-2.5 py-1 rounded transition-colors text-[11px] ${
                  sortBy === 'score'
                    ? isDark
                      ? 'bg-neutral-800 text-neutral-100 font-semibold'
                      : 'bg-white text-neutral-950 font-semibold shadow-2xs'
                    : isDark
                    ? 'text-neutral-500 hover:text-neutral-300'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                加权评分
              </button>
              <button
                onClick={() => {
                  setSortBy('rent');
                  setSortOrder('asc');
                }}
                className={`px-2.5 py-1 rounded transition-colors text-[11px] ${
                  sortBy === 'rent'
                    ? isDark
                      ? 'bg-neutral-800 text-neutral-100 font-semibold'
                      : 'bg-white text-neutral-950 font-semibold shadow-2xs'
                    : isDark
                    ? 'text-neutral-500 hover:text-neutral-300'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                租金由低到高
              </button>
              <button
                onClick={() => {
                  setSortBy('commute');
                  setSortOrder('asc');
                }}
                className={`px-2.5 py-1 rounded transition-colors text-[11px] ${
                  sortBy === 'commute'
                    ? isDark
                      ? 'bg-neutral-800 text-neutral-100 font-semibold'
                      : 'bg-white text-neutral-950 font-semibold shadow-2xs'
                    : isDark
                    ? 'text-neutral-500 hover:text-neutral-300'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                通勤耗时
              </button>
            </div>

            <button
              onClick={() => setShowFilterDrawer(!showFilterDrawer)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded border text-[11px] font-mono-code transition-colors ${
                showFilterDrawer || selectedTagFilters.length > 0 || selectedAmenityFilters.length > 0
                  ? isDark
                    ? 'bg-neutral-800 border-neutral-700 text-neutral-200 font-medium'
                    : 'bg-neutral-900 border-neutral-900 text-white font-medium shadow-2xs'
                  : isDark
                  ? 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-300 shadow-2xs'
              }`}
            >
              <Filter className="w-3 h-3" />
              <span>筛选过滤</span>
              {(selectedTagFilters.length > 0 || selectedAmenityFilters.length > 0) && (
                <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {selectedTagFilters.length + selectedAmenityFilters.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Quick Rent Range Buttons */}
        <div
          className={`flex flex-wrap items-center gap-1.5 pt-1 text-xs border-t ${
            isDark ? 'border-neutral-800/80' : 'border-neutral-100'
          }`}
        >
          <span className="text-neutral-400 text-[11px] mr-1">租金范围:</span>
          {[
            { id: 'all', label: '不限' },
            { id: 'under1k', label: '≤ 1000' },
            { id: '1k-2k', label: '1000 - 2000' },
            { id: '2k-3.5k', label: '2000 - 3500' },
            { id: 'over3.5k', label: '> 3500' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setRentFilter(item.id as RentRange)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono-code transition-colors ${
                rentFilter === item.id
                  ? isDark
                    ? 'bg-neutral-800 text-neutral-100 font-semibold border border-neutral-700'
                    : 'bg-neutral-900 text-white font-semibold shadow-2xs'
                  : isDark
                  ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              {item.label}
            </button>
          ))}

          {/* Quick Pinned / Starred Filter */}
          {pinnedCount > 0 && (
            <button
              onClick={() => setOnlyPinned(!onlyPinned)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] transition-colors ml-1 ${
                onlyPinned
                  ? 'bg-amber-500 text-white font-semibold shadow-2xs'
                  : 'bg-amber-50 text-amber-800 border border-amber-200/90 hover:bg-amber-100 font-medium'
              }`}
              title="仅显示高亮优选置顶的房源"
            >
              <Star
                className={`w-3 h-3 ${
                  onlyPinned ? 'fill-white text-white' : 'fill-amber-400 text-amber-500'
                }`}
              />
              <span>高亮优选 ({pinnedCount})</span>
            </button>
          )}

          {/* Quick Location Tags */}
          <div className="hidden md:flex items-center gap-1 ml-auto">
            {PRESET_TAG_FILTERS.slice(0, 3).map((tag) => {
              const active = selectedTagFilters.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => handleToggleTagFilter(tag.id)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                    active
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Extended Filter Drawer (Location Tags & Amenities) */}
        {showFilterDrawer && (
          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            {/* Location & Lease Attributes */}
            <div>
              <div className="text-[11px] font-medium text-slate-500 mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-400" />
                <span>位置与租约属性：</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TAG_FILTERS.map((tag) => {
                  const active = selectedTagFilters.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => handleToggleTagFilter(tag.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                        active
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amenities Facilities */}
            <div>
              <div className="text-[11px] font-medium text-slate-500 mb-1 flex items-center gap-1">
                <Compass className="w-3 h-3 text-slate-400" />
                <span>配套设施与家电：</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_AMENITIES.map((amenity) => {
                  const active = selectedAmenityFilters.includes(amenity);
                  return (
                    <button
                      key={amenity}
                      onClick={() => handleToggleAmenityFilter(amenity)}
                      className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                        active
                          ? 'bg-emerald-600 text-white font-semibold'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {amenity}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Filter Stats & Reset */}
        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
          <div>
            筛选结果：匹配 <strong>{sortedCandidates.length}</strong> 套 / 共 {plan.candidates.length} 套候选房源
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>清空全部筛选</span>
            </button>
          )}
        </div>
      </div>

      {/* Candidate Cards Grid */}
      {sortedCandidates.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center space-y-3">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">
              {hasActiveFilters ? '没有找到符合筛选条件的房源' : '暂未录入任何候选房源'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {hasActiveFilters
                ? '可以尝试放宽租金区间、取消部分配套过滤项或清空搜索关键词。'
                : '在找房平台看中心仪房源后，录入进来即可使用多维度加权比选并利用 Google Search Grounding 智能排查周边配套。'}
            </p>
          </div>
          {hasActiveFilters ? (
            <button
              onClick={handleResetFilters}
              className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              清空筛选条件
            </button>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                onClick={() => setScraperModalOpen(true)}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>全网实时抓取房源</span>
              </button>
              <button
                onClick={handleOpenAddModal}
                className="px-4 py-2 text-xs font-semibold bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors shadow-xs"
              >
                + 手动录入候选房源
              </button>
              <button
                onClick={() => setSourcesModalOpen(true)}
                className="px-4 py-2 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/90 rounded-lg hover:bg-rose-100 transition-colors flex items-center gap-1.5"
              >
                <Compass className="w-3.5 h-3.5 text-rose-500" />
                <span>房源从哪来？全渠道避坑指南</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className={showMapView ? 'flex flex-col xl:flex-row gap-4 items-start' : ''}>
          <div className={showMapView ? 'w-full xl:w-[58%] shrink-0' : 'w-full'}>
            <div
              className={
                showMapView
                  ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
                  : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
              }
            >
              {sortedCandidates.map((candidate, index) => {
                const monthlyTotal = calculateCandidateMonthlyTotal(candidate);
                const isTopRank = index === 0 && sortBy === 'score';
                const hasGrounding = !!candidate.neighborhoodInfo?.summary;
                const isSelected = selectedCandidateId === candidate.id;

                return (
                  <div
                    key={candidate.id}
                    id={`candidate-card-${candidate.id}`}
                    onMouseEnter={() => setSelectedCandidateId(candidate.id)}
                    className={`rounded-lg border transition-all flex flex-col justify-between ${
                      isSelected
                        ? isDark
                          ? 'ring-2 ring-indigo-500 shadow-md border-indigo-500/80'
                          : 'ring-2 ring-indigo-500 shadow-md border-indigo-400'
                        : ''
                    } ${
                      candidate.isPinned
                        ? isDark
                          ? 'border-amber-500/50 bg-neutral-900/80 ring-1 ring-amber-500/20'
                          : 'border-amber-300 bg-amber-50/20 ring-1 ring-amber-200 shadow-xs'
                        : isTopRank
                        ? isDark
                          ? 'border-neutral-600 bg-neutral-900/60'
                          : 'border-neutral-300 bg-white ring-1 ring-neutral-200 shadow-xs'
                        : isDark
                        ? 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700'
                        : 'border-neutral-200/90 bg-white hover:border-neutral-300 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
                    }`}
                  >
                <div className="p-4 space-y-3">
                  {/* Top Bar: Title & Score */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {candidate.isPinned && (
                          <span
                            className={`font-mono-code text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 border ${
                              isDark
                                ? 'text-amber-400 bg-amber-950/60 border-amber-800/60'
                                : 'text-amber-700 bg-amber-100 border-amber-300'
                            }`}
                          >
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            高亮优选
                          </span>
                        )}
                        {isTopRank && !candidate.isPinned && (
                          <span
                            className={`font-mono-code text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                              isDark
                                ? 'text-rose-400 bg-rose-950/60 border-rose-900/50'
                                : 'text-rose-700 bg-rose-50 border-rose-200'
                            }`}
                          >
                            TOP 1 优选
                          </span>
                        )}
                        <span className="text-[11px] text-neutral-400 font-mono-code">
                          #{index + 1}
                        </span>
                      </div>
                      <h3
                        className={`text-sm font-semibold truncate mt-1 ${
                          isDark ? 'text-neutral-100' : 'text-neutral-900'
                        }`}
                      >
                        {candidate.title}
                      </h3>
                      <div className="text-[11px] text-neutral-400 truncate flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-neutral-400 shrink-0" />
                        <span>{candidate.community}</span>
                        {candidate.address && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{candidate.address}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Interactive Star Button for Pinned Highlight */}
                      <button
                        onClick={(e) => handleTogglePin(candidate.id, e)}
                        className={`p-1.5 rounded transition-all ${
                          candidate.isPinned
                            ? isDark
                              ? 'text-amber-400 bg-amber-950/40 border border-amber-800/60'
                              : 'text-amber-600 bg-amber-50 border border-amber-200'
                            : isDark
                            ? 'text-neutral-600 hover:text-amber-400 hover:bg-neutral-800'
                            : 'text-neutral-400 hover:text-amber-500 hover:bg-neutral-100'
                        }`}
                        title={
                          candidate.isPinned
                            ? '取消高亮优选置顶'
                            : '设为高亮优选（固定在最上方对比）'
                        }
                        aria-label={candidate.isPinned ? '取消高亮优选置顶' : '设为高亮优选'}
                      >
                        <Star
                          className={`w-4 h-4 transition-transform active:scale-125 ${
                            candidate.isPinned ? 'fill-amber-400 text-amber-400' : ''
                          }`}
                        />
                      </button>

                      <div
                        className={`text-right pl-2 border-l ${
                          isDark ? 'border-neutral-800' : 'border-neutral-200'
                        }`}
                      >
                        <div
                          className={`text-lg font-bold font-mono-code ${
                            isDark ? 'text-neutral-100' : 'text-neutral-900'
                          }`}
                        >
                          {candidate.weightedScore || 0}
                        </div>
                        <div className="text-[10px] text-neutral-400">综合得分</div>
                      </div>
                    </div>
                  </div>

                  {/* Financial & Core Specs */}
                  <div
                    className={`rounded p-2.5 border grid grid-cols-2 gap-2 text-xs ${
                      isDark
                        ? 'bg-neutral-950/60 border-neutral-800/80'
                        : 'bg-neutral-50/80 border-neutral-100'
                    }`}
                  >
                    <div>
                      <span className="text-neutral-400 text-[10px] block">月租金</span>
                      <span
                        className={`font-bold font-mono-code text-sm ${
                          isDark ? 'text-neutral-100' : 'text-neutral-950'
                        }`}
                      >
                        ¥{candidate.rent}
                      </span>
                      <span className="text-[10px] text-neutral-400 block">
                        含杂费约 ¥{monthlyTotal}/月
                      </span>
                    </div>

                    <div>
                      <span className="text-neutral-400 text-[10px] block">通勤耗时</span>
                      <span
                        className={`font-bold font-mono-code text-sm ${
                          isDark ? 'text-neutral-200' : 'text-neutral-900'
                        }`}
                      >
                        {candidate.commuteMinutes} 分钟
                      </span>
                      <span className="text-[10px] text-neutral-400 block truncate">
                        步行{candidate.walkToSubwayMin}m 至 {candidate.subwayStation || '地铁站'}
                      </span>
                    </div>
                  </div>

                  {/* Attributes & Amenities (Zero-pill text separators) */}
                  <div
                    className={`text-[11px] flex flex-wrap items-center gap-1.5 ${
                      isDark ? 'text-neutral-400' : 'text-neutral-600'
                    }`}
                  >
                    <span>{candidate.utilitiesType === 'residential' ? '民水民电' : '商水商电'}</span>
                    <span
                      aria-hidden="true"
                      className={isDark ? 'text-neutral-600' : 'text-neutral-300'}
                    >
                      ·
                    </span>
                    <span>{candidate.landlordType === 'direct_landlord' ? '房东直租' : '中介/公寓'}</span>
                    {candidate.floor && (
                      <>
                        <span
                          aria-hidden="true"
                          className={isDark ? 'text-neutral-600' : 'text-neutral-300'}
                        >
                          ·
                        </span>
                        <span>{candidate.floor}</span>
                      </>
                    )}
                    {candidate.areaSqMeters && (
                      <>
                        <span
                          aria-hidden="true"
                          className={isDark ? 'text-neutral-600' : 'text-neutral-300'}
                        >
                          ·
                        </span>
                        <span>{candidate.areaSqMeters}㎡</span>
                      </>
                    )}
                  </div>

                  {/* Neighborhood Search Grounding Info Preview / Action Button (Hidden in Focus Mode) */}
                  {!focusMode && (
                    <div className="pt-1">
                      <button
                        onClick={() => {
                          setSelectedGroundingCandidate(candidate);
                          setGroundingModalOpen(true);
                        }}
                        className={`w-full py-1.5 px-2.5 rounded text-xs font-mono-code flex items-center justify-between transition-colors border ${
                          hasGrounding
                            ? isDark
                              ? 'bg-neutral-800/90 border-neutral-700 text-neutral-200 hover:bg-neutral-800'
                              : 'bg-neutral-100 border-neutral-300 text-neutral-900 hover:bg-neutral-200/70'
                            : isDark
                            ? 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-400'
                            : 'bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-600'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="truncate">
                            {hasGrounding ? '查看配套检索 (Grounding)' : '检索周边生活配套'}
                          </span>
                        </div>
                        <ExternalLink className="w-3 h-3 text-neutral-400 shrink-0" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer Operations */}
                <div
                  className={`p-3 border-t flex items-center justify-between text-xs ${
                    isDark
                      ? 'border-neutral-800/80 bg-neutral-950/40'
                      : 'border-neutral-100 bg-neutral-50/50'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(candidate)}
                      className={`p-1 rounded transition-colors ${
                        isDark
                          ? 'text-neutral-500 hover:text-neutral-200'
                          : 'text-neutral-400 hover:text-neutral-800'
                      }`}
                      title="编辑房源详情"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCandidate(candidate.id)}
                      className={`p-1 rounded transition-colors ${
                        isDark
                          ? 'text-neutral-500 hover:text-rose-400'
                          : 'text-neutral-400 hover:text-rose-600'
                      }`}
                      title="删除房源"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMapView(true);
                        setSelectedCandidateId(candidate.id);
                      }}
                      className={`p-1 rounded transition-colors flex items-center gap-1 text-[11px] font-mono-code ${
                        selectedCandidateId === candidate.id
                          ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 font-bold'
                          : isDark
                          ? 'text-neutral-400 hover:text-neutral-200'
                          : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                      title="在地图中高亮定位该房源"
                    >
                      <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="hidden sm:inline">地图</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {onSelectCandidateForInspection && (
                      <button
                        onClick={() => onSelectCandidateForInspection(candidate.id)}
                        className={`px-2.5 py-1 text-xs font-mono-code rounded transition-colors ${
                          isDark
                            ? 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
                            : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100'
                        }`}
                      >
                        去验房 →
                      </button>
                    )}
                    <select
                      value={candidate.inspectionStatus}
                      onChange={(e) => handleStatusChange(candidate.id, e.target.value as any)}
                      className={`px-2 py-1 text-[11px] font-mono-code rounded border outline-none ${
                        isDark
                          ? 'border-neutral-800 bg-neutral-900 text-neutral-300'
                          : 'border-neutral-200 bg-white text-neutral-800 shadow-2xs'
                      }`}
                    >
                      <option value="pending">待看房</option>
                      <option value="scheduled">已约看</option>
                      <option value="visited">已实地验房</option>
                      <option value="shortlisted">已入选签约</option>
                      <option value="rejected">已淘汰</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
            </div>
          </div>

          {/* Right Column: Google Maps Container */}
          {showMapView && (
            <div className="w-full xl:w-[42%] xl:sticky xl:top-20 shrink-0 space-y-2">
              <CandidatePropertiesMap
                candidates={sortedCandidates}
                city={plan.city}
                selectedCandidateId={selectedCandidateId}
                onSelectCandidate={(id) => {
                  setSelectedCandidateId(id);
                  const el = document.getElementById(`candidate-card-${id}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }
                }}
                isDark={isDark}
                onCloseMap={() => setShowMapView(false)}
              />
            </div>
          )}
        </div>
      )}

      {/* Neighborhood Amenities Search Grounding Modal */}
      <NeighborhoodSearchModal
        isOpen={groundingModalOpen}
        onClose={() => setGroundingModalOpen(false)}
        candidate={selectedGroundingCandidate}
        defaultCity={plan.city}
        onSaveToCandidate={handleSaveNeighborhoodToCandidate}
      />

      {/* Candidate Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl my-8 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-slate-900">
                {editingCandidate ? '编辑候选房源信息' : '添加新的候选房源'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Smart Paste Quick Extract */}
              {!editingCandidate && (
                <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>从外部找房平台一键智能解析粘贴</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSourcesModalOpen(true)}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 underline font-medium"
                    >
                      房源渠道避坑指南 →
                    </button>
                  </div>
                  <p className="text-[11px] text-indigo-700/90 leading-normal">
                    从贝壳/闲鱼/豆瓣/小红书或微信复制房源文本，粘贴在下方，一键提取租金、小区、面积、房东类型与配套：
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={smartPasteInput}
                      onChange={(e) => setSmartPasteInput(e.target.value)}
                      placeholder="例：翠苑一区 朝南主卧独卫 2600元/月 押一付三 25平 房东直租无中介费 距地铁站步行5分钟..."
                      className="flex-1 px-3 py-1.5 rounded-lg border border-indigo-200 bg-white text-neutral-800 outline-none focus:border-indigo-500 font-mono-code text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={handleSmartParse}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors shrink-0 text-xs shadow-xs"
                    >
                      智能提取填充
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px] text-indigo-800/80">
                    <span className="text-neutral-500">快速填入测试样例：</span>
                    <button
                      type="button"
                      onClick={() => {
                        const sample =
                          '【58同城】翠苑三区 朝南带阳台大单间 2200元/月 押一付一 26平米 电梯6层 距古翠路地铁站步行4分钟 民用水电 房东本人直租 13812345678';
                        setSmartPasteInput(sample);
                        const parsed = parseListingText(sample);
                        if (parsed.title) setFormTitle(parsed.title);
                        if (parsed.community) setFormCommunity(parsed.community);
                        if (parsed.rent) setFormRent(parsed.rent);
                        if (parsed.areaSqMeters) setFormArea(parsed.areaSqMeters);
                        if (parsed.floor) setFormFloor(parsed.floor);
                        if (parsed.walkToSubwayMin) setFormWalkMin(parsed.walkToSubwayMin);
                        if (parsed.depositTerms) setFormDepositTerms(parsed.depositTerms);
                        if (parsed.contactPhone) setFormContactPhone(parsed.contactPhone);
                        if (parsed.utilitiesType) setFormUtilities(parsed.utilitiesType as any);
                        if (parsed.landlordType) setFormLandlord('direct_landlord');
                        if (parsed.amenities) setFormAmenities(parsed.amenities);
                      }}
                      className="px-2 py-0.5 rounded bg-indigo-100/70 hover:bg-indigo-200/80 text-indigo-900 border border-indigo-200/60 font-mono-code transition-colors"
                    >
                      58同城样例
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const sample =
                          '【贝壳找房】万科未来城二期 1室1厅1卫 3200元/月 42㎡ 8F/18F电梯 距良渚地铁站步行8分钟 集中供暖 精装修带阳台 链家经纪人带看';
                        setSmartPasteInput(sample);
                        const parsed = parseListingText(sample);
                        if (parsed.title) setFormTitle(parsed.title);
                        if (parsed.community) setFormCommunity(parsed.community);
                        if (parsed.rent) setFormRent(parsed.rent);
                        if (parsed.areaSqMeters) setFormArea(parsed.areaSqMeters);
                        if (parsed.floor) setFormFloor(parsed.floor);
                        if (parsed.walkToSubwayMin) setFormWalkMin(parsed.walkToSubwayMin);
                        if (parsed.depositTerms) setFormDepositTerms('押一付三');
                        if (parsed.landlordType) setFormLandlord('intermediary');
                        if (parsed.amenities) setFormAmenities(['精装修', '阳台晾晒', '带电梯']);
                      }}
                      className="px-2 py-0.5 rounded bg-indigo-100/70 hover:bg-indigo-200/80 text-indigo-900 border border-indigo-200/60 font-mono-code transition-colors"
                    >
                      贝壳找房样例
                    </button>
                  </div>
                </div>
              )}

              {/* Basic Info */}
              <div className="space-y-3">
                <div className="font-bold text-slate-800 uppercase tracking-wider">
                  基础房源信息
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">房源标题 *</label>
                    <input
                      type="text"
                      placeholder="例：翠苑一区 朝南主卧独卫"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">所属小区/公寓名</label>
                    <input
                      type="text"
                      placeholder="例：翠苑一区"
                      value={formCommunity}
                      onChange={(e) => setFormCommunity(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">月租金 (元) *</label>
                    <input
                      type="number"
                      value={formRent}
                      onChange={(e) => setFormRent(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">室内面积 (㎡)</label>
                    <input
                      type="number"
                      value={formArea}
                      onChange={(e) => setFormArea(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">楼层与电梯</label>
                    <input
                      type="text"
                      placeholder="例：8F/18F 电梯"
                      value={formFloor}
                      onChange={(e) => setFormFloor(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                </div>
              </div>

              {/* Commute & Utilities */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="font-bold text-slate-800 uppercase tracking-wider">
                  通勤与水电气属性
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">最近地铁站</label>
                    <input
                      type="text"
                      placeholder="例：高新园站B口"
                      value={formSubway}
                      onChange={(e) => setFormSubway(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">步行至地铁 (分钟)</label>
                    <input
                      type="number"
                      value={formWalkMin}
                      onChange={(e) => setFormWalkMin(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">单程通勤耗时 (分钟)</label>
                    <input
                      type="number"
                      value={formCommuteMin}
                      onChange={(e) => setFormCommuteMin(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">水电气类别</label>
                    <select
                      value={formUtilities}
                      onChange={(e) => setFormUtilities(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="residential">民水民电 (独立缴费)</option>
                      <option value="commercial">商水商电 (房东代收)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">出租方主体</label>
                    <select
                      value={formLandlord}
                      onChange={(e) => setFormLandlord(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="direct_landlord">房东直租 (无中介费)</option>
                      <option value="intermediary">正规中介机构</option>
                      <option value="brand_apartment">品牌公寓/自如</option>
                      <option value="sublessor">二房东/个人转租</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">押金方式</label>
                    <input
                      type="text"
                      value={formDepositTerms}
                      onChange={(e) => setFormDepositTerms(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                </div>
              </div>

              {/* Amenities Checklist */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <div className="font-bold text-slate-800 uppercase tracking-wider">
                  配套设施与家电
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_AMENITIES.map((amenity) => {
                    const active = formAmenities.includes(amenity);
                    return (
                      <button
                        type="button"
                        key={amenity}
                        onClick={() => handleToggleFormAmenity(amenity)}
                        className={`px-2.5 py-1 rounded-md text-xs transition-colors flex items-center gap-1 ${
                          active
                            ? 'bg-indigo-600 text-white font-semibold'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {active && <Check className="w-3 h-3" />}
                        <span>{amenity}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ratings */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 uppercase tracking-wider">
                    多维度打分量化 (0 ~ 10分)
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    加权计算分:{' '}
                    <strong className="text-indigo-600 text-sm">
                      {calculateWeightedScore(formRatings, plan.weights)}
                    </strong>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {RATING_DIMENSIONS.map((dim) => (
                    <div
                      key={dim.key}
                      className="bg-slate-50 p-2.5 rounded-lg border border-slate-200"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-slate-700">{dim.label}</span>
                        <span className="font-extrabold text-indigo-700">
                          {formRatings[dim.key]} 分
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={0.5}
                        value={formRatings[dim.key]}
                        onChange={(e) =>
                          setFormRatings({
                            ...formRatings,
                            [dim.key]: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Pros & Cons */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="font-bold text-slate-800 uppercase tracking-wider">
                  亮点与缺点备忘
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">亮点 (回车添加)</label>
                    <input
                      type="text"
                      placeholder="如：实木家具九成新"
                      value={tempPro}
                      onChange={(e) => setTempPro(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && tempPro.trim()) {
                          e.preventDefault();
                          setFormPros([...formPros, tempPro.trim()]);
                          setTempPro('');
                        }
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {formPros.map((p, idx) => (
                        <span
                          key={idx}
                          className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px] flex items-center gap-1"
                        >
                          {p}
                          <button
                            type="button"
                            onClick={() => setFormPros(formPros.filter((_, i) => i !== idx))}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">缺点 (回车添加)</label>
                    <input
                      type="text"
                      placeholder="如：隔音一般"
                      value={tempCon}
                      onChange={(e) => setTempCon(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && tempCon.trim()) {
                          e.preventDefault();
                          setFormCons([...formCons, tempCon.trim()]);
                          setTempCon('');
                        }
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {formCons.map((c, idx) => (
                        <span
                          key={idx}
                          className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[11px] flex items-center gap-1"
                        >
                          {c}
                          <button
                            type="button"
                            onClick={() => setFormCons(formCons.filter((_, i) => i !== idx))}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">联系人</label>
                    <input
                      type="text"
                      placeholder="例：房东张阿姨"
                      value={formContactName}
                      onChange={(e) => setFormContactName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">电话 / 微信</label>
                    <input
                      type="text"
                      placeholder="138****0000"
                      value={formContactPhone}
                      onChange={(e) => setFormContactPhone(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-2xs"
              >
                保存房源
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Property Sourcing Guide & Red Flags Modal */}
      <PropertySourcesModal
        isOpen={sourcesModalOpen}
        onClose={() => setSourcesModalOpen(false)}
        city={plan.city}
      />

      {/* Live Web Listing Scraper & Search Grounding Modal */}
      <LiveListingScraperModal
        isOpen={scraperModalOpen}
        onClose={() => setScraperModalOpen(false)}
        defaultCity={plan.city}
        defaultBudgetMax={plan.budget.maxMonthlyRent || 2800}
        onBatchImport={handleBatchImportScrapedListings}
      />
    </div>
  );
};

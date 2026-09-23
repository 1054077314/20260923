import { BudgetConfig, CandidateProperty, EvaluationWeights } from '../types/rental';

export function calculateStartupFund(budget: BudgetConfig) {
  const deposit = budget.maxMonthlyRent * budget.depositMonths;
  const advanceRent = budget.maxMonthlyRent * budget.payMonths;
  const agencyFee = Math.round(budget.maxMonthlyRent * budget.agencyFeeRate);
  const moving = budget.movingBudget || 0;
  const supplies = budget.initialSuppliesBudget || 0;

  const total = deposit + advanceRent + agencyFee + moving + supplies;

  return {
    deposit,
    advanceRent,
    agencyFee,
    moving,
    supplies,
    total,
  };
}

export function calculateRentBurden(monthlyIncome: number, monthlyRent: number) {
  if (!monthlyIncome || monthlyIncome <= 0) return { ratio: 0, status: 'unknown' as const };
  const ratio = (monthlyRent / monthlyIncome) * 100;

  let status: 'healthy' | 'moderate' | 'high_risk';
  if (ratio <= 25) {
    status = 'healthy';
  } else if (ratio <= 35) {
    status = 'moderate';
  } else {
    status = 'high_risk';
  }

  return {
    ratio: Number(ratio.toFixed(1)),
    status,
  };
}

export function calculateCandidateMonthlyTotal(item: CandidateProperty): number {
  const extra = item.extraMonthlyFees || {
    propertyFee: 0,
    internetFee: 0,
    waterElectricityEst: 0,
    cleaningFee: 0,
    other: 0,
  };
  return (
    item.rent +
    (extra.propertyFee || 0) +
    (extra.internetFee || 0) +
    (extra.waterElectricityEst || 0) +
    (extra.cleaningFee || 0) +
    (extra.other || 0)
  );
}

export function calculateWeightedScore(
  ratings: CandidateProperty['ratings'],
  weights: EvaluationWeights
): number {
  const totalWeight =
    (weights.priceValue || 0) +
    (weights.commute || 0) +
    (weights.lightingVentilation || 0) +
    (weights.soundproof || 0) +
    (weights.spaceLayout || 0) +
    (weights.surroundings || 0) +
    (weights.hygieneSafety || 0);

  if (totalWeight === 0) return 0;

  const raw =
    (ratings.priceValue || 0) * (weights.priceValue || 0) +
    (ratings.commute || 0) * (weights.commute || 0) +
    (ratings.lightingVentilation || 0) * (weights.lightingVentilation || 0) +
    (ratings.soundproof || 0) * (weights.soundproof || 0) +
    (ratings.spaceLayout || 0) * (weights.spaceLayout || 0) +
    (ratings.surroundings || 0) * (weights.surroundings || 0) +
    (ratings.hygieneSafety || 0) * (weights.hygieneSafety || 0);

  // Ratings are 0-10, so raw / totalWeight gives 0-10, multiply by 10 for 0-100 scale
  const finalScore = (raw / totalWeight) * 10;
  return Number(finalScore.toFixed(1));
}

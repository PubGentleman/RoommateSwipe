export const OUTREACH_PLAN_LIMITS: Record<string, {
  dailyCap: number;
  hourlyCap: number;
}> = {
  free:     { dailyCap: 0,  hourlyCap: 0 },
  starter:  { dailyCap: 0,  hourlyCap: 0 },
  pro:      { dailyCap: 3,  hourlyCap: 2 },
  business: { dailyCap: 10, hourlyCap: 3 },
};

export const UNLOCK_PACKAGES = [
  { id: 'small', label: '+3 messages today',  credits: 3,  priceCents: 499  },
  { id: 'large', label: '+10 messages today', credits: 10, priceCents: 1299 },
];

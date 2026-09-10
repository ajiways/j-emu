export type ListingAttachment = Readonly<{
  originalItemId: number;
  artifactId: number;
  quantity: number;
  durability: number;
  durabilityMax: number;
  upgradeId: number;
  upgradeLevel: number;
  upgradeSkillId: string;
  upgradeBound: 0 | 1;
}>;

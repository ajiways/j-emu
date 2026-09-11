export type AssistantTypeDocument = Readonly<{
  id: number;
  title: string;
  description: string;
  profession: number;
  level: number;
  quality: number;
  nextArtikulId: number;
  skillSum: number;
  price: number;
  priceType: number;
  picture: string;
  restrictionsXml: string;
  voodooEnergy: number;
}>;

export type FarmResourceDocument = Readonly<{
  id: number;
  title: string;
  typeId: number;
  picture: string;
  swf: string;
  quality: number;
  profession: number;
  artifactArtikulId: number;
  masteryValue: number;
  masteryMax: number;
  farmTime: number;
  staminaDrain: number;
}>;

export type AreaFarmDocument = Readonly<{
  areaId: string;
  huntSpotId: number;
  farmId: number;
  tactics: number;
  assistantMax: number;
  cntMax: number;
  cntCurrent: number;
  cntCooldown: number;
}>;

export type AssistantTypeDefinition = Readonly<{
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

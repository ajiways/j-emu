export type FarmResourceDefinition = Readonly<{
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

export type ArtifactBrief = Readonly<{
  id: number;
  title: string;
  picture: string;
  kindId: number;
  typeId: string;
}>;

export type ArtifactSearchQuery = Readonly<{
  text: string;
  limit: number;
  ids?: readonly number[];
}>;

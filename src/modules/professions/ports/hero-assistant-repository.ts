import type { HeroAssistant, HeroAssistantInsert } from "../domain/hero-assistant.ts";

export interface HeroAssistantRepository {
  listByHero(heroId: number): Promise<HeroAssistant[]>;
  findById(heroId: number, id: number): Promise<HeroAssistant | null>;
  insert(row: HeroAssistantInsert): Promise<HeroAssistant>;
  save(row: HeroAssistant): Promise<void>;
  delete(id: number): Promise<void>;
  listDue(nowSec: number): Promise<HeroAssistant[]>;
}

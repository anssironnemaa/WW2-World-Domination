// AUTO-GENERATED from WW2_World_Dominance_Taulukot.xlsx — do not edit manually
import type { UnitType } from "./types"

export const UNIT_TYPES: Record<string, UnitType> = {
  partisan: { id: "partisan", nameFI: "Partisaani", cost: 2, buildTime: 1, attack: 0, defend: 1, move: 0, category: "infantry", special: "V\u00e4ijytys: 1 ilmainen laukaus vihollisen saapuessa. Sabotaasi: Laskee alueen IPC-arvoa -1. Sijoitetaan salaa miehitettyyn kotimaahan." },
  infantry: { id: "infantry", nameFI: "Jalkav\u00e4ki", cost: 3, buildTime: 1, attack: 1, defend: 2, move: 1, category: "infantry", special: "Halpa perusyksikk\u00f6 tappioiden ottamiseen." },
  artillery: { id: "artillery", nameFI: "Tykist\u00f6", cost: 4, buildTime: 1, attack: 2, defend: 2, move: 1, category: "infantry", special: "Tulituki: Jokainen tykist\u00f6 nostaa 1 jalkav\u00e4en H-arvon 2:een." },
  mechanized_infantry: { id: "mechanized_infantry", nameFI: "Mek. Jalkav\u00e4ki", cost: 4, buildTime: 2, attack: 1, defend: 2, move: 2, category: "infantry", special: "Vaatii Tason 1 Teknologian. Voi liikkua 2 aluetta panssarin mukana." },
  tank: { id: "tank", nameFI: "Panssarivaunu", cost: 6, buildTime: 2, attack: 3, defend: 3, move: 2, category: "armor", special: "Salamasota: Liike 2 aluetta (jos reitill\u00e4 ei ole partisaaneja)." },
  fighter: { id: "fighter", nameFI: "H\u00e4vitt\u00e4j\u00e4", cost: 10, buildTime: 3, attack: 3, defend: 4, move: 4, category: "air", special: "Voi laskeutua tukialukselle. Tutka-teknologialla Ensi-isku puolustaessa." },
  bomber: { id: "bomber", nameFI: "Pommikone", cost: 12, buildTime: 3, attack: 4, defend: 1, move: 6, category: "air", special: "Strateginen pommitus: Tuhoaa tehtaiden IPC:t\u00e4 (noppaluvun verran)." },
  submarine: { id: "submarine", nameFI: "Sukellusvene", cost: 6, buildTime: 3, attack: 2, defend: 1, move: 2, category: "navy", special: "Yll\u00e4tys: Ensi-isku, ellei vihollisella ole H\u00e4vitt\u00e4j\u00e4laivaa. Voi sulkea Lend-Lease reittej\u00e4." },
  transport: { id: "transport", nameFI: "Kuljetusalus", cost: 7, buildTime: 3, attack: 0, defend: 0, move: 2, category: "navy", special: "Kantaa 1 JV + 1 muun maayksik\u00f6n. Tuhoutuu automaattisesti osumasta ilman saattuetta." },
  destroyer: { id: "destroyer", nameFI: "H\u00e4vitt\u00e4j\u00e4laiva", cost: 8, buildTime: 3, attack: 2, defend: 2, move: 2, category: "navy", special: "Kaikuluotain: Kumoaa sukellusveneiden yll\u00e4tysedun." },
  cruiser: { id: "cruiser", nameFI: "Risteilij\u00e4", cost: 12, buildTime: 3, attack: 3, defend: 3, move: 2, category: "navy", special: "Rannikkotuki: H:3 laukaus maihinnousussa." },
  carrier: { id: "carrier", nameFI: "Lentotukialus", cost: 14, buildTime: 4, attack: 1, defend: 2, move: 2, category: "navy", special: "Kantaa 2 h\u00e4vitt\u00e4j\u00e4\u00e4. Tason 3 teknologialla kest\u00e4\u00e4 2 osumaa." },
}

// English display names + a helper (the source table is Finnish).
export const UNIT_NAME_EN: Record<string, string> = {
  partisan: "Partisans", infantry: "Infantry", artillery: "Artillery",
  mechanized_infantry: "Mech. Infantry", tank: "Tank", fighter: "Fighter",
  bomber: "Bomber", submarine: "Submarine", transport: "Transport",
  destroyer: "Destroyer", cruiser: "Cruiser", carrier: "Carrier", battleship: "Battleship",
}

export function unitName(uid: string): string {
  return UNIT_NAME_EN[uid] ?? UNIT_TYPES[uid]?.nameFI ?? uid
}

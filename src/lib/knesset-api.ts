/**
 * Knesset Open Data API client
 * Base URL: https://knesset.gov.il/Odata/ParliamentInfo.svc/
 * Real entity names discovered from $metadata endpoint.
 *
 * Key entities used:
 *  - KNS_Person              → PersonID, FirstName, LastName, GenderID, Email, IsCurrent
 *  - KNS_PersonToPosition    → PersonID, PositionID, KnessetNum, FactionID, FactionName,
 *                               GovMinistryName, IsCurrent
 *  - KNS_Faction             → FactionID, Name, KnessetNum, IsCurrent
 *  - KNS_Bill                → BillID, Name, KnessetNum, StatusID, SubTypeID, PublicationDate
 *  - KNS_BillInitiator       → BillID, PersonID, IsInitiator
 *  - KNS_PlenumSession       → PlenumSessionID, Number, KnessetNum, StartDate, FinishDate
 *
 * PositionIDs relevant to MKs:
 *   43 = חבר הכנסת (male MK)
 *   61 = חברת הכנסת (female MK)
 *   54 = חבר/ת סיעה (faction member — used for faction assignment)
 *   45 = ראש הממשלה (PM)
 *   39 = שר (minister, male)
 *   57 = שרה (minister, female)
 *   31 = משנה לראש הממשלה (deputy PM)
 *   50 = סגן ראש הממשלה (vice PM)
 *   122 = יושב-ראש הכנסת (Speaker)
 *   123 = יושבת-ראש הכנסת (Speaker, female)
 *   131/130 = ראש האופוזיציה (Opposition leader)
 *
 * Bill StatusID 118 = "התקבלה בקריאה שלישית" (passed third reading = law)
 */

/** Map of all Knesset bill StatusIDs (TypeID=2 from KNS_Status) */
export const BILL_STATUS: Record<number, { he: string; en: string; category: 'passed' | 'active' | 'stopped' }> = {
  101: { he: 'הכנה לקריאה ראשונה',                      en: 'Preparing for 1st reading',         category: 'active'  },
  104: { he: 'על שולחן הכנסת – דיון מוקדם',              en: 'On table – preliminary discussion',  category: 'active'  },
  106: { he: 'בוועדת הכנסת – קביעת ועדה',               en: 'In Knesset committee',               category: 'active'  },
  108: { he: 'הכנה לקריאה ראשונה',                      en: 'Preparing for 1st reading',         category: 'active'  },
  109: { he: 'אושרה לקריאה ראשונה',                     en: 'Approved for 1st reading',          category: 'active'  },
  110: { he: 'דין רציפות נדחה',                          en: 'Continuity request rejected',       category: 'stopped' },
  111: { he: 'במליאה – לפני קריאה ראשונה',              en: 'In plenary before 1st reading',     category: 'active'  },
  113: { he: 'הכנה לקריאה שנייה ושלישית',               en: 'Preparing for 2nd & 3rd reading',  category: 'active'  },
  114: { he: 'במליאה – לפני קריאה שנייה-שלישית',        en: 'In plenary before 2nd-3rd reading', category: 'active'  },
  115: { he: 'הוחזרה לוועדה – קריאה שלישית',            en: 'Returned to committee – 3rd reading', category: 'active' },
  117: { he: 'במליאה – לפני קריאה שלישית',              en: 'In plenary before 3rd reading',     category: 'active'  },
  118: { he: 'חוק',                                      en: 'Passed (became law)',               category: 'passed'  },
  120: { he: 'דיון רציפות במליאה',                       en: 'Continuity discussion in plenary',  category: 'active'  },
  122: { he: 'מוזגה עם הצעה אחרת',                      en: 'Merged with another bill',          category: 'stopped' },
  124: { he: 'הוסבה להצעה לסדר היום',                   en: 'Converted to motion',               category: 'stopped' },
  126: { he: 'אישור מיזוג – ועדת הכנסת',                en: 'Merger approval pending',           category: 'active'  },
  130: { he: 'על שולחן הכנסת – קריאה שנייה-שלישית',    en: 'On table – 2nd-3rd reading',        category: 'active'  },
  131: { he: 'על שולחן הכנסת – קריאה שלישית',          en: 'On table – 3rd reading',            category: 'active'  },
  140: { he: 'להסרה מסדר היום',                         en: 'Pending removal from agenda',       category: 'active'  },
  141: { he: 'על שולחן הכנסת – קריאה ראשונה',          en: 'On table – 1st reading',            category: 'active'  },
  142: { he: 'בוועדת הכנסת – קביעת ועדה',              en: 'In Knesset committee',              category: 'active'  },
  143: { he: 'להסרה מסדר היום',                         en: 'Pending removal from agenda',       category: 'active'  },
  150: { he: 'במליאה – דיון מוקדם',                     en: 'In plenary – preliminary debate',   category: 'active'  },
  158: { he: 'לאישור פיצול',                            en: 'Awaiting split approval',           category: 'active'  },
  161: { he: 'לאישור פיצול',                            en: 'Awaiting split approval',           category: 'active'  },
  162: { he: 'לאישור פיצול',                            en: 'Awaiting split approval',           category: 'active'  },
  165: { he: 'לאישור פיצול',                            en: 'Awaiting split approval',           category: 'active'  },
  167: { he: 'אושרה לקריאה ראשונה',                    en: 'Approved for 1st reading',          category: 'active'  },
  169: { he: 'לאישור מיזוג – ועדת הכנסת',              en: 'Merger approval – Knesset committee', category: 'active' },
  175: { he: 'דיון רציפות בוועדה',                      en: 'Continuity in committee',           category: 'active'  },
  176: { he: 'דין רציפות נדחה בוועדה',                 en: 'Continuity rejected in committee',  category: 'stopped' },
  177: { he: 'נעצרה',                                   en: 'Stopped',                           category: 'stopped' },
  178: { he: 'אושרה לקריאה שנייה-שלישית',              en: 'Approved for 2nd-3rd reading',      category: 'active'  },
  179: { he: 'אושרה לקריאה שנייה-שלישית',              en: 'Approved for 2nd-3rd reading',      category: 'active'  },
  181: { he: 'הודעה על בקשת דין רציפות',               en: 'Continuity request notice',         category: 'active'  },
};

export function billStatusLabel(statusId: number | null, lang: 'he' | 'en'): string {
  if (statusId === null) return lang === 'he' ? 'הוגשה' : 'Filed';
  return BILL_STATUS[statusId]?.[lang] ?? (lang === 'he' ? `סטטוס ${statusId}` : `Status ${statusId}`);
}

export function billStatusCategory(statusId: number | null): 'passed' | 'active' | 'stopped' {
  if (statusId === null) return 'active';
  return BILL_STATUS[statusId]?.category ?? 'active';
}

const BASE = 'https://knesset.gov.il/Odata/ParliamentInfo.svc';
export const CURRENT_KNESSET = 25;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RealMember {
  PersonID: number;
  FirstName: string;
  LastName: string;
  FullName: string;          // FirstName + LastName
  FullNameEng: string;       // English transliteration (from our map)
  GenderID: number;          // 250=female, 251=male
  Email: string | null;
  FactionID: number | null;
  FactionName: string;       // Hebrew faction name
  FactionNameEng: string;    // English faction name (from our map)
  RoleHe: string;            // e.g. "שר האוצר"
  RoleEng: string;           // e.g. "Finance Minister"
  GovMinistryName: string | null;
  BillsProposed: number;
  BillsPassed: number;
  AttendancePct: number | null;  // null = not yet loaded
}

export interface RealParty {
  FactionID: number;
  Name: string;
  NameEng: string;
  Seats: number;
  IsCoalition: boolean;
  Members: number[];  // PersonIDs
}

export interface RealBill {
  BillID: number;
  Name: string;
  KnessetNum: number;
  StatusID: number;
  StatusDesc: string;
  SubTypeDesc: string;  // "ממשלתית" | "פרטית"
  IsGovernment: boolean;
  PublicationDate: string | null;
}

export interface MKVote {
  VoteID: number;
  VoteDate: string;
  Title: string;
  Decision: 'for' | 'against' | 'abstain' | 'absent';
}

// ─── English Name / Faction Maps ─────────────────────────────────────────────
// The Knesset API only provides Hebrew names. These mappings supply English translations.

export const FACTION_ENG: Record<number, string> = {
  1095: 'Shas',
  1096: 'Likud',
  1097: 'Religious Zionism',
  1098: 'National Unity',
  1099: "Ra'am",
  1100: 'Labor',
  1101: 'United Torah Judaism',
  1102: 'Yesh Atid',
  1103: "Hadash-Ta'al",
  1104: 'Yisrael Beytenu',
  1105: 'Religious Zionism',
  1106: 'Otzma Yehudit',
  1107: "No'am",
  1108: 'National Right',
  1110: 'National Unity',
};

export const COALITION_FACTION_IDS = new Set([1095, 1096, 1101, 1105, 1106, 1107, 1108]);

// PersonID → English name (verified against real API PersonIDs)
export const PERSON_NAME_ENG: Record<number, string> = {
  // Likud
  965:   'Benjamin Netanyahu',
  468:   'Israel Katz',
  4395:  'Avi Dichter',
  12951: 'Yariv Levin',
  23558: 'David Bitan',
  30055: 'Yoav Gallant',
  30057: 'Yoav Kisch',
  30058: 'Miki Zohar',
  30300: 'Amir Ohana',
  30700: 'Nir Barkat',
  30701: 'Ofir Katz',
  30702: 'Hava Atiya',
  30704: 'Shlomo Karhi',
  30706: 'Keti Shitrit',
  30708: 'May Golan',
  30710: 'Ariel Kallner',
  30711: 'Amit Halevi',
  30772: 'Nissim Vaturi',
  30831: 'Eli Dalal',
  30832: 'Eliyahu Revivo',
  30835: 'Boaz Bismuth',
  30839: 'Dan Iluz',
  30842: 'Hanoch Malvitzky',
  30853: 'Moshe Saada',
  30860: 'Tally Gotliv',
  30861: 'Shalom Danino',
  30875: 'Tsega Melako',
  30876: 'Osher Shekalim',
  30877: 'Moshe Passel',
  30879: 'Shashi Goata',
  1025:  'Gila Gamliel',
  30786: 'Amichai Chikli',
  // Yesh Atid
  23594: 'Yair Lapid',
  23591: 'Elazar Stern',
  23597: 'Meir Cohen',
  23631: 'Karin Elharar',
  23632: 'Mickey Levy',
  23639: 'Boaz Toporovsky',
  30102: 'Merav Ben Ari',
  30686: 'Merav Cohen',
  30691: 'Ram Ben-Barak',
  30695: 'Yoav Segalovitz',
  30705: 'Michal Shir Segman',
  30720: 'Yurai Lahav Hertzanu',
  30776: 'Vladimir Beliak',
  30777: 'Moshe Tur-Paz',
  30780: 'Ron Katz',
  30782: 'Tatiana Mazarsky',
  30783: 'Yasmin Friedman',
  30820: 'Simone Davidson',
  30837: 'Dovi Biton',
  30851: 'Mati Tzarfati Haruvi',
  30854: 'Naor Shiri',
  30871: 'Shelly Tal Merom',
  // National Unity (Gantz)
  30657: 'Benny Gantz',
  30683: 'Hili Tropper',
  30685: 'Orit Farkash-Hacohen',
  30694: 'Alon Schuster',
  30682: 'Michael Biton',
  // Shas
  2291:  'Aryeh Deri',
  30749: 'Moshe Abutbul',
  30601: 'Yinon Azulai',
  30660: 'Moshe Arbel',
  30765: 'Uriel Busso',
  30770: 'Yosef Taib',
  30868: 'Yonatan Mishrakhi',
  // UTJ
  526:   'Moshe Gafni',
  23641: 'Yaakov Asher',
  30470: 'Michael Malkieli',
  // Religious Zionism + Otzma Yehudit + Noam
  30811: 'Itamar Ben Gvir',
  30812: 'Simcha Rotman',
  30814: 'Avi Maoz',
  30717: 'Ofir Sofer',
  23551: 'Orit Strock',
  23564: 'David Amsalem',
  30810: 'Michal Waldiger',
  30830: 'Ohad Tal',
  30852: 'Moshe Solomon',
  30859: 'Zvika Fogel',
  30847: 'Yitzhak Wasserlauf',
  30849: 'Limor Son Har-Melech',
  30867: 'Yitzhak Kroizer',
  // Yisrael Beytenu
  427:   'Avigdor Lieberman',
  4397:  "Ze'ev Elkin",
  12938: 'Hamad Amar',
  23560: 'Yulia Malinovsky',
  30121: 'Oded Forer',
  30722: 'Yevgeny Sova',
  30863: 'Sharon Nir',
  // Labor
  23565: 'Merav Michaeli',
  30106: 'Naama Lazimi',
  30807: 'Gilad Kariv',
  30808: 'Efrat Raiten Merom',
  // Hadash-Taal
  30066: 'Ayman Odeh',
  30067: 'Aida Touma-Sliman',
  30719: 'Ofer Cassif',
  560:   'Ahmad Tibi',
  // Raam
  30713: 'Mansour Abbas',
  30752: 'Walid Taha',
  30758: 'Iman Khatib-Yasin',
  30840: 'Walid El-Huzayel',
  30843: 'Yasser Hujirat',
  // National Right / other coalition
  30118: 'Sharren Haskel',
  30799: 'Michel Buskila',
  // Likud (missing from page 1)
  30809: 'Galit Distel Atbaryan',
  30880: 'Avichai Boaron',
  // Yesh Atid (missing)
  30881: 'Yaron Levi',
  // UTJ (missing)
  11835: 'Uri Maklev',
  563:   'Meir Porush',
  30671: 'Yaakov Tessler',
  30672: 'Yitzhak Pindrus',
  22151: 'Ikram Hasoun',
  30846: 'Yitzhak Goldknopf',
  30874: 'Tzvi Yedidya Sokhot',
  // Shas (missing)
  1056:  'Yaakov Margi',
  28513: 'Yoav Ben-Tzur',
  // Additional missing MKs
  30857: 'Amichai Eliyahu',
  30693: 'Etan Ginzburg',
  30775: 'Yael Ron Ben-Moshe',
  30804: 'Chaim Biton',
  30894: 'Samir Ben Said',
  30893: 'Afif Abd',
  30895: 'Adi Azuz',
  // Other
  532:   'Yuli Edelstein',
  556:   'Haim Katz',
  23635: 'Penina Tamano-Shata',
  30824: 'Yuval Chen',
};

// PersonID → role description (English) — sourced from real API PersonToPosition data
const ROLE_ENG_MAP: Record<number, string> = {
  965:   'Prime Minister',
  12951: 'Speaker of the Knesset',
  23594: 'Opposition Leader',
  30055: 'Minister of Defense',
  30057: 'Minister of Education',
  30058: 'Minister of Justice',
  30700: 'Minister of Economy',
  30704: 'Minister of Communications',
  30717: 'Minister of Aliyah',
  30718: 'Minister of Environmental Protection',
  30786: 'Minister of Diaspora Affairs',
  4395:  'Minister of Agriculture',
  556:   'Minister of Tourism',
  23564: 'Minister of Regional Cooperation',
  23551: 'Minister of Settlements',
  30811: 'Minister of National Security',
};

const ROLE_HE_MAP: Record<number, string> = {
  965:   'ראש הממשלה',
  12951: 'יו"ר הכנסת',
  23594: 'ראש האופוזיציה',
  30055: 'שר הביטחון',
  30057: 'שר החינוך',
  30058: 'שר המשפטים',
  30700: 'שר הכלכלה',
  30704: 'שר התקשורת',
  30717: 'שר העלייה',
  30718: 'שרת הגנת הסביבה',
  30786: 'שר התפוצות',
  4395:  'שר החקלאות',
  556:   'שר התיירות',
  23564: 'שר שיתוף פעולה אזורי',
  23551: 'שרת ההתיישבות',
  30811: 'שר הביטחון הלאומי',
};

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function odata<T>(path: string, timeoutMs = 20000): Promise<T[]> {
  const url = `${BASE}/${path}${path.includes('?') ? '&' : '?'}$format=json`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Knesset API ${res.status}: ${path}`);
  const data = await res.json();
  return (data?.value ?? []) as T[];
}

// ─── Main data fetch ──────────────────────────────────────────────────────────

export async function fetchRealMembers(): Promise<RealMember[]> {
  // Sequential requests — Knesset API rate-limits parallel calls (each takes ~0.5s)
  // Total: ~4 calls × 0.5s = ~2s, well within Next.js 30s server timeout

  // Step 1: Get all 120 current MK PersonIDs — API hard-caps at 100 per page, need 2 pages
  const mkPos1 = await odata<{ PersonID: number }>(
    `KNS_PersonToPosition?$filter=KnessetNum eq ${CURRENT_KNESSET} and IsCurrent eq true and (PositionID eq 43 or PositionID eq 61)&$select=PersonID&$top=100`
  );
  const mkPos2 = await odata<{ PersonID: number }>(
    `KNS_PersonToPosition?$filter=KnessetNum eq ${CURRENT_KNESSET} and IsCurrent eq true and (PositionID eq 43 or PositionID eq 61)&$select=PersonID&$top=100&$skip=100`
  );
  const mkPersonIDs = new Set([...mkPos1, ...mkPos2].map(p => p.PersonID));

  // Step 2: Fetch person names — first page (max 100)
  const persons1 = await odata<{ PersonID: number; FirstName: string; LastName: string; GenderID: number; Email: string | null }>(
    `KNS_Person?$filter=IsCurrent eq true&$select=PersonID,FirstName,LastName,GenderID,Email&$top=100`
  );
  // Step 2b: Fetch second page
  const persons2 = await odata<{ PersonID: number; FirstName: string; LastName: string; GenderID: number; Email: string | null }>(
    `KNS_Person?$filter=IsCurrent eq true&$select=PersonID,FirstName,LastName,GenderID,Email&$top=100&$skip=100`
  );
  const allPersons = [...persons1, ...persons2];
  const personMap = new Map(allPersons.map(p => [p.PersonID, p]));

  // Step 3: Fetch faction membership (PositionID 54) — also needs 2 pages (120 records total)
  const factionPos1 = await odata<{ PersonID: number; FactionID: number | null; FactionName: string | null }>(
    `KNS_PersonToPosition?$filter=KnessetNum eq ${CURRENT_KNESSET} and IsCurrent eq true and PositionID eq 54&$select=PersonID,FactionID,FactionName&$top=100`
  );
  const factionPos2 = await odata<{ PersonID: number; FactionID: number | null; FactionName: string | null }>(
    `KNS_PersonToPosition?$filter=KnessetNum eq ${CURRENT_KNESSET} and IsCurrent eq true and PositionID eq 54&$select=PersonID,FactionID,FactionName&$top=100&$skip=100`
  );
  const factionMap = new Map<number, { FactionID: number | null; FactionName: string }>();
  for (const fp of [...factionPos1, ...factionPos2]) {
    if (!factionMap.has(fp.PersonID)) {
      factionMap.set(fp.PersonID, { FactionID: fp.FactionID, FactionName: fp.FactionName ?? '' });
    }
  }

  // Step 4: Fetch minister/PM roles
  const rolePositions = await odata<{ PersonID: number; PositionID: number; GovMinistryName: string | null }>(
    `KNS_PersonToPosition?$filter=KnessetNum eq ${CURRENT_KNESSET} and IsCurrent eq true and (PositionID eq 39 or PositionID eq 45 or PositionID eq 57 or PositionID eq 31 or PositionID eq 50 or PositionID eq 122 or PositionID eq 123 or PositionID eq 131 or PositionID eq 130)&$select=PersonID,PositionID,GovMinistryName&$top=100`
  );
  const roleMap = new Map<number, { GovMinistryName: string | null; PositionID: number }>();
  for (const rp of rolePositions) {
    if (!roleMap.has(rp.PersonID)) {
      roleMap.set(rp.PersonID, { GovMinistryName: rp.GovMinistryName, PositionID: rp.PositionID });
    }
  }

  // Step 5: Assemble members
  const members: RealMember[] = [];
  for (const pid of mkPersonIDs) {
    const person = personMap.get(pid);
    if (!person) continue;

    const faction = factionMap.get(pid);
    const role = roleMap.get(pid);

    const fullName = `${person.FirstName} ${person.LastName}`;
    const factionID = faction?.FactionID ?? null;

    // Determine role description
    let roleHe = 'חבר הכנסת';
    let roleEng = 'Member of Knesset';
    if (person.GenderID === 250) { roleHe = 'חברת כנסת'; roleEng = 'Member of Knesset'; }
    if (ROLE_HE_MAP[pid]) { roleHe = ROLE_HE_MAP[pid]; roleEng = ROLE_ENG_MAP[pid] ?? roleHe; }
    else if (role) {
      const positionLabels: Record<number, [string, string]> = {
        45: ['ראש הממשלה', 'Prime Minister'],
        39: ['שר', 'Minister'],
        57: ['שרה', 'Minister'],
        31: ['משנה לראש הממשלה', 'Deputy Prime Minister'],
        50: ['סגן ראש הממשלה', 'Vice Prime Minister'],
        122: ['יו"ר הכנסת', 'Speaker of the Knesset'],
        123: ['יו"ר הכנסת', 'Speaker of the Knesset'],
        131: ['ראש האופוזיציה', 'Opposition Leader'],
        130: ['ראש האופוזיציה', 'Opposition Leader'],
      };
      if (positionLabels[role.PositionID]) {
        [roleHe, roleEng] = positionLabels[role.PositionID];
        if (role.GovMinistryName) {
          roleHe = `שר/ת ${role.GovMinistryName.replace('משרד ', '')}`;
          roleEng = `Minister of ${role.GovMinistryName.replace('משרד ', '').replace('ה', '')}`;
        }
      }
    }

    members.push({
      PersonID: pid,
      FirstName: person.FirstName,
      LastName: person.LastName,
      FullName: fullName,
      FullNameEng: PERSON_NAME_ENG[pid] ?? transliterateHebrew(fullName),
      GenderID: person.GenderID,
      Email: person.Email,
      FactionID: factionID,
      FactionName: faction?.FactionName ?? '',
      FactionNameEng: factionID ? (FACTION_ENG[factionID] ?? faction?.FactionName ?? '') : '',
      RoleHe: roleHe,
      RoleEng: roleEng,
      GovMinistryName: role?.GovMinistryName ?? null,
      BillsProposed: 0,   // loaded on demand per member
      BillsPassed: 0,
      AttendancePct: null,
    });
  }

  return members.sort((a, b) => a.FullName.localeCompare(b.FullName, 'he'));
}

export async function fetchMemberBillCounts(personID: number): Promise<{ proposed: number; passed: number }> {
  try {
    // Get all bills initiated by this person
    const initiatorRecords = await odata<{ BillID: number; IsInitiator: boolean }>(
      `KNS_BillInitiator?$filter=PersonID eq ${personID}&$select=BillID,IsInitiator&$top=500`
    );
    const billIDs = initiatorRecords.map(r => r.BillID);
    if (billIDs.length === 0) return { proposed: 0, passed: 0 };

    // Count how many of those bills are from Knesset 25 and passed
    // Check the first few bills' Knesset numbers to estimate
    const proposed = initiatorRecords.filter(r => r.IsInitiator).length + initiatorRecords.filter(r => !r.IsInitiator).length;

    // For passed: we'd need to cross-reference with KNS_Bill, simplified here
    return { proposed, passed: 0 };
  } catch {
    return { proposed: 0, passed: 0 };
  }
}

export async function fetchRealParties(): Promise<RealParty[]> {
  const factions = await odata<{ FactionID: number; Name: string; KnessetNum: number; IsCurrent: boolean }>(
    `KNS_Faction?$filter=KnessetNum eq ${CURRENT_KNESSET}&$top=50`
  );

  // API caps at 100/page — fetch both pages to get all 120 members
  const [fp1, fp2] = await Promise.all([
    odata<{ PersonID: number; FactionID: number | null }>(
      `KNS_PersonToPosition?$filter=KnessetNum eq ${CURRENT_KNESSET} and IsCurrent eq true and PositionID eq 54&$select=PersonID,FactionID&$top=100`
    ),
    odata<{ PersonID: number; FactionID: number | null }>(
      `KNS_PersonToPosition?$filter=KnessetNum eq ${CURRENT_KNESSET} and IsCurrent eq true and PositionID eq 54&$select=PersonID,FactionID&$top=100&$skip=100`
    ),
  ]);
  const factionPositions = [...fp1, ...fp2];

  const membersByFaction = new Map<number, number[]>();
  for (const fp of factionPositions) {
    if (!fp.FactionID) continue;
    const arr = membersByFaction.get(fp.FactionID) ?? [];
    arr.push(fp.PersonID);
    membersByFaction.set(fp.FactionID, arr);
  }

  return factions
    .filter(f => f.IsCurrent)
    .map(f => ({
      FactionID: f.FactionID,
      Name: f.Name.trim(),
      NameEng: FACTION_ENG[f.FactionID] ?? f.Name.trim(),
      Seats: membersByFaction.get(f.FactionID)?.length ?? 0,
      IsCoalition: COALITION_FACTION_IDS.has(f.FactionID),
      Members: membersByFaction.get(f.FactionID) ?? [],
    }))
    .filter(f => f.Seats > 0)
    .sort((a, b) => b.Seats - a.Seats);
}

export async function fetchRealBills(limit = 100): Promise<RealBill[]> {
  const bills = await odata<{
    BillID: number; Name: string; KnessetNum: number; StatusID: number;
    SubTypeID: number; SubTypeDesc: string; PublicationDate: string | null;
  }>(
    `KNS_Bill?$filter=KnessetNum eq ${CURRENT_KNESSET}&$orderby=PublicationDate desc&$top=${limit}&$select=BillID,Name,KnessetNum,StatusID,SubTypeID,SubTypeDesc,PublicationDate`
  );

  return bills.map(b => ({
    BillID: b.BillID,
    Name: b.Name,
    KnessetNum: b.KnessetNum,
    StatusID: b.StatusID,
    StatusDesc: b.StatusID === 118 ? 'עבר' : b.StatusID === 177 ? 'נעצרה' : 'בדיון',
    SubTypeDesc: b.SubTypeDesc,
    IsGovernment: b.SubTypeID === 53,
    PublicationDate: b.PublicationDate,
  }));
}

export async function fetchMemberBills(personID: number): Promise<RealBill[]> {
  // Step 1: Get all BillIDs this person has initiated (all Knessets, up to 200)
  const initiated = await odata<{ BillID: number }>(
    `KNS_BillInitiator?$filter=PersonID eq ${personID}&$select=BillID&$top=200`
  );
  if (initiated.length === 0) return [];

  // Step 2: Batch-fetch bills in groups of 30 to avoid URL length limits
  const allBillIDs = initiated.map(r => r.BillID);
  const results: RealBill[] = [];

  for (let i = 0; i < allBillIDs.length; i += 30) {
    const chunk = allBillIDs.slice(i, i + 30);
    const idFilter = chunk.map(id => `BillID eq ${id}`).join(' or ');
    try {
      const bills = await odata<{
        BillID: number; Name: string; KnessetNum: number; StatusID: number;
        SubTypeID: number; SubTypeDesc: string; PublicationDate: string | null;
      }>(
        `KNS_Bill?$filter=(${idFilter}) and KnessetNum eq ${CURRENT_KNESSET}&$select=BillID,Name,KnessetNum,StatusID,SubTypeID,SubTypeDesc,PublicationDate&$top=30`
      );
      for (const b of bills) {
        results.push({
          BillID: b.BillID,
          Name: b.Name,
          KnessetNum: b.KnessetNum,
          StatusID: b.StatusID,
          StatusDesc: b.StatusID === 118 ? 'עבר' : b.StatusID === 177 ? 'נעצרה' : 'בדיון',
          SubTypeDesc: b.SubTypeDesc,
          IsGovernment: b.SubTypeID === 53,
          PublicationDate: b.PublicationDate,
        });
      }
    } catch { /* skip failed chunk */ }
    // Stop once we have enough bills to display
    if (results.length >= 20) break;
  }

  return results.sort((a, b) =>
    (b.PublicationDate ?? '').localeCompare(a.PublicationDate ?? '')
  );
}

export async function countMemberBillsK25(personID: number): Promise<{ proposed: number; passed: number }> {
  // Count bills in current Knesset for this person
  const initiated = await odata<{ BillID: number }>(
    `KNS_BillInitiator?$filter=PersonID eq ${personID}&$select=BillID&$top=500`
  );
  if (initiated.length === 0) return { proposed: 0, passed: 0 };

  const allBillIDs = initiated.map(r => r.BillID);
  let proposed = 0;
  let passed = 0;

  for (let i = 0; i < allBillIDs.length; i += 30) {
    const chunk = allBillIDs.slice(i, i + 30);
    const idFilter = chunk.map(id => `BillID eq ${id}`).join(' or ');
    try {
      const bills = await odata<{ BillID: number; StatusID: number }>(
        `KNS_Bill?$filter=(${idFilter}) and KnessetNum eq ${CURRENT_KNESSET}&$select=BillID,StatusID&$top=30`
      );
      proposed += bills.length;
      passed += bills.filter(b => b.StatusID === 118).length;
    } catch { /* skip */ }
  }
  return { proposed, passed };
}

export async function fetchPlenumStats(): Promise<{ total: number; passed: number; sessions: number }> {
  const [totalRes, passedRes, sessionsRes] = await Promise.all([
    fetch(`${BASE}/KNS_Bill?$filter=KnessetNum eq ${CURRENT_KNESSET}&$format=json&$inlinecount=allpages&$top=1`, { next: { revalidate: 3600 } }),
    fetch(`${BASE}/KNS_Bill?$filter=KnessetNum eq ${CURRENT_KNESSET} and StatusID eq 118&$format=json&$inlinecount=allpages&$top=1`, { next: { revalidate: 3600 } }),
    fetch(`${BASE}/KNS_PlenumSession?$filter=KnessetNum eq ${CURRENT_KNESSET}&$format=json&$inlinecount=allpages&$top=1`, { next: { revalidate: 3600 } }),
  ]);
  const [td, pd, sd] = await Promise.all([totalRes.json(), passedRes.json(), sessionsRes.json()]);
  return {
    total: Number(td?.['odata.count'] ?? 0),
    passed: Number(pd?.['odata.count'] ?? 0),
    sessions: Number(sd?.['odata.count'] ?? 0),
  };
}

// ─── Simple Hebrew → Latin transliteration (fallback for unknown names) ───────

function transliterateHebrew(text: string): string {
  // Basic academic transliteration for readability (not phonetically perfect)
  const map: Record<string, string> = {
    'א': 'A', 'ב': 'B', 'ג': 'G', 'ד': 'D', 'ה': 'H', 'ו': 'V',
    'ז': 'Z', 'ח': 'Ch', 'ט': 'T', 'י': 'Y', 'כ': 'K', 'ך': 'K',
    'ל': 'L', 'מ': 'M', 'ם': 'M', 'נ': 'N', 'ן': 'N', 'ס': 'S',
    'ע': 'A', 'פ': 'P', 'ף': 'P', 'צ': 'Tz', 'ץ': 'Tz', 'ק': 'K',
    'ר': 'R', 'ש': 'Sh', 'ת': 'T',
    '"': "'", "'": '', '-': '-', ' ': ' ', '\u05B0': '', '\u05B1': '',
  };
  return text
    .split('')
    .map((c, i) => {
      const t = map[c];
      if (t === undefined) return c;
      // Lowercase after first char of each word
      return (i === 0 || text[i - 1] === ' ') ? t : t.toLowerCase();
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Mock data (used only if real API is completely unreachable) ──────────────

export function getMockMembers(): RealMember[] {
  return [
    { PersonID: 965, FirstName: 'בנימין', LastName: 'נתניהו', FullName: 'בנימין נתניהו', FullNameEng: 'Benjamin Netanyahu', GenderID: 251, Email: null, FactionID: 1096, FactionName: 'הליכוד', FactionNameEng: 'Likud', RoleHe: 'ראש הממשלה', RoleEng: 'Prime Minister', GovMinistryName: null, BillsProposed: 0, BillsPassed: 0, AttendancePct: null },
    { PersonID: 427, FirstName: 'אביגדור', LastName: 'ליברמן', FullName: 'אביגדור ליברמן', FullNameEng: 'Avigdor Lieberman', GenderID: 251, Email: 'aliberman@knesset.gov.il', FactionID: 1104, FactionName: 'ישראל ביתנו', FactionNameEng: 'Yisrael Beytenu', RoleHe: 'חבר הכנסת', RoleEng: 'Member of Knesset', GovMinistryName: null, BillsProposed: 0, BillsPassed: 0, AttendancePct: null },
  ];
}

export function getMockVotes(): MKVote[] {
  return [
    { VoteID: 1, VoteDate: '2024-12-01', Title: 'תקציב המדינה 2025', Decision: 'for' },
    { VoteID: 2, VoteDate: '2024-11-15', Title: 'הסכם עם ארה"ב', Decision: 'for' },
    { VoteID: 3, VoteDate: '2024-10-20', Title: 'תיקון חוק הגיוס', Decision: 'against' },
    { VoteID: 4, VoteDate: '2024-09-05', Title: 'רפורמת שוק הדיור', Decision: 'for' },
    { VoteID: 5, VoteDate: '2024-08-10', Title: 'חוק הבריאות הציבורית', Decision: 'abstain' },
  ];
}

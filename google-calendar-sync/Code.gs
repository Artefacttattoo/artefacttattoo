/**
 * ============================================================
 *  ARTEFACT BOOKING ↔ GOOGLE CALENDAR SYNC
 *  Google Apps Script – prüft jede Stunde
 * ============================================================
 *
 *  WAS PASSIERT:
 *  1. Script liest eure 2 Google Kalender (Achern + Weil am Rhein)
 *  2. Sucht in Event-Titeln nach Künstlernamen
 *  3. Wenn ein Künstler > halber Tag gebucht ist → ROT (unavailable)
 *  4. Wenn Künstler frei oder < halber Tag → GRÜN bleibt (confirmed)
 *  5. Läuft automatisch jede Stunde
 *
 *  SETUP:
 *  1. Öffne https://script.google.com → Neues Projekt
 *  2. Kopiere diesen Code in Code.gs
 *  3. WICHTIG: Trage unten bei KALENDER_ID_ACHERN und KALENDER_ID_WEIL
 *     die IDs eurer Google Kalender ein!
 *     (Google Calendar → Kalender-Einstellungen → Kalender-ID)
 *  4. Führe einmal setupSync() aus (Dropdown → setupSync → ▶ Play)
 *  5. Genehmige die Berechtigungen → Fertig!
 * ============================================================
 */

// ===================== KONFIGURATION =====================

const CONFIG = {
  // Firebase
  FIREBASE_PROJECT: 'artist-booking-manager',
  FIREBASE_API_KEY: 'AIzaSyC0BNqBsDkepHc8ktlUZyW_mKIXbXX5nuM',

  // Jahr (Booking-System nutzt kein Jahr-Feld, alles 2026)
  YEAR: 2026,

  // ┌─────────────────────────────────────────────────────────┐
  // │  HIER EURE GOOGLE KALENDER-IDs EINTRAGEN!               │
  // │                                                         │
  // │  So findest du die ID:                                  │
  // │  Google Calendar → ⚙ Einstellungen → Kalender klicken  │
  // │  → "Kalender-ID" kopieren                               │
  // │  (sieht aus wie: abc123@group.calendar.google.com)      │
  // └─────────────────────────────────────────────────────────┘
  KALENDER_ID_ACHERN: 'c_eaa35b05288afc723c2b641c03e3d04ba321fadc291fb4ee99ba324841d36773@group.calendar.google.com',
  KALENDER_ID_WEIL: 'c_239fd2d160869a5c64904797f779e9eb9d2f236fc2a221c1b5dc0a55609bf2a5@group.calendar.google.com',

  // Arbeitstag-Definition
  WORK_DAY_START: 10,  // 10:00 Uhr
  WORK_DAY_END: 19,    // 19:00 Uhr
  // → Arbeitstag = 9 Stunden, halber Tag = 4.5 Stunden

  // Sync-Zeitraum
  SYNC_DAYS_AHEAD: 90,   // ~3 Monate voraus
  SYNC_DAYS_BACK: 60,    // ~2 Monate zurück
};

// Halber Arbeitstag in Stunden (automatisch berechnet)
const WORK_DAY_HOURS = CONFIG.WORK_DAY_END - CONFIG.WORK_DAY_START;
const HALF_DAY_HOURS = WORK_DAY_HOURS / 2;
const MONTHS_DE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

// ===================== SPITZNAMEN / ALIASES =====================
// Spitzname → Teil des echten Namens (lowercase, ohne Akzente)
const ARTIST_NICKNAMES = {
  // Rafael Esteves
  'raffi': 'rafael',
  'raffa': 'rafael',
  'raf': 'rafael',
  // Nixier
  'nico': 'nixier',
  'nix': 'nixier',
  // Kevin Holzmann
  'kev': 'kevin',
  'holzi': 'holzmann',
  // Sérgio Ávilla
  'serge': 'sergio',
  'serg': 'sergio',
  // Felipe Garre
  'phil': 'felipe',
  'feli': 'felipe',
  // Dilan Peña
  'dil': 'dilan',
  // Pavel
  'pav': 'pavel',
  // Valeria
  'val': 'valeria',
};

// ===================== FIRESTORE API =====================

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${CONFIG.FIREBASE_PROJECT}/databases/(default)/documents`;

function firestoreGet(collection) {
  const docs = [];
  let pageToken = null;
  do {
    let url = `${FIRESTORE_BASE}/${collection}?key=${CONFIG.FIREBASE_API_KEY}&pageSize=300`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const json = JSON.parse(resp.getContentText());
    if (json.documents) {
      json.documents.forEach(doc => {
        const id = doc.name.split('/').pop();
        docs.push({ id, ...parseFirestoreFields(doc.fields || {}) });
      });
    }
    pageToken = json.nextPageToken;
  } while (pageToken);
  return docs;
}

function firestoreCreate(collection, data) {
  const url = `${FIRESTORE_BASE}/${collection}?key=${CONFIG.FIREBASE_API_KEY}`;
  const body = { fields: toFirestoreFields(data) };
  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  const json = JSON.parse(resp.getContentText());
  if (json.error) throw new Error(`Firestore create: ${json.error.message}`);
  return json.name.split('/').pop();
}

function firestoreUpdate(collection, docId, data) {
  const fields = toFirestoreFields(data);
  const updateMask = Object.keys(data).map(k => `updateMask.fieldPaths=${k}`).join('&');
  const url = `${FIRESTORE_BASE}/${collection}/${docId}?key=${CONFIG.FIREBASE_API_KEY}&${updateMask}`;
  const body = { fields };
  UrlFetchApp.fetch(url, {
    method: 'patch',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
}

function firestoreDelete(collection, docId) {
  const url = `${FIRESTORE_BASE}/${collection}/${docId}?key=${CONFIG.FIREBASE_API_KEY}`;
  UrlFetchApp.fetch(url, { method: 'delete', muteHttpExceptions: true });
}

function firestoreSet(collection, docId, data) {
  const url = `${FIRESTORE_BASE}/${collection}/${docId}?key=${CONFIG.FIREBASE_API_KEY}`;
  const body = { fields: toFirestoreFields(data) };
  UrlFetchApp.fetch(url, {
    method: 'patch',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
}

function parseFirestoreFields(fields) {
  const obj = {};
  for (const [key, val] of Object.entries(fields)) {
    if (val.stringValue !== undefined) obj[key] = val.stringValue;
    else if (val.integerValue !== undefined) obj[key] = parseInt(val.integerValue);
    else if (val.doubleValue !== undefined) obj[key] = val.doubleValue;
    else if (val.booleanValue !== undefined) obj[key] = val.booleanValue;
    else if (val.nullValue !== undefined) obj[key] = null;
    else if (val.timestampValue !== undefined) obj[key] = val.timestampValue;
    else if (val.arrayValue) obj[key] = (val.arrayValue.values || []).map(v => parseFirestoreFields({ _: v })._);
    else if (val.mapValue) obj[key] = parseFirestoreFields(val.mapValue.fields || {});
    else obj[key] = null;
  }
  return obj;
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') fields[key] = { stringValue: val };
    else if (typeof val === 'number' && Number.isInteger(val)) fields[key] = { integerValue: String(val) };
    else if (typeof val === 'number') fields[key] = { doubleValue: val };
    else if (typeof val === 'boolean') fields[key] = { booleanValue: val };
    else if (val === null || val === undefined) fields[key] = { nullValue: null };
    else fields[key] = { stringValue: String(val) };
  }
  return fields;
}

// ===================== NAMENS-ERKENNUNG =====================

/**
 * Prüft ob ein Künstlername im Event-Titel vorkommt.
 * Erkennt:
 *   - Exakten Namen: "Max Mustermann"
 *   - Vorname: "Max"
 *   - Nachname: "Mustermann"
 *   - Groß/Kleinschreibung egal
 *   - Auch in längeren Titeln: "Termin mit Max 14:00"
 */
function removeAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function findArtistInTitle(title, artists) {
  if (!title) return [];
  const titleLower = removeAccents(title.toLowerCase().trim());
  const matches = [];

  for (const artist of artists) {
    const name = (artist.name || '').trim();
    if (!name) continue;

    const nameLower = removeAccents(name.toLowerCase());
    const parts = nameLower.split(/\s+/);

    // 1. Vollständiger Name im Titel?
    if (titleLower.includes(nameLower)) {
      matches.push({ artist, matchType: 'full', score: 3 });
      continue;
    }

    // 2. Vor- UND Nachname separat im Titel? (z.B. "Mustermann, Max")
    if (parts.length >= 2) {
      const allPartsFound = parts.every(p => {
        // Nur Teile mit 3+ Zeichen matchen (vermeidet Fehlmatches bei "Li", "Al" etc.)
        if (p.length < 3) return false;
        // Wort-Grenze prüfen: Teil muss als eigenes Wort vorkommen
        const regex = new RegExp('\\b' + escapeRegex(p) + '\\b');
        return regex.test(titleLower);
      });
      if (allPartsFound && parts.filter(p => p.length >= 3).length >= 2) {
        matches.push({ artist, matchType: 'parts', score: 2 });
        continue;
      }
    }

    // 3. Einzelner Name (Vorname oder Nachname, min. 3 Zeichen)
    //    Nur als ganzes Wort, nicht als Teil eines anderen Wortes
    //    Ermöglicht Kurzformen wie "Val", "Raf" etc.
    let singleFound = false;
    for (const part of parts) {
      if (part.length >= 3) {
        const regex = new RegExp('\\b' + escapeRegex(part) + '\\b');
        if (regex.test(titleLower)) {
          matches.push({ artist, matchType: 'single', score: 1 });
          singleFound = true;
          break;
        }
      }
    }

    // 4. Spitznamen / Aliases prüfen (z.B. "Raffi" → Rafael)
    if (!singleFound) {
      const titleWords = titleLower.split(/\s+/);
      for (const word of titleWords) {
        const mappedName = ARTIST_NICKNAMES[word];
        if (mappedName && nameLower.includes(mappedName)) {
          matches.push({ artist, matchType: 'nickname', score: 2 });
          break;
        }
      }
    }
  }

  // Sortiere nach Score (beste Matches zuerst) und dedupliziere
  matches.sort((a, b) => b.score - a.score);
  const seen = new Set();
  return matches.filter(m => {
    if (seen.has(m.artist.id)) return false;
    seen.add(m.artist.id);
    return true;
  });
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ===================== UMSATZ-PARSING =====================

/**
 * Entfernt HTML-Tags und dekodiert HTML-Entities aus Calendar-Beschreibungen.
 */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|li|ul|ol|h\d)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Liest Umsatz-Daten aus der Event-Beschreibung.
 *
 * Erkannte Formate (aus echten Kalender-Einträgen):
 *
 * GESAMTPREIS:
 *   "Lt Artist 900"           → 900€
 *   "Lt Artist 900 fix"       → 900€
 *   "900 lt Artist"           → 900€
 *   "900€ laut Artist"        → 900€
 *   "Lt Artist 3.6 fix"       → 3600€  (Dezimal = Tausender)
 *   "Lt artist 2.5 fix"       → 2500€
 *   "Fix 1.7 lt Artist"       → 1700€
 *   "2,9 fix"                 → 2900€  (Komma = Tausender)
 *   "3 Tage angesetzt 2,9 fix"→ 2900€
 *   "800 fix"                 → 800€
 *   "900€ am Tag fix"         → 900€
 *   "950€ fix"                → 950€
 *   "850€ abgemacht"          → 850€
 *   "9-10 k fix"              → 9000€  (k = ×1000)
 *   "900 each"                → 900€
 *   "Pro Person 250-300€ lt Artist" → 250€
 *   "Stammkunde 800 fix"      → 800€
 *
 * ANZAHLUNG:
 *   "100€ az"                 → 100€ deposit
 *   "200€ az"                 → 200€
 *   "Az 300"                  → 300€
 *   "100 Anzahlung"           → 100€
 *   "400€ anzahlung"          → 400€
 */
function parseRevenue(description) {
  if (!description) return { total: 0, deposit: 0 };

  // HTML-Tags entfernen (Calendar-Beschreibungen können HTML enthalten)
  const cleaned = stripHtml(description);
  const text = cleaned.toLowerCase();

  let total = 0, deposit = 0;

  // === GESAMTPREIS ===

  // 1. Dezimal-Tausender: "3.6 fix" = 3600€, "2.5 fix" = 2500€, "1.7 lt artist" = 1700€
  //    Auch: "Lt Artist 3.6 fix", "Fix 1.7 lt Artist"
  const decDotMatch = text.match(/(\d+)\.(\d)\s*(?:fix|lt\s*artist|laut\s*artist)/);
  if (decDotMatch) {
    total = parseInt(decDotMatch[1]) * 1000 + parseInt(decDotMatch[2]) * 100;
  }

  // 2. Komma-Tausender: "2,9 fix" = 2900€
  if (!total) {
    const decCommaMatch = text.match(/(\d+),(\d)\s*(?:fix|lt\s*artist|laut\s*artist)/);
    if (decCommaMatch) {
      total = parseInt(decCommaMatch[1]) * 1000 + parseInt(decCommaMatch[2]) * 100;
    }
  }

  // 3. "k fix" / "k lt": "9-10 k fix" → 9000€, "9k fix" → 9000
  if (!total) {
    const kMatch = text.match(/(\d+)[\s-]*\d*\s*k\s*(?:fix|lt|laut)/);
    if (kMatch) total = parseInt(kMatch[1]) * 1000;
  }

  // 4. "Lt Artist NUMBER" oder "Laut Artist NUMBER" (Zahl NACH lt artist)
  //    z.B. "Lt Artist 900", "Lt Artist 1200", "Lt Artist 900 fix"
  if (!total) {
    const ltBeforeMatch = text.match(/(?:lt|laut)\s*artist\s*(\d+)/);
    if (ltBeforeMatch) total = parseInt(ltBeforeMatch[1]);
  }

  // 5. "NUMBER lt Artist" oder "NUMBER€ lt Artist" (Zahl VOR lt artist - original pattern)
  //    z.B. "900 lt Artist", "250-300€ lt Artist"
  if (!total) {
    const ltAfterMatch = text.match(/(\d+)[\s-]*\d*\s*€?\s*(?:lt|laut)\s*artist/);
    if (ltAfterMatch) total = parseInt(ltAfterMatch[1]);
  }

  // 6. "NUMBER fix" / "NUMBER€ fix" / "NUMBER€ am Tag fix"
  //    z.B. "800 fix", "950€ fix", "900€ am Tag fix", "Stammkunde 800 fix"
  if (!total) {
    const fixMatch = text.match(/(\d{3,})\s*€?\s*(?:am\s+tag\s+)?fix/);
    if (fixMatch) total = parseInt(fixMatch[1]);
  }

  // 7. "fix NUMBER" (fix VOR der Zahl): "Fix 1.7 lt Artist" schon oben, aber "fix 900"
  if (!total) {
    const fixBeforeMatch = text.match(/fix\s*(\d{3,})/);
    if (fixBeforeMatch) total = parseInt(fixBeforeMatch[1]);
  }

  // 8. "NUMBER€ abgemacht" (vereinbarter Preis)
  if (!total) {
    const abgemachtMatch = text.match(/(\d{3,})\s*€?\s*abgemacht/);
    if (abgemachtMatch) total = parseInt(abgemachtMatch[1]);
  }

  // 9. "NUMBER each" / "NUMBER pro session/tattoo"
  if (!total) {
    const eachMatch = text.match(/(\d{3,})\s*€?\s*(?:each|pro\s+(?:session|tattoo|person|tag))/);
    if (eachMatch) total = parseInt(eachMatch[1]);
  }

  // 10. Fallback: Zahl mit € → als Gesamtpreis
  //     z.B. "900€" oder "1200 €"
  //     NICHT wenn "az" oder "anzahlung" im Text → dann ist die Zahl eine Anzahlung
  if (!total) {
    const hasDepositKeyword = /\b(?:anzahlung|az)\b/.test(text);
    if (!hasDepositKeyword) {
      const euroMatch = text.match(/(\d{3,})\s*€/);
      if (euroMatch) total = parseInt(euroMatch[1]);
    }
  }

  // 11. Letzter Fallback: Wenn 2+ Zahlen (≥100) in der Beschreibung,
  //     höchste = Gesamtpreis, niedrigste = Anzahlung
  //     Nur wenn mindestens ein Preishinweis-Wort vorkommt
  if (!total) {
    const hasHint = /preis|kosten|betrag|gesamt|restzahlung|bezahlung|euro|budget/i.test(text);
    if (hasHint) {
      const allNums = [...text.matchAll(/\b(\d{3,})\b/g)].map(m => parseInt(m[1])).filter(n => n >= 100 && n <= 50000);
      if (allNums.length >= 2) {
        allNums.sort((a, b) => b - a);
        total = allNums[0];
        deposit = allNums[allNums.length - 1];
      } else if (allNums.length === 1) {
        total = allNums[0];
      }
    }
  }

  // === ANZAHLUNG ===

  // ZUERST: "Az 300", "Anzahlung 200" (Keyword VOR der Zahl)
  // Das ist zuverlässiger als "NUMBER az" (vermeidet Fehlmatch mit vorheriger Zahl)
  const azBeforeMatch = text.match(/\b(?:anzahlung|az)\s*:?\s*(\d+)/);
  if (azBeforeMatch) deposit = parseInt(azBeforeMatch[1]);

  // DANN: "100€ az", "200 az", "100 Anzahlung" (Zahl direkt VOR Keyword)
  if (!deposit) {
    const azAfterMatch = text.match(/(\d+)\s*€?\s*(?:anzahlung|az)\b/);
    if (azAfterMatch) deposit = parseInt(azAfterMatch[1]);
  }

  return { total, deposit };
}

// ===================== STUNDEN-BERECHNUNG =====================

/**
 * Berechnet wie viele Stunden eines Arbeitstages ein Event belegt.
 * Berücksichtigt:
 *   - Ganztags-Events → voller Arbeitstag
 *   - Teil-Events → nur die Stunden innerhalb des Arbeitstages
 *   - Events die über den Arbeitstag hinausgehen → gecapped
 */
function getBookedHoursForDay(events, targetDate) {
  const dayStart = new Date(targetDate);
  dayStart.setHours(CONFIG.WORK_DAY_START, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(CONFIG.WORK_DAY_END, 0, 0, 0);

  let totalMinutes = 0;

  for (const event of events) {
    // Ganztags-Event → voller Arbeitstag
    if (event.isAllDay) {
      totalMinutes += WORK_DAY_HOURS * 60;
      continue;
    }

    // Berechne Überschneidung mit Arbeitstag
    const evStart = event.startTime;
    const evEnd = event.endTime;

    const overlapStart = new Date(Math.max(evStart.getTime(), dayStart.getTime()));
    const overlapEnd = new Date(Math.min(evEnd.getTime(), dayEnd.getTime()));

    if (overlapStart < overlapEnd) {
      totalMinutes += (overlapEnd - overlapStart) / (1000 * 60);
    }
  }

  // Cap bei maximal einem vollen Arbeitstag
  return Math.min(totalMinutes / 60, WORK_DAY_HOURS);
}

// ===================== HAUPT-SYNC LOGIK =====================

function syncCalendarToApp() {
  Logger.log('=== CALENDAR → APP SYNC START ===');
  Logger.log(`Arbeitstag: ${CONFIG.WORK_DAY_START}:00 - ${CONFIG.WORK_DAY_END}:00 (${WORK_DAY_HOURS}h)`);
  Logger.log(`Halber Tag: ${HALF_DAY_HOURS}h → darüber = ROT (unavailable)`);

  // 1. Lade Artists aus Firestore
  const artists = firestoreGet('artists');
  const activeArtists = artists.filter(a => a.status === 'active' || a.status === 'visa');
  Logger.log(`${activeArtists.length} aktive Künstler geladen`);

  if (activeArtists.length === 0) {
    Logger.log('Keine aktiven Künstler gefunden. Abbruch.');
    return;
  }

  // 2. Lade bestehende Bookings
  const allBookings = firestoreGet('bookings');

  // 3. Lade Google Kalender
  const calAchern = CalendarApp.getCalendarById(CONFIG.KALENDER_ID_ACHERN);
  const calWeil = CalendarApp.getCalendarById(CONFIG.KALENDER_ID_WEIL);

  if (!calAchern) {
    Logger.log('❌ FEHLER: Achern-Kalender nicht gefunden!');
    return;
  }
  if (!calWeil) {
    Logger.log('❌ FEHLER: Weil-Kalender nicht gefunden!');
    return;
  }

  Logger.log(`✓ Kalender Achern: ${calAchern.getName()}`);
  Logger.log(`✓ Kalender Weil: ${calWeil.getName()}`);

  // 4. Zeitraum definieren (2 Monate zurück + 3 Monate voraus)
  const syncStart = new Date();
  syncStart.setDate(syncStart.getDate() - CONFIG.SYNC_DAYS_BACK);
  syncStart.setHours(0, 0, 0, 0);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + CONFIG.SYNC_DAYS_AHEAD);

  // ============================================================
  //  WICHTIG: Events aus BEIDEN Kalendern zusammenführen!
  //  Ein Artist der in IRGENDEINEM Kalender steht, ist beschäftigt
  //  und muss an BEIDEN Standorten als ROT (unavailable) erscheinen.
  // ============================================================

  const calendars = [
    { cal: calAchern, label: 'Achern' },
    { cal: calWeil, label: 'Weil am Rhein' }
  ];

  // Sammle ALLE Events aus BEIDEN Kalendern zusammen
  // Key: "month-day_artistId" → { artist, events: [...], revenueByLoc: { achern: {total,deposit}, weil: {total,deposit} } }
  const artistDayEvents = {};

  for (const calInfo of calendars) {
    const calLoc = calInfo.label === 'Achern' ? 'achern' : 'weil';
    const events = calInfo.cal.getEvents(syncStart, endDate);
    Logger.log(`\n📅 ${calInfo.label}: ${events.length} Events`);

    for (const event of events) {
      const title = event.getTitle();
      const titleCheck = removeAccents(title.toLowerCase().trim());

      // "Cancel"-Events ignorieren (stornierte Termine)
      if (titleCheck.startsWith('cancel')) {
        Logger.log(`  ⏭ Übersprungen (Cancel): "${title}"`);
        continue;
      }

      const isAllDay = event.isAllDayEvent();
      const startTime = event.getStartTime();
      const endTime = event.getEndTime();
      const description = event.getDescription() || '';

      // Umsatz aus Beschreibung parsen
      const rev = parseRevenue(description);
      if (rev.total > 0) {
        Logger.log(`  💰 "${title}" → ${rev.total}€ fix, ${rev.deposit}€ az (${calInfo.label})`);
      }

      // Finde Künstler im Titel
      const matched = findArtistInTitle(title, activeArtists);
      if (matched.length === 0) continue;

      for (const match of matched) {
        const addToDay = (month, day) => {
          const dayKey = `${month}-${day}_${match.artist.id}`;
          if (!artistDayEvents[dayKey]) {
            artistDayEvents[dayKey] = {
              artist: match.artist,
              events: [],
              revenueByLoc: { achern: { total: 0, deposit: 0 }, weil: { total: 0, deposit: 0 } }
            };
          }
          // Revenue nur dem Kalender-Standort zuordnen (nicht beiden!)
          artistDayEvents[dayKey].revenueByLoc[calLoc].total += rev.total;
          artistDayEvents[dayKey].revenueByLoc[calLoc].deposit += rev.deposit;
          return dayKey;
        };

        if (isAllDay) {
          const current = new Date(startTime);
          while (current < endTime) {
            if (current.getFullYear() === CONFIG.YEAR) {
              addToDay(current.getMonth(), current.getDate());
              artistDayEvents[`${current.getMonth()}-${current.getDate()}_${match.artist.id}`].events.push({
                title, isAllDay: true, startTime, endTime, calendar: calInfo.label
              });
            }
            current.setDate(current.getDate() + 1);
          }
        } else {
          const eventDate = new Date(startTime);
          eventDate.setHours(0, 0, 0, 0);
          while (eventDate < endTime) {
            if (eventDate.getFullYear() === CONFIG.YEAR) {
              addToDay(eventDate.getMonth(), eventDate.getDate());
              artistDayEvents[`${eventDate.getMonth()}-${eventDate.getDate()}_${match.artist.id}`].events.push({
                title, isAllDay: false, startTime, endTime, calendar: calInfo.label
              });
            }
            eventDate.setDate(eventDate.getDate() + 1);
          }
        }
      }
    }
  }

  Logger.log(`\n📊 ${Object.keys(artistDayEvents).length} Künstler-Tag-Kombinationen erkannt (beide Kalender zusammen)`);

  // 5. Für jede Kombination: Stunden prüfen → an BEIDEN Standorten updaten
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalRemoved = 0;
  let totalSkipped = 0;

  // Track welche artist+day Combos wir verarbeiten (standort-unabhängig!)
  const processedArtistDays = new Set();

  for (const [dayArtistKey, data] of Object.entries(artistDayEvents)) {
    const [monthDay, artistId] = dayArtistKey.split('_');
    const [month, day] = monthDay.split('-').map(Number);
    const artist = data.artist;

    const targetDate = new Date(CONFIG.YEAR, month, day);
    const bookedHours = getBookedHoursForDay(data.events, targetDate);
    const isOverHalf = bookedHours > HALF_DAY_HOURS;

    processedArtistDays.add(`${artistId}_${month}-${day}`);

    // Revenue-Daten für diesen Tag
    const revData = data.revenueByLoc;

    if (isOverHalf) {
      // Artist ist beschäftigt → ROT an BEIDEN Standorten!
      for (const loc of ['achern', 'weil']) {
        // Revenue nur für den Standort wo das Event tatsächlich ist
        const locRev = revData[loc];
        const hasRevenue = locRev.total > 0;

        const existingBooking = allBookings.find(b =>
          b.artistId === artistId &&
          b.location === loc &&
          b.month === month &&
          b.day === day
        );

        const bookingFields = {
          status: 'unavailable',
          source: 'google-calendar',
          calendarHours: bookedHours
        };
        // Revenue-Felder nur setzen wenn Daten vorhanden
        if (hasRevenue) {
          bookingFields.revenue = locRev.total;
          bookingFields.deposit = locRev.deposit;
        }

        if (existingBooking) {
          if (existingBooking.source === 'google-calendar' && existingBooking.status === 'unavailable'
              && (!hasRevenue || existingBooking.revenue === locRev.total)) {
            // Bereits korrekt als unavailable gesetzt (und Revenue stimmt)
            totalSkipped++;
          } else {
            // ÜBERSCHREIBEN: egal ob manuell oder falscher Status
            firestoreUpdate('bookings', existingBooking.id, bookingFields);
            totalUpdated++;
            const revInfo = hasRevenue ? ` | ${locRev.total}€` : '';
            Logger.log(`🔴 ${artist.name} → ROT am ${day}.${month + 1} @ ${loc} (${bookedHours.toFixed(1)}h${revInfo})`);
          }
        } else {
          // Keine Buchung → neue "unavailable" erstellen
          firestoreCreate('bookings', {
            artistId: artistId,
            month: month,
            day: day,
            location: loc,
            ...bookingFields
          });
          totalCreated++;
          const revInfo = hasRevenue ? ` | ${locRev.total}€` : '';
          Logger.log(`🔴 ${artist.name} → ROT am ${day}.${month + 1} @ ${loc} (${bookedHours.toFixed(1)}h${revInfo})`);
        }
      }
    }
  }

  // 6. Aufräumen: Calendar-Sync-Buchungen entfernen wenn kein Event mehr da ist
  const calSyncBookings = allBookings.filter(b => b.source === 'google-calendar');

  for (const booking of calSyncBookings) {
    const key = `${booking.artistId}_${booking.month}-${booking.day}`;
    if (!processedArtistDays.has(key)) {
      // Kein Calendar-Event mehr für diesen Tag → entfernen
      const artist = activeArtists.find(a => a.id === booking.artistId);
      firestoreDelete('bookings', booking.id);
      totalRemoved++;
      Logger.log(`🟢 ${artist?.name || booking.artistId} → verfügbar am ${booking.day}.${booking.month + 1} @ ${booking.location}`);
    }
  }

  Logger.log('\n=== SYNC ERGEBNIS ===');
  Logger.log(`🔴 Neu auf unavailable gesetzt: ${totalCreated}`);
  Logger.log(`🔄 Überschrieben (manuell → rot): ${totalUpdated}`);
  Logger.log(`🟢 Wieder auf verfügbar: ${totalRemoved}`);
  Logger.log(`⏭ Bereits korrekt: ${totalSkipped}`);
  Logger.log('=== DONE ===');
}

// ===================== SYNC: APP → CALENDAR (Buchungen als Events) =====================

function syncAppToCalendar() {
  Logger.log('\n=== APP → CALENDAR SYNC START ===');

  const artists = firestoreGet('artists');
  const bookings = firestoreGet('bookings');
  const artistMap = {};
  artists.forEach(a => { artistMap[a.id] = a; });

  // Nur manuelle confirmed/tentative Buchungen synchen
  const manualBookings = bookings.filter(b =>
    b.source !== 'google-calendar' &&
    (b.status === 'confirmed' || b.status === 'tentative')
  );

  const calAchern = CalendarApp.getCalendarById(CONFIG.KALENDER_ID_ACHERN);
  const calWeil = CalendarApp.getCalendarById(CONFIG.KALENDER_ID_WEIL);

  if (!calAchern || !calWeil) {
    Logger.log('Kalender nicht gefunden, überspringe App→Calendar Sync');
    return;
  }

  const startDate = new Date(CONFIG.YEAR, 0, 1);
  const endDate = new Date(CONFIG.YEAR, 11, 31);

  // Lade bestehende Sync-Events
  const existingEvents = {};
  for (const event of [...calAchern.getEvents(startDate, endDate), ...calWeil.getEvents(startDate, endDate)]) {
    const desc = event.getDescription() || '';
    const match = desc.match(/\[booking-sync:([^\]]+)\]/);
    if (match) existingEvents[match[1]] = event;
  }

  // Gruppiere zusammenhängende Tage
  const grouped = groupConsecutiveBookings(manualBookings);
  const processedTags = new Set();

  for (const group of grouped) {
    const artist = artistMap[group.artistId];
    if (!artist) continue;

    const cal = group.location === 'achern' ? calAchern : calWeil;
    const tag = group.docIds[0];
    processedTags.add(tag);

    const title = `${artist.name} ${group.status === 'confirmed' ? '✓' : '?'}`;
    const startD = new Date(CONFIG.YEAR, group.month, group.startDay);
    const endD = new Date(CONFIG.YEAR, group.month, group.endDay + 1);

    if (existingEvents[tag]) {
      const event = existingEvents[tag];
      if (event.getTitle() !== title) event.setTitle(title);
    } else {
      const event = cal.createAllDayEvent(title, startD, endD, {
        description: `[booking-sync:${tag}]\nStatus: ${group.status}`
      });
      event.setColor(group.status === 'confirmed'
        ? CalendarApp.EventColor.GREEN
        : CalendarApp.EventColor.YELLOW);
      Logger.log(`+ Calendar Event: ${title} (${group.startDay}-${group.endDay}.${group.month + 1})`);
    }
  }

  // Verwaiste Events löschen
  let deleted = 0;
  for (const [tag, event] of Object.entries(existingEvents)) {
    if (!processedTags.has(tag)) {
      event.deleteEvent();
      deleted++;
    }
  }

  Logger.log(`=== App → Calendar: ${grouped.length} Gruppen, ${deleted} entfernt ===`);
}

function groupConsecutiveBookings(bookings) {
  const sorted = [...bookings].sort((a, b) =>
    a.artistId.localeCompare(b.artistId) ||
    a.location.localeCompare(b.location) ||
    (a.month - b.month) ||
    (a.day - b.day)
  );
  const groups = [];
  let cur = null;
  for (const b of sorted) {
    if (cur && cur.artistId === b.artistId && cur.location === b.location &&
        cur.month === b.month && cur.status === b.status && b.day === cur.endDay + 1) {
      cur.endDay = b.day;
      cur.docIds.push(b.id);
    } else {
      if (cur) groups.push(cur);
      cur = { artistId: b.artistId, location: b.location, month: b.month,
              startDay: b.day, endDay: b.day, status: b.status, docIds: [b.id] };
    }
  }
  if (cur) groups.push(cur);
  return groups;
}

// ===================== REVENUE AGGREGATION =====================

/**
 * Liest ALLE Kalender-Einträge aus beiden Kalendern (2 Monate zurück + 3 Monate voraus),
 * extrahiert Umsatz-Daten (Gesamtpreis + Anzahlung) und speichert sie
 * aggregiert pro Monat und Standort in der calendarRevenue Collection.
 *
 * WICHTIG: Jedes Event wird nur 1x gezählt (dem Start-Monat zugeordnet),
 * auch wenn es über mehrere Tage geht → keine Doppelzählung.
 */
function syncRevenueData() {
  Logger.log('\n=== REVENUE DATA SYNC START ===');

  const artists = firestoreGet('artists');
  const activeArtists = artists.filter(a => a.status === 'active' || a.status === 'visa');

  const calAchern = CalendarApp.getCalendarById(CONFIG.KALENDER_ID_ACHERN);
  const calWeil = CalendarApp.getCalendarById(CONFIG.KALENDER_ID_WEIL);

  if (!calAchern || !calWeil) {
    Logger.log('❌ Kalender nicht gefunden, Revenue-Sync abgebrochen');
    return;
  }

  // Zeitraum: 2 Monate zurück + 3 Monate voraus
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - CONFIG.SYNC_DAYS_BACK);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + CONFIG.SYNC_DAYS_AHEAD);

  Logger.log(`📆 Revenue-Zeitraum: ${startDate.toLocaleDateString('de-DE')} - ${endDate.toLocaleDateString('de-DE')}`);

  // Monthly revenue aggregation: key = "month_location"
  const monthlyData = {};

  // Track processed events to avoid double-counting
  const processedEvents = new Set();

  const calendars = [
    { cal: calAchern, location: 'achern', label: 'Achern' },
    { cal: calWeil, location: 'weil', label: 'Weil am Rhein' }
  ];

  for (const calInfo of calendars) {
    const events = calInfo.cal.getEvents(startDate, endDate);
    Logger.log(`\n📅 ${calInfo.label}: ${events.length} Events für Revenue-Analyse`);

    for (const event of events) {
      const eventId = event.getId();
      const uniqueKey = `${calInfo.location}_${eventId}_${event.getStartTime().getTime()}`;

      // Skip already processed (safety for recurring events)
      if (processedEvents.has(uniqueKey)) continue;
      processedEvents.add(uniqueKey);

      const title = event.getTitle();
      const titleCheck = removeAccents(title.toLowerCase().trim());

      // Cancel-Events ignorieren
      if (titleCheck.startsWith('cancel')) continue;

      const description = event.getDescription() || '';
      const rev = parseRevenue(description);

      // Revenue dem Start-Monat zuordnen
      const start = event.getStartTime();
      if (start.getFullYear() !== CONFIG.YEAR) continue;

      const month = start.getMonth();
      const monthKey = `${month}_${calInfo.location}`;

      // Künstler erkennen
      const matched = findArtistInTitle(title, activeArtists);
      const artistName = matched.length > 0 ? matched[0].artist.name : '';

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: month,
          location: calInfo.location,
          totalRevenue: 0,
          totalDeposit: 0,
          eventCount: 0,
          eventsWithRevenue: 0,
          events: []
        };
      }

      monthlyData[monthKey].eventCount++;

      if (rev.total > 0) {
        monthlyData[monthKey].totalRevenue += rev.total;
        monthlyData[monthKey].totalDeposit += rev.deposit;
        monthlyData[monthKey].eventsWithRevenue++;
        monthlyData[monthKey].events.push({
          title: title,
          date: `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`,
          revenue: rev.total,
          deposit: rev.deposit,
          artistName: artistName
        });
      }
    }
  }

  // Alte calendarRevenue-Dokumente löschen
  const existing = firestoreGet('calendarRevenue');
  for (const doc of existing) {
    firestoreDelete('calendarRevenue', doc.id);
  }

  // Neue Revenue-Daten schreiben
  for (const [key, data] of Object.entries(monthlyData)) {
    const docData = {
      month: data.month,
      location: data.location,
      totalRevenue: data.totalRevenue,
      totalDeposit: data.totalDeposit,
      eventCount: data.eventCount,
      eventsWithRevenue: data.eventsWithRevenue,
      eventsJson: JSON.stringify(data.events),
      syncedAt: new Date().toISOString()
    };
    firestoreCreate('calendarRevenue', docData);

    const label = data.location === 'achern' ? 'Achern' : 'Weil';
    Logger.log(`💰 ${MONTHS_DE[data.month]} ${label}: ${data.totalRevenue}€ gesamt, ${data.totalDeposit}€ AZ (${data.eventsWithRevenue}/${data.eventCount} Events mit Preis)`);
  }

  // Zusammenfassung pro Standort
  for (const loc of ['achern', 'weil']) {
    const locData = Object.values(monthlyData).filter(d => d.location === loc);
    const totalRev = locData.reduce((s, d) => s + d.totalRevenue, 0);
    const totalDep = locData.reduce((s, d) => s + d.totalDeposit, 0);
    const totalEvents = locData.reduce((s, d) => s + d.eventCount, 0);
    Logger.log(`\n📊 ${loc === 'achern' ? 'Achern' : 'Weil'} GESAMT: ${totalRev}€ Umsatz, ${totalDep}€ Anzahlung, ${totalRev - totalDep}€ offen (${totalEvents} Termine)`);
  }

  Logger.log('\n=== REVENUE DATA SYNC DONE ===');
}

// ===================== HAUPT-FUNKTION =====================

function runSync() {
  try {
    Logger.log('🔄 Artefact Booking Sync gestartet: ' + new Date().toLocaleString('de-DE'));
    syncCalendarToApp();
    syncRevenueData();
    Logger.log('\n✅ Alles synchronisiert!');
  } catch (err) {
    Logger.log(`❌ FEHLER: ${err.message}\n${err.stack}`);
  }
}

// ===================== SETUP (EINMALIG) =====================

function setupSync() {
  // Prüfe Kalender-IDs
  if (CONFIG.KALENDER_ID_ACHERN.includes('HIER_')) {
    Logger.log('');
    Logger.log('⚠️  STOP! Du musst zuerst die Kalender-IDs eintragen!');
    Logger.log('');
    Logger.log('So findest du die Kalender-ID:');
    Logger.log('1. Öffne Google Calendar (calendar.google.com)');
    Logger.log('2. Links bei "Meine Kalender" → 3 Punkte neben dem Kalender');
    Logger.log('3. "Einstellungen und Freigabe" klicken');
    Logger.log('4. Runterscrollen zu "Kalender integrieren"');
    Logger.log('5. "Kalender-ID" kopieren');
    Logger.log('');
    Logger.log('Dann oben im Code bei KALENDER_ID_ACHERN und KALENDER_ID_WEIL eintragen.');
    return;
  }

  // Lösche alte Trigger
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'runSync') ScriptApp.deleteTrigger(t);
  });

  // Erstelle stündlichen Trigger
  ScriptApp.newTrigger('runSync')
    .timeBased()
    .everyHours(1)
    .create();

  // Teste Kalender-Zugriff
  const calA = CalendarApp.getCalendarById(CONFIG.KALENDER_ID_ACHERN);
  const calW = CalendarApp.getCalendarById(CONFIG.KALENDER_ID_WEIL);

  if (!calA) {
    Logger.log(`❌ Achern-Kalender nicht gefunden: ${CONFIG.KALENDER_ID_ACHERN}`);
    Logger.log('Prüfe die ID oder ob du Zugriff auf den Kalender hast.');
    return;
  }
  if (!calW) {
    Logger.log(`❌ Weil-Kalender nicht gefunden: ${CONFIG.KALENDER_ID_WEIL}`);
    Logger.log('Prüfe die ID oder ob du Zugriff auf den Kalender hast.');
    return;
  }

  Logger.log('');
  Logger.log('=============================================');
  Logger.log('  ✅ SETUP KOMPLETT!');
  Logger.log('=============================================');
  Logger.log('');
  Logger.log(`📅 Achern-Kalender: ${calA.getName()}`);
  Logger.log(`📅 Weil-Kalender: ${calW.getName()}`);
  Logger.log('');
  Logger.log('⏰ Automatischer Sync: Jede Stunde');
  Logger.log(`📆 Zeitraum: Heute + ${CONFIG.SYNC_DAYS_AHEAD} Tage`);
  Logger.log(`⏱ Arbeitstag: ${CONFIG.WORK_DAY_START}:00 - ${CONFIG.WORK_DAY_END}:00 (${WORK_DAY_HOURS}h)`);
  Logger.log(`📊 Schwelle: >${HALF_DAY_HOURS}h gebucht → ROT`);
  Logger.log('');

  // Lade Artists zum Anzeigen
  const artists = firestoreGet('artists');
  const active = artists.filter(a => a.status === 'active' || a.status === 'visa');
  Logger.log('Erkannte Künstler:');
  active.forEach(a => Logger.log(`  • ${a.name}`));
  Logger.log('');
  Logger.log('Das Script sucht diese Namen in euren Calendar-Events.');
  Logger.log('Wenn ein Künstler > halben Tag gebucht ist → ROT in der App.');
  Logger.log('');

  // Erster Sync
  runSync();
}

// ===================== HILFSFUNKTIONEN =====================

/** Manuell ausführen: Zeigt was das Script in den Kalendern findet */
function debugCalendar() {
  const artists = firestoreGet('artists');
  const active = artists.filter(a => a.status === 'active' || a.status === 'visa');

  Logger.log('=== DEBUG: Calendar-Analyse ===\n');

  const locations = [
    { key: 'achern', id: CONFIG.KALENDER_ID_ACHERN },
    { key: 'weil', id: CONFIG.KALENDER_ID_WEIL }
  ];

  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 14); // Nächste 2 Wochen

  for (const loc of locations) {
    const cal = CalendarApp.getCalendarById(loc.id);
    if (!cal) { Logger.log(`❌ ${loc.key}: Kalender nicht gefunden`); continue; }

    Logger.log(`\n📅 ${cal.getName()} (${loc.key}):`);
    const events = cal.getEvents(today, endDate);

    if (events.length === 0) {
      Logger.log('  Keine Events in den nächsten 2 Wochen');
      continue;
    }

    for (const event of events) {
      const title = event.getTitle();
      const start = event.getStartTime();
      const end = event.getEndTime();
      const isAllDay = event.isAllDayEvent();
      const matches = findArtistInTitle(title, active);

      const dateStr = start.toLocaleDateString('de-DE');
      const timeStr = isAllDay ? 'Ganztag' : `${start.toLocaleTimeString('de-DE', {hour:'2-digit',minute:'2-digit'})} - ${end.toLocaleTimeString('de-DE', {hour:'2-digit',minute:'2-digit'})}`;

      Logger.log(`\n  "${title}" | ${dateStr} | ${timeStr}`);
      if (matches.length > 0) {
        matches.forEach(m => {
          Logger.log(`    → Erkannt: ${m.artist.name} (Match: ${m.matchType})`);
        });

        // Stunden berechnen
        const targetDate = new Date(start);
        targetDate.setHours(0, 0, 0, 0);
        const hours = getBookedHoursForDay(
          [{ isAllDay, startTime: start, endTime: end }],
          targetDate
        );
        Logger.log(`    → ${hours.toFixed(1)}h von ${WORK_DAY_HOURS}h → ${hours > HALF_DAY_HOURS ? '🔴 UNAVAILABLE' : '🟢 OK (unter Hälfte)'}`);
      } else {
        Logger.log(`    → Kein Künstler erkannt`);
      }
    }
  }
}

/** Status-Übersicht */
function checkStatus() {
  const artists = firestoreGet('artists');
  const bookings = firestoreGet('bookings');

  Logger.log('=== STATUS ===');
  Logger.log(`Artists: ${artists.length} (${artists.filter(a => a.status === 'active').length} aktiv)`);
  Logger.log(`Bookings: ${bookings.length}`);
  Logger.log(`  Manuell: ${bookings.filter(b => b.source !== 'google-calendar').length}`);
  Logger.log(`  Vom Calendar: ${bookings.filter(b => b.source === 'google-calendar').length}`);
  Logger.log(`  Confirmed: ${bookings.filter(b => b.status === 'confirmed').length}`);
  Logger.log(`  Tentative: ${bookings.filter(b => b.status === 'tentative').length}`);
  Logger.log(`  Unavailable: ${bookings.filter(b => b.status === 'unavailable').length}`);

  const triggers = ScriptApp.getProjectTriggers();
  Logger.log(`\nTrigger: ${triggers.length}`);
  triggers.forEach(t => Logger.log(`  ${t.getHandlerFunction()} (${t.getEventType()})`));
}

/** Alle automatisch erstellten Buchungen löschen */
function removeAllCalendarSyncBookings() {
  const bookings = firestoreGet('bookings');
  const calSync = bookings.filter(b => b.source === 'google-calendar');
  Logger.log(`Lösche ${calSync.length} Calendar-Sync-Buchungen...`);
  calSync.forEach(b => firestoreDelete('bookings', b.id));
  Logger.log('✅ Alle entfernt. Artists sind wieder verfügbar.');
}

/** Alle von syncAppToCalendar erstellten Calendar-Events löschen */
function removeCalendarSyncEvents() {
  const calAchern = CalendarApp.getCalendarById(CONFIG.KALENDER_ID_ACHERN);
  const calWeil = CalendarApp.getCalendarById(CONFIG.KALENDER_ID_WEIL);
  const startDate = new Date(CONFIG.YEAR, 0, 1);
  const endDate = new Date(CONFIG.YEAR, 11, 31);
  let deleted = 0;

  for (const cal of [calAchern, calWeil]) {
    if (!cal) continue;
    const events = cal.getEvents(startDate, endDate);
    for (const event of events) {
      const desc = event.getDescription() || '';
      if (desc.includes('[booking-sync:')) {
        event.deleteEvent();
        deleted++;
      }
    }
  }
  Logger.log(`✅ ${deleted} Sync-Events aus Google Calendar gelöscht.`);
}

/** Debug: Zeige alle Event-Beschreibungen */
function debugDescriptions() {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + CONFIG.SYNC_DAYS_AHEAD);

  const calendars = [
    { cal: CalendarApp.getCalendarById(CONFIG.KALENDER_ID_ACHERN), label: 'Achern' },
    { cal: CalendarApp.getCalendarById(CONFIG.KALENDER_ID_WEIL), label: 'Weil' }
  ];

  Logger.log('=== ALLE EVENT-BESCHREIBUNGEN ===\n');

  for (const calInfo of calendars) {
    if (!calInfo.cal) continue;
    const events = calInfo.cal.getEvents(today, endDate);
    Logger.log(`📅 ${calInfo.label}: ${events.length} Events\n`);

    for (const event of events) {
      const title = event.getTitle();
      const desc = event.getDescription() || '(leer)';
      const start = event.getStartTime().toLocaleDateString('de-DE');
      Logger.log(`  "${title}" | ${start}`);
      Logger.log(`    Beschreibung: ${desc}`);
      Logger.log('');
    }
  }
}

/** Debug: Zeige ALLE Termine mit Revenue-Parsing pro Standort & Monat */
function debugAllRevenue() {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + CONFIG.SYNC_DAYS_AHEAD);

  const calendars = [
    { cal: CalendarApp.getCalendarById(CONFIG.KALENDER_ID_ACHERN), label: 'Achern' },
    { cal: CalendarApp.getCalendarById(CONFIG.KALENDER_ID_WEIL), label: 'Weil' }
  ];

  // Monats-Aggregation pro Standort
  const monthlyData = {}; // key: "Achern_2026-03" → { total, deposit, count, events: [] }

  for (const calInfo of calendars) {
    if (!calInfo.cal) { Logger.log('⚠️ ' + calInfo.label + ' Kalender nicht gefunden!'); continue; }
    const events = calInfo.cal.getEvents(today, endDate);
    Logger.log('========================================');
    Logger.log('📅 ' + calInfo.label + ': ' + events.length + ' Events');
    Logger.log('========================================\n');

    for (const event of events) {
      const title = event.getTitle();
      const desc = event.getDescription() || '';
      const start = event.getStartTime();
      const dateStr = start.toLocaleDateString('de-DE');
      const month = (start.getMonth() + 1).toString().padStart(2, '0');
      const monthKey = calInfo.label + '_' + start.getFullYear() + '-' + month;
      const rev = parseRevenue(desc);

      // Initialisiere Monat
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { total: 0, deposit: 0, count: 0, withRevenue: 0, events: [] };
      }
      monthlyData[monthKey].count++;
      if (rev.total > 0) {
        monthlyData[monthKey].total += rev.total;
        monthlyData[monthKey].deposit += rev.deposit;
        monthlyData[monthKey].withRevenue++;
      }
      monthlyData[monthKey].events.push({ title, dateStr, desc: desc.substring(0, 200), rev });

      // Log jeden Termin mit Beschreibung
      const revInfo = rev.total > 0 ? ' 💰 ' + rev.total + '€ (AZ: ' + rev.deposit + '€)' : ' ❌ kein Preis';
      Logger.log('  ' + dateStr + ' | "' + title + '"' + revInfo);
      if (desc && desc !== '(leer)') {
        Logger.log('    Beschreibung: ' + desc.substring(0, 300));
      }
    }
    Logger.log('');
  }

  // === ZUSAMMENFASSUNG ===
  Logger.log('\n==========================================');
  Logger.log('=== REVENUE ZUSAMMENFASSUNG PRO MONAT ===');
  Logger.log('==========================================\n');

  const sortedKeys = Object.keys(monthlyData).sort();
  for (const key of sortedKeys) {
    const d = monthlyData[key];
    const rest = d.total - d.deposit;
    Logger.log('📊 ' + key.replace('_', ' '));
    Logger.log('   Termine gesamt: ' + d.count);
    Logger.log('   Termine MIT Preis: ' + d.withRevenue);
    Logger.log('   Termine OHNE Preis: ' + (d.count - d.withRevenue));
    Logger.log('   Erwarteter Umsatz: ' + d.total + '€');
    Logger.log('   Angezahlt: ' + d.deposit + '€');
    Logger.log('   Restzahlung: ' + rest + '€');
    Logger.log('   --- Einzelne Termine mit Preis ---');
    for (const ev of d.events) {
      if (ev.rev.total > 0) {
        Logger.log('     ' + ev.dateStr + ' "' + ev.title + '" → ' + ev.rev.total + '€ (AZ: ' + ev.rev.deposit + '€)');
        if (ev.desc) Logger.log('       Desc: ' + ev.desc);
      }
    }
    Logger.log('   --- Termine OHNE Preis ---');
    for (const ev of d.events) {
      if (ev.rev.total === 0) {
        Logger.log('     ' + ev.dateStr + ' "' + ev.title + '"');
        if (ev.desc && ev.desc.length > 0) Logger.log('       Desc: ' + ev.desc);
      }
    }
    Logger.log('');
  }
}

/** Sync stoppen */
function stopSync() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'runSync') {
      ScriptApp.deleteTrigger(t);
    }
  });
  Logger.log('✅ Sync gestoppt. Kein automatischer Sync mehr.');
}

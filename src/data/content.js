// All page content in one place. Texts in TREATMENTS.what/how/helps and REGIONS.causes/tip are written from
// general professional knowledge and must be proofread by the practice before going live.
export const PHONE = "079 239 67 94";
export const TEL = "tel:+41792396794";
export const BOOK = "https://www.therapie-straehl.ch/termin-buchen";
export const FORM = "https://www.therapie-straehl.ch/kontakformular";
export const MAPS = "https://www.google.com/maps/dir/?api=1&destination=Zimmereiweg%207%2C%204665%20Oftringen";

export const TREATMENTS = {
  klassisch: {
    fig: "ruecken", tone: "olive", pos: "55% 35%", name: "Klassische Massage",
    desc: "Gezielte Griffe lockern die Muskulatur und verbessern die Durchblutung.",
    what: "Die Basis jeder medizinischen Massage. Mit Streichungen, Knetungen und Reibungen wird die Muskulatur gezielt gelockert und besser durchblutet.",
    how: ["Löst Muskelverhärtungen und Triggerpunkte", "Fördert die Durchblutung und den Stoffwechsel", "Entspannt Körper und Nervensystem"],
    helps: ["Verspannungen", "Rückenschmerzen", "Nackenschmerzen", "Spannungskopfschmerz", "Stress", "Muskelkater"],
  },
  lymph: {
    fig: "bein", tone: "teal", pos: "62% 55%", name: "Manuelle Lymph\u00ADdrainage",
    desc: "Eine sanfte Technik, die den Lymphfluss anregt und Schwellungen spürbar reduziert.",
    what: "Eine sehr sanfte, rhythmische Technik. Mit leichtem Druck wird die Lymphe in Richtung der Lymphknoten geleitet, damit sich gestaute Flüssigkeit abbauen kann.",
    how: ["Entstaut Gewebe und reduziert Schwellungen", "Unterstützt die Heilung nach Operationen und Verletzungen", "Wirkt beruhigend und schmerzlindernd"],
    helps: ["Schwellungen", "Lymphödeme", "Nach Operationen", "Schwere Beine", "Verstauchungen", "Wassereinlagerungen"],
  },
  bindegewebe: {
    fig: "zug", tone: "deep", pos: "50% 35%", name: "Bindegewebs\u00ADmassage",
    desc: "Tiefe Griffe an Haut und Bindegewebe regen den Stoffwechsel an und lösen Verklebungen.",
    what: "Gezielte Zugreize auf Haut und Unterhautgewebe. Über Reflexzonen wirkt sie nicht nur lokal, sondern auch auf Organe und das vegetative Nervensystem.",
    how: ["Löst Verklebungen im Bindegewebe und an Narben", "Verbessert die Beweglichkeit des Gewebes", "Reguliert über Reflexzonen das Nervensystem"],
    helps: ["Verklebtes Gewebe", "Narben", "Chronische Rückenschmerzen", "Durchblutungsstörungen", "Verdauungsbeschwerden"],
  },
  sport: {
    fig: "wade", tone: "moss", pos: "50% 42%", name: "Sportmassage",
    desc: "Angepasster Druck entspannt beanspruchte Muskeln und fördert die Regeneration.",
    what: "Kräftiger und dynamischer als die klassische Massage, abgestimmt auf Training und Wettkampf. Für Freizeit wie Leistungssport.",
    how: ["Bereitet die Muskulatur auf Belastung vor", "Beschleunigt die Regeneration nach dem Sport", "Beugt Verletzungen und Überlastung vor"],
    helps: ["Muskelkater", "Überlastung", "Zerrungen", "Verhärtete Waden", "Wettkampfvorbereitung", "Regeneration"],
  },
  fussreflex: {
    fig: "sohle", tone: "sand", pos: "50% 38%", name: "Fussreflex\u00ADzonen\u00ADmassage",
    desc: "Gezielter Druck auf bestimmte Zonen am Fuss wirkt positiv auf den ganzen Körper.",
    what: "Am Fuss spiegelt sich der ganze Körper. Durch gezielten Druck auf bestimmte Zonen werden die zugeordneten Körperregionen und Organe angeregt.",
    how: ["Regt die Selbstheilungskräfte an", "Entspannt tief und baut Stress ab", "Unterstützt Organe über die Reflexzonen"],
    helps: ["Stress", "Schlafstörungen", "Kopfschmerzen", "Verdauungsbeschwerden", "Müde Füsse", "Innere Unruhe"],
  },
  taping: {
    fig: "knie", tone: "night", pos: "45% 58%", name: "Klassisches und Kinesio-Taping",
    desc: "Elastische Tapes stützen Gelenke und Muskulatur und fördern die Regeneration.",
    what: "Elastische Tapes werden direkt auf die Haut geklebt. Sie stützen, ohne die Bewegung einzuschränken, und wirken rund um die Uhr weiter.",
    how: ["Entlastet Muskeln und Gelenke im Alltag", "Fördert den Lymphfluss unter der Haut", "Verlängert die Wirkung der Massage"],
    helps: ["Gelenkschmerzen", "Knieprobleme", "Schulterschmerzen", "Sportverletzungen", "Schwellungen", "Fehlhaltungen"],
  },
};

// back: true = the region is seen from behind
export const REGIONS = {
  nacken: { label: "Nacken und Schultern", short: "Die häufigste Spannungszone, von Bildschirmarbeit bis Stress.", sym: ["Verspannungen", "Spannungskopfschmerz", "Steifer Nacken", "Schulterschmerzen", "Bewegungseinschränkung HWS"], treats: ["klassisch", "bindegewebe", "taping"], causes: ["Bildschirmarbeit", "Stress", "Fehlhaltung", "Zugluft"], tip: "Halten Ihre Beschwerden schon länger als zwei Wochen an oder strahlen sie in Kopf oder Arme aus? Dann lohnt sich eine Behandlung." },
  brust: { label: "Brust und Rumpf", short: "Atemhilfsmuskulatur und Brustkorb, oft verspannt bei Fehlhaltung.", sym: ["Verspannte Brustmuskulatur", "Eingeschränkte Atmung", "Haltungsbedingte Beschwerden", "Narbengewebe"], treats: ["klassisch", "bindegewebe", "lymph"], causes: ["Rundrücken", "Flache Atmung", "Stress", "Narben nach Operationen"], tip: "Bei plötzlichen Brustschmerzen bitte immer zuerst ärztlich abklären lassen." },
  bauch: { label: "Bauch und Lymphe", short: "Sanfte Arbeit am Gewebe für Entstauung und Wohlbefinden.", sym: ["Schwellungen", "Lymphstau", "Verklebtes Bindegewebe", "Träger Stoffwechsel"], treats: ["lymph", "bindegewebe", "klassisch"], causes: ["Bewegungsmangel", "Nach Operationen", "Hormonelle Veränderungen", "Langes Sitzen"], tip: "Sanfte Techniken eignen sich auch, wenn Druck sonst unangenehm ist." },
  ruecken: { back: true, label: "Rücken und Wirbelsäule", short: "Vom Nacken bis zur Lende: Verspannungen entlang der Wirbelsäule.", sym: ["Rückenschmerzen", "Verspannungen", "Hexenschuss", "Verklebte Faszien", "Einseitige Belastung"], treats: ["klassisch", "bindegewebe", "sport"], causes: ["Langes Sitzen", "Heben und Tragen", "Bewegungsmangel", "Stress"], tip: "Viele Rückenschmerzen sind muskulär und lassen sich gut behandeln. Je früher, desto besser." },
  arm: { label: "Arme und Ellbogen", short: "Über- und Fehlbelastung von Oberarm, Ellbogen und Unterarm.", sym: ["Verspannter Unterarm", "Tennis- oder Golferellbogen", "Überlastung", "Schwere Arme"], treats: ["klassisch", "bindegewebe", "taping"], causes: ["Maus und Tastatur", "Handwerk", "Tennis und Golf", "Einseitige Belastung"], tip: "Ziehende Schmerzen am Ellbogen kommen oft von überlasteten Unterarmmuskeln." },
  hand: { label: "Hände und Handgelenke", short: "Feine Strukturen, die bei Belastung schnell reagieren.", sym: ["Schwellungen", "Überlastung", "Steife Handgelenke", "Nach Verletzung oder Gips"], treats: ["lymph", "klassisch", "taping"], causes: ["Smartphone und Maus", "Feinmotorische Arbeit", "Verstauchungen", "Schwellungen"], tip: "Kribbeln oder Taubheit in den Fingern bitte ärztlich abklären lassen." },
  huefte: { label: "Hüfte und Becken", short: "Das Zentrum der Statik, strahlt oft in Rücken und Beine aus.", sym: ["Hüftschmerzen", "ISG-Beschwerden", "Verspannte Hüftbeuger", "Beckenschiefstand"], treats: ["klassisch", "bindegewebe", "sport"], causes: ["Langes Sitzen", "Einseitige Haltung", "Laufsport", "Beinlängendifferenz"], tip: "Verkürzte Hüftbeuger sind eine häufige Ursache für Schmerzen im unteren Rücken." },
  gesaess: { back: true, label: "Gesäss und Becken", short: "Kräftige Muskulatur, die bei Sitzen und Sport viel leistet.", sym: ["Verspannte Gesässmuskulatur", "ISG-Beschwerden", "Ausstrahlende Schmerzen", "Sitzbeschwerden"], treats: ["klassisch", "bindegewebe", "sport"], causes: ["Langes Sitzen", "Laufsport", "Schonhaltung", "Muskuläre Dysbalance"], tip: "Ausstrahlende Schmerzen ins Bein können vom Gesässmuskel kommen." },
  oberschenkel: { label: "Oberschenkel", short: "Grosse Muskelgruppen, die auf gezielte Arbeit gut ansprechen.", sym: ["Muskelkater", "Zerrung", "Harte Muskulatur", "Verkürzte Oberschenkel"], treats: ["sport", "klassisch", "taping"], causes: ["Sport", "Zerrungen", "Langes Stehen", "Fehlbelastung"], tip: "Nach Zerrungen hilft eine gezielte Behandlung, wieder schneller fit zu werden." },
  knie: { label: "Knie", short: "Empfindliches Gelenk, profitiert von Entstauung und Stütze.", sym: ["Schwellung nach OP", "Reizzustände", "Instabilitätsgefühl", "Belastungsschmerz"], treats: ["lymph", "taping", "klassisch"], causes: ["Laufen und Springen", "Nach Operationen", "Übergewicht", "Fehlstellung"], tip: "Tapes entlasten das Knie im Alltag und beim Sport." },
  wade: { label: "Waden und Unterschenkel", short: "Häufig verhärtet bei Sport, Stehberufen und langem Sitzen.", sym: ["Wadenkrämpfe", "Verhärtungen", "Schwere Beine", "Schienbeinbeschwerden"], treats: ["sport", "klassisch", "lymph"], causes: ["Laufsport", "Langes Stehen", "Wassereinlagerungen", "Falsches Schuhwerk"], tip: "Schwere, geschwollene Beine sprechen oft gut auf Lymphdrainage an." },
  fuss: { label: "Füsse und Sprunggelenk", short: "Über die Reflexzonen wirkt die Behandlung auf den ganzen Körper.", sym: ["Müde, schwere Füsse", "Verspannte Fusssohle", "Nach Sprunggelenksverletzung", "Allgemeines Unwohlsein"], treats: ["fussreflex", "klassisch", "taping"], causes: ["Falsches Schuhwerk", "Umknicken", "Langes Stehen", "Laufsport"], tip: "Über die Fussreflexzonen wirkt eine Behandlung auch auf den ganzen Körper." },
};

export const regionsFor = (t) => Object.keys(REGIONS).filter((r) => REGIONS[r].treats.includes(t));

// opening hours by weekday (0 = Sunday), in the practice's own time zone
export const HOURS = { 1: [8, 20], 2: [8, 20], 3: [8, 20], 4: [8, 20], 5: [8, 17], 6: [10, 14] };

export interface YoukiEntry {
  id: number;
  entryNumber: number;
  name: string;
  yw3: boolean;
  busters2: boolean;
  /** Enhanced variants (極・ / 特上・), used by the picker filter. */
  isEnhanced: boolean;
}

function e(id: number, name: string, entryNumber: number, yw3: boolean, busters2: boolean): YoukiEntry {
  return { id, entryNumber, name, yw3, busters2, isEnhanced: name.startsWith("極") || name.startsWith("特上") };
}

const allEntries: YoukiEntry[] = [
  e(0, "妖気なしに戻す", 0, true, true),
  e(1, "しゃくねつ", 1, true, true),
  e(2, "極・しゃくねつ", 2, true, true),
  e(3, "あらなみ", 3, true, true),
  e(4, "極・あらなみ", 4, true, true),
  e(5, "いなずま", 5, true, true),
  e(6, "極・いなずま", 6, true, true),
  e(7, "つむじかぜ", 7, true, true),
  e(8, "極・つむじかぜ", 8, true, true),
  e(9, "すなあらし", 9, true, true),
  e(10, "極・すなあらし", 10, true, true),
  e(11, "えんま", 11, true, true),
  e(12, "極・えんま", 12, true, true),
  e(13, "ふぶき", 13, true, true),
  e(14, "極・ふぶき", 14, true, true),
  e(15, "おうごん", 15, true, true),
  e(16, "極・おうごん", 16, true, true),
  e(17, "げっこう", 17, true, true),
  e(18, "極・げっこう", 18, true, true),
  e(19, "ひかり", 19, true, true),
  e(20, "極・ひかり", 20, true, true),
  e(21, "やみ", 21, true, true),
  e(22, "極・やみ", 22, true, true),
  e(23, "ゴッド", 23, true, true),
  e(24, "極・ゴッド", 24, true, true),
  e(25, "サタン", 25, true, true),
  e(26, "極・サタン", 26, true, true),
  e(27, "すし", 27, true, true),
  e(28, "特上・すし", 28, true, true),
  e(29, "てんぷら", 29, true, true),
  e(30, "特上・てんぷら", 30, true, true),
  e(31, "いたずら", 31, true, true),
  e(32, "極・いたずら", 32, true, true),
  e(33, "やまびこ", 33, true, true),
  e(34, "極・やまびこ", 34, true, true),
  e(35, "おまつり", 35, true, true),
  e(36, "極・おまつり", 36, true, true),
  e(37, "けあな", 37, true, true),
  e(38, "極・けあな", 38, true, true),
  e(39, "だいきち", 39, true, true),
  e(40, "極・だいきち", 40, true, true),
  e(41, "スマイル", 41, true, true),
  e(42, "極・スマイル", 42, true, true),
  e(43, "うきうき", 43, true, true),
  e(44, "極・うきうき", 44, true, true),
  e(45, "くちぶえ", 45, true, true),
  e(46, "極・くちぶえ", 46, true, true),
  e(47, "ひほう", 47, true, true),
  e(48, "極・ひほう", 48, true, true),
  e(49, "おたから", 49, true, true),
  e(50, "神えんま", 50, true, true),
  e(51, "ひのとり", 51, true, true),
  e(52, "くれくれ", 52, true, true),
  e(53, "ぼける", 53, true, true),
  e(54, "エルドラド", 54, true, true),
  e(55, "ナルシスト", 55, true, true),
  e(56, "マダム", 56, true, true),
  e(57, "ストーン", 57, true, true),
  e(58, "だいひほう", 58, true, true),
  e(59, "ドエス", 59, true, true),
  e(60, "おおざっぱ", 60, true, true),
  e(61, "あまてらす", 61, true, true),
  e(62, "アンコール", 62, true, true),
  e(63, "でんせつ", 63, true, true),
  e(64, "メリケン", 64, true, true),
  e(65, "ミステリー", 65, true, true),
  e(66, "クリスタル", 66, true, true),
  e(67, "ぼうけん", 67, true, true),
  e(68, "ガンマン", 68, true, true),
  e(69, "けんごう", 69, true, true),
  e(70, "ねらいうち", 70, true, true),
  e(71, "ゆうき", 71, true, true),
  e(72, "シャドウ", 72, true, true),
  e(73, "ささやか", 73, true, true),
  e(74, "よくばり", 74, true, true),
  e(75, "こううん", 75, true, true),
  e(76, "ハンター", 76, true, true),
  e(77, "けんじゃ", 77, true, true),
  e(78, "ゆうしゃ", 78, true, true),
  e(79, "やまだ", 79, true, true),
  e(80, "おなら", 80, true, true),
  e(81, "のろい", 81, true, true),
  e(82, "てんくう", 82, true, true),
  e(83, "きせき", 83, true, true),
  e(84, "だいち", 84, true, true),
  e(85, "いさまし", 85, true, true),
  e(86, "ふしぎ", 86, true, true),
  e(87, "ごーけつ", 87, true, true),
  e(88, "ぷりちー", 88, true, true),
  e(89, "ぽかぽか", 89, true, true),
  e(90, "うすらかげ", 90, true, true),
  e(91, "ぶきみー", 91, true, true),
  e(92, "にょろろん", 92, true, true),
  e(93, "ちから", 93, true, true),
  e(94, "ちえ", 94, true, true),
  e(95, "めでたい", 95, true, true),
  e(96, "へいぼん", 96, true, true),
  e(97, "ふういん", 97, false, true),
  e(999, "ふういん（内部データ）", 0, true, false),
];

export function catalogForGame(busters2: boolean): YoukiEntry[] {
  return allEntries.filter((entry) => (busters2 ? entry.busters2 : entry.yw3));
}

export function nameFor(id: number): string {
  return allEntries.find((entry) => entry.id === id)?.name ?? `未登録の妖気 (ID ${id})`;
}

/** Display name with internal-data markers stripped, unknown IDs relabelled. */
export function displayName(name: string): string {
  const clean = name.replaceAll("（内部データ）", "");
  return clean.startsWith("未登録の妖気") ? "不明な妖気" : clean;
}

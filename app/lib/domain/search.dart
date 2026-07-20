/// 품목 검색 — 이름·별칭 부분 일치.
/// 별칭 사전은 사람들이 실제로 부르는 이름을 품목 id에 연결한다 (기획서 5.1⑤).
library;

const Map<String, List<String>> itemAliases = {
  'egg': ['달걀', '특란'],
  'zucchini': ['호박'],
  'green-onion': ['파', '쪽파'],
  'chicken': ['닭', '치킨', '생닭'],
  'pork-belly': ['삼겹', '돼지고기', '돼지'],
  'rice': ['백미'],
  'radish': ['무우'],
  'cabbage': ['김장배추', '고랭지배추'],
  'lettuce': ['청상추', '적상추'],
  'potato': ['수미감자'],
  'garlic': ['깐마늘'],
  'green-pepper': ['고추', '꽈리고추'],
  'oyster-mushroom': ['버섯', '애느타리'],
  'king-oyster': ['버섯', '새송이'],
  'cherry-tomato': ['대추방울토마토'],
  'kiwi': ['참다래'],
  'beef-sirloin': ['소고기', '등심', '한우'],
  'pork-neck': ['목심', '돼지고기'],
  'milk': ['흰우유'],
  'laver': ['마른김', '구운김'],
  'anchovy': ['마른멸치'],
  'sweet-potato': ['밤고구마'],
};

/// 검색어가 품목 이름·별칭·id 중 하나와 부분 일치하면 true.
/// 빈 검색어는 모든 품목과 일치한다.
bool matchesQuery({
  required String itemId,
  required String itemName,
  required String query,
}) {
  final normalized = query.trim().toLowerCase();
  if (normalized.isEmpty) return true;
  if (itemName.toLowerCase().contains(normalized)) return true;
  if (itemId.toLowerCase().contains(normalized)) return true;
  final aliases = itemAliases[itemId] ?? const [];
  return aliases.any((alias) => alias.toLowerCase().contains(normalized));
}

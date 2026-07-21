/// KAMIS 소매가 조사 도시 목록.
/// 서버 REGIONS(server/src/collector/kamis-feed.ts)와 동기 유지할 것.
/// 조사 대상이 아닌 시·군(안산·화성·성남 등)은 데이터가 없어 제외된다.
library;

class Region {
  const Region(this.code, this.name);

  final String code;
  final String name;
}

const String defaultRegionCode = '1101';

const List<Region> regions = [
  Region('1101', '서울'),
  Region('2300', '인천'),
  Region('3111', '수원'),
  Region('3138', '고양'),
  Region('3145', '용인'),
  Region('2100', '부산'),
  Region('2200', '대구'),
  Region('2501', '대전'),
  Region('2401', '광주'),
  Region('2601', '울산'),
  Region('2701', '세종'),
  Region('3211', '춘천'),
  Region('3214', '강릉'),
  Region('3311', '청주'),
  Region('3411', '천안'),
  Region('3511', '전주'),
  Region('3613', '순천'),
  Region('3711', '포항'),
  Region('3714', '안동'),
  Region('3814', '창원'),
  Region('3911', '제주'),
];

Region regionByCode(String code) =>
    regions.firstWhere((r) => r.code == code, orElse: () => regions.first);

/// 사용자가 선택하는 도시.
/// KAMIS 조사 도시가 아니면 지리적으로 가장 가까운 조사 도시의 데이터를 쓴다.
class City {
  const City(this.name, this.regionCode);

  final String name;

  /// 데이터 기준이 되는 KAMIS 조사 도시 코드
  final String regionCode;

  Region get surveyRegion => regionByCode(regionCode);

  /// 자체 조사 도시인지 (아니면 인근 도시 기준)
  bool get isSurveyed => surveyRegion.name == name;
}

/// 전국 시 단위 도시 목록 (조사 도시 21곳 + 인근 기준 제공 도시).
/// 매핑 기준: 직선거리상 가장 가까운 KAMIS 조사 도시.
const List<City> cities = [
  // ── KAMIS 조사 도시 (자체 데이터) ──
  City('서울', '1101'),
  City('인천', '2300'),
  City('수원', '3111'),
  City('고양', '3138'),
  City('용인', '3145'),
  City('부산', '2100'),
  City('대구', '2200'),
  City('대전', '2501'),
  City('광주', '2401'),
  City('울산', '2601'),
  City('세종', '2701'),
  City('춘천', '3211'),
  City('강릉', '3214'),
  City('청주', '3311'),
  City('천안', '3411'),
  City('전주', '3511'),
  City('순천', '3613'),
  City('포항', '3711'),
  City('안동', '3714'),
  City('창원', '3814'),
  City('제주', '3911'),
  // ── 경기 (인근 조사 도시 기준) ──
  City('성남', '1101'),
  City('안양', '1101'),
  City('과천', '1101'),
  City('광명', '1101'),
  City('하남', '1101'),
  City('구리', '1101'),
  City('남양주', '1101'),
  City('의정부', '1101'),
  City('양주', '1101'),
  City('동두천', '1101'),
  City('포천', '1101'),
  City('광주(경기)', '1101'),
  City('안산', '3111'),
  City('화성', '3111'),
  City('군포', '3111'),
  City('의왕', '3111'),
  City('오산', '3111'),
  City('부천', '2300'),
  City('시흥', '2300'),
  City('김포', '2300'),
  City('파주', '3138'),
  City('이천', '3145'),
  City('여주', '3145'),
  City('평택', '3411'),
  City('안성', '3411'),
  // ── 강원 ──
  City('원주', '3211'),
  City('속초', '3214'),
  City('동해', '3214'),
  City('삼척', '3214'),
  City('태백', '3214'),
  // ── 충북 ──
  City('충주', '3311'),
  City('제천', '3311'),
  // ── 충남 ──
  City('아산', '3411'),
  City('당진', '3411'),
  City('서산', '3411'),
  City('공주', '2501'),
  City('논산', '2501'),
  City('계룡', '2501'),
  City('보령', '2501'),
  // ── 전북 ──
  City('군산', '3511'),
  City('익산', '3511'),
  City('정읍', '3511'),
  City('김제', '3511'),
  City('남원', '3511'),
  // ── 전남 ──
  City('목포', '2401'),
  City('나주', '2401'),
  City('여수', '3613'),
  City('광양', '3613'),
  // ── 경북 ──
  City('경주', '3711'),
  City('경산', '2200'),
  City('구미', '2200'),
  City('김천', '2200'),
  City('영천', '2200'),
  City('상주', '2200'),
  City('영주', '3714'),
  City('문경', '3714'),
  // ── 경남 ──
  City('진주', '3814'),
  City('통영', '3814'),
  City('사천', '3814'),
  City('밀양', '3814'),
  City('김해', '2100'),
  City('양산', '2100'),
  City('거제', '2100'),
  // ── 제주 ──
  City('서귀포', '3911'),
];

City cityByName(String name) =>
    cities.firstWhere((c) => c.name == name, orElse: () => cities.first);

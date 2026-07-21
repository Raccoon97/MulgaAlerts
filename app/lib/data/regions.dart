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

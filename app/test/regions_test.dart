import 'package:flutter_test/flutter_test.dart';
import 'package:mulga/data/regions.dart';

void main() {
  group('전국 도시 매핑', () {
    test('모든 도시는 유효한 조사 도시 코드에 매핑된다', () {
      final surveyCodes = regions.map((r) => r.code).toSet();
      for (final city in cities) {
        expect(
          surveyCodes.contains(city.regionCode),
          isTrue,
          reason: '${city.name}의 기준 코드(${city.regionCode})가 조사 도시가 아님',
        );
      }
    });

    test('조사 도시 21곳은 자기 자신에 매핑된다', () {
      final surveyed = cities.where((c) => c.isSurveyed).toList();
      expect(surveyed, hasLength(regions.length));
      for (final city in surveyed) {
        expect(city.surveyRegion.name, city.name);
      }
    });

    test('안산·화성은 수원, 성남은 서울 기준이다', () {
      expect(cityByName('안산').surveyRegion.name, '수원');
      expect(cityByName('화성').surveyRegion.name, '수원');
      expect(cityByName('성남').surveyRegion.name, '서울');
      expect(cityByName('안산').isSurveyed, isFalse);
    });

    test('도시 이름은 중복되지 않는다', () {
      final names = cities.map((c) => c.name).toList();
      expect(names.toSet().length, names.length);
    });

    test('없는 도시 이름은 기본 도시(서울)로 폴백한다', () {
      expect(cityByName('평양').name, '서울');
    });
  });
}

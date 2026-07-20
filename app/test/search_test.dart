import 'package:flutter_test/flutter_test.dart';
import 'package:mulga/domain/search.dart';

void main() {
  group('matchesQuery', () {
    test('품목명 부분 일치로 검색된다', () {
      expect(
        matchesQuery(itemId: 'cabbage', itemName: '배추', query: '배추'),
        isTrue,
      );
      expect(
        matchesQuery(itemId: 'cabbage', itemName: '배추', query: '배'),
        isTrue,
      );
      expect(
        matchesQuery(itemId: 'cabbage', itemName: '배추', query: '무'),
        isFalse,
      );
    });

    test('별칭으로도 검색된다 (달걀→계란, 호박→애호박)', () {
      expect(matchesQuery(itemId: 'egg', itemName: '계란', query: '달걀'), isTrue);
      expect(
        matchesQuery(itemId: 'zucchini', itemName: '애호박', query: '호박'),
        isTrue,
      );
      expect(
        matchesQuery(itemId: 'green-onion', itemName: '대파', query: '파'),
        isTrue,
      );
      expect(
        matchesQuery(itemId: 'chicken', itemName: '닭고기', query: '닭'),
        isTrue,
      );
    });

    test('앞뒤 공백과 영문 대소문자를 무시한다', () {
      expect(
        matchesQuery(itemId: 'egg', itemName: '계란', query: '  계란  '),
        isTrue,
      );
      expect(matchesQuery(itemId: 'egg', itemName: '계란', query: 'EGG'), isTrue);
    });

    test('빈 검색어는 모든 품목과 일치한다', () {
      expect(matchesQuery(itemId: 'egg', itemName: '계란', query: ''), isTrue);
      expect(matchesQuery(itemId: 'egg', itemName: '계란', query: '   '), isTrue);
    });

    test('별칭이 없는 품목은 이름으로만 일치한다', () {
      expect(
        matchesQuery(itemId: 'banana', itemName: '바나나', query: '바나나'),
        isTrue,
      );
      expect(
        matchesQuery(itemId: 'banana', itemName: '바나나', query: '파인애플'),
        isFalse,
      );
    });
  });
}

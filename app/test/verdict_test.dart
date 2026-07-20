import 'package:flutter_test/flutter_test.dart';
import 'package:mulga/domain/verdict.dart';

void main() {
  group('deviationRate', () {
    test('평시가 대비 편차율을 계산한다', () {
      expect(deviationRate(1100, 1000), closeTo(0.1, 1e-9));
      expect(deviationRate(900, 1000), closeTo(-0.1, 1e-9));
      expect(deviationRate(1000, 1000), 0);
    });

    test('기준 가격이 0 이하이면 에러를 던진다', () {
      expect(() => deviationRate(1000, 0), throwsArgumentError);
      expect(() => deviationRate(1000, -100), throwsArgumentError);
    });

    test('현재 가격이 음수이면 에러를 던진다', () {
      expect(() => deviationRate(-1, 1000), throwsArgumentError);
    });
  });

  group('judgeVerdict', () {
    test('평시보다 10% 이상 싸면 cheap (경계값 포함)', () {
      expect(judgeVerdict(890, 1000), Verdict.cheap);
      expect(judgeVerdict(900, 1000), Verdict.cheap);
    });

    test('평시보다 10% 이상 비싸면 pricey (경계값 포함)', () {
      expect(judgeVerdict(1110, 1000), Verdict.pricey);
      expect(judgeVerdict(1100, 1000), Verdict.pricey);
    });

    test('±10% 이내면 normal', () {
      expect(judgeVerdict(1000, 1000), Verdict.normal);
      expect(judgeVerdict(1099, 1000), Verdict.normal);
      expect(judgeVerdict(901, 1000), Verdict.normal);
    });

    test('품목별 임계값을 조정할 수 있다', () {
      expect(judgeVerdict(1120, 1000, threshold: 0.15), Verdict.normal);
      expect(judgeVerdict(1150, 1000, threshold: 0.15), Verdict.pricey);
    });
  });

  group('judgeMovement', () {
    test('전일 대비 2% 이상 오르면 up', () {
      expect(judgeMovement(1020, 1000), Movement.up);
    });

    test('전일 대비 2% 이상 내리면 down', () {
      expect(judgeMovement(980, 1000), Movement.down);
    });

    test('±2% 미만 변동은 flat', () {
      expect(judgeMovement(1019, 1000), Movement.flat);
      expect(judgeMovement(981, 1000), Movement.flat);
      expect(judgeMovement(1000, 1000), Movement.flat);
    });
  });
}

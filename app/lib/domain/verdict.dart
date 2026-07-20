/// 판정 로직 — 서버(server/src/domain/verdict.ts)와 동일 사양.
/// 서버 응답에 판정이 포함되지만, 오프라인 폴백(번들 샘플 데이터)일 때
/// 클라이언트에서 같은 규칙으로 계산하기 위해 유지한다.
library;

const double defaultVerdictThreshold = 0.1;
const double movementThreshold = 0.02;

enum Verdict { cheap, normal, pricey }

enum Movement { up, down, flat }

void _assertValidPrice(num value, String label) {
  if (value.isNaN || value.isInfinite || value < 0) {
    throw ArgumentError('$label은(는) 0 이상의 숫자여야 합니다: $value');
  }
}

/// (현재가 − 평시가) / 평시가
double deviationRate(num current, num baseline) {
  _assertValidPrice(current, '현재 가격');
  if (baseline.isNaN || baseline.isInfinite || baseline <= 0) {
    throw ArgumentError('기준 가격은 양수여야 합니다: $baseline');
  }
  return (current - baseline) / baseline;
}

Verdict judgeVerdict(
  num current,
  num baseline, {
  double threshold = defaultVerdictThreshold,
}) {
  final rate = deviationRate(current, baseline);
  if (rate <= -threshold) return Verdict.cheap;
  if (rate >= threshold) return Verdict.pricey;
  return Verdict.normal;
}

Movement judgeMovement(num current, num previous) {
  final rate = deviationRate(current, previous);
  if (rate >= movementThreshold) return Movement.up;
  if (rate <= -movementThreshold) return Movement.down;
  return Movement.flat;
}

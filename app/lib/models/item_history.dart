/// 서버 /api/items/:id/history 응답의 data 부분.
class ItemHistory {
  const ItemHistory({
    required this.unit,
    required this.normalPrice,
    required this.history,
    required this.milestones,
    required this.milestonesAsOf,
  });

  final String? unit;
  final int? normalPrice;

  /// 일일 적재 이력 (날짜 오름차순)
  final List<HistoryPoint> history;

  /// KAMIS 시점 데이터 — 이력이 쌓이기 전에도 차트를 그릴 수 있게 한다
  final List<Milestone> milestones;

  /// milestones의 기준일 (YYYY-MM-DD)
  final String? milestonesAsOf;

  factory ItemHistory.fromJson(Map<String, dynamic> json) {
    return ItemHistory(
      unit: json['unit'] as String?,
      normalPrice: json['normalPrice'] as int?,
      history: (json['history'] as List<dynamic>? ?? [])
          .map((raw) => HistoryPoint.fromJson(raw as Map<String, dynamic>))
          .toList(growable: false),
      milestones: (json['milestones'] as List<dynamic>? ?? [])
          .map((raw) => Milestone.fromJson(raw as Map<String, dynamic>))
          .toList(growable: false),
      milestonesAsOf: json['milestonesAsOf'] as String?,
    );
  }
}

class HistoryPoint {
  const HistoryPoint({required this.date, required this.price});

  /// YYYY-MM-DD
  final String date;
  final int price;

  factory HistoryPoint.fromJson(Map<String, dynamic> json) =>
      HistoryPoint(date: json['date'] as String, price: json['price'] as int);
}

class Milestone {
  const Milestone({
    required this.label,
    required this.daysAgo,
    required this.price,
  });

  final String label;
  final int daysAgo;
  final int price;

  factory Milestone.fromJson(Map<String, dynamic> json) => Milestone(
    label: json['label'] as String,
    daysAgo: json['daysAgo'] as int,
    price: json['price'] as int,
  );
}

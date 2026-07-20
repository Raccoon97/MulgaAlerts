import 'package:mulga/domain/verdict.dart';

/// 서버 /api/items 응답의 품목 한 건.
/// 서버가 판정을 내려주지만, 폴백 데이터에서는 로컬 판정 로직으로 채운다.
class PriceItem {
  const PriceItem({
    required this.id,
    required this.name,
    required this.unit,
    required this.category,
    required this.price,
    required this.prevPrice,
    required this.normalPrice,
    required this.deviation,
    required this.verdict,
    required this.movement,
  });

  final String id;
  final String name;
  final String unit;
  final String category;
  final int price;
  final int prevPrice;
  final int normalPrice;
  final double deviation;
  final Verdict verdict;
  final Movement movement;

  /// 원시 값으로부터 판정을 로컬 계산해 생성 (폴백 데이터용)
  factory PriceItem.compute({
    required String id,
    required String name,
    required String unit,
    required String category,
    required int price,
    required int prevPrice,
    required int normalPrice,
  }) {
    return PriceItem(
      id: id,
      name: name,
      unit: unit,
      category: category,
      price: price,
      prevPrice: prevPrice,
      normalPrice: normalPrice,
      deviation: deviationRate(price, normalPrice),
      verdict: judgeVerdict(price, normalPrice),
      movement: judgeMovement(price, prevPrice),
    );
  }

  factory PriceItem.fromJson(Map<String, dynamic> json) {
    final price = json['price'] as int;
    final prevPrice = json['prevPrice'] as int;
    final normalPrice = json['normalPrice'] as int;
    return PriceItem(
      id: json['id'] as String,
      name: json['name'] as String,
      unit: json['unit'] as String,
      category: json['category'] as String,
      price: price,
      prevPrice: prevPrice,
      normalPrice: normalPrice,
      deviation:
          (json['deviationRate'] as num?)?.toDouble() ??
          deviationRate(price, normalPrice),
      verdict:
          _verdictFromString(json['verdict'] as String?) ??
          judgeVerdict(price, normalPrice),
      movement:
          _movementFromString(json['movement'] as String?) ??
          judgeMovement(price, prevPrice),
    );
  }

  static Verdict? _verdictFromString(String? value) => switch (value) {
    'cheap' => Verdict.cheap,
    'normal' => Verdict.normal,
    'pricey' => Verdict.pricey,
    _ => null,
  };

  static Movement? _movementFromString(String? value) => switch (value) {
    'up' => Movement.up,
    'down' => Movement.down,
    'flat' => Movement.flat,
    _ => null,
  };
}

/// 우리 동네 매장 실판매가 한 건 (한국소비자원 참가격).
class LocalPrice {
  const LocalPrice({
    required this.store,
    required this.product,
    required this.price,
    required this.surveyDate,
  });

  final String store;
  final String product;
  final int price;

  /// YYYY-MM-DD (참가격 조사일 — 월간 파일이라 수 주 지연 가능)
  final String surveyDate;

  factory LocalPrice.fromJson(Map<String, dynamic> json) => LocalPrice(
    store: json['store'] as String,
    product: json['product'] as String,
    price: json['price'] as int,
    surveyDate: json['surveyDate'] as String,
  );
}

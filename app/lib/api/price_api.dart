import 'dart:convert';

import 'package:http/http.dart' as http;

import 'package:mulga/data/sample_items.dart';
import 'package:mulga/models/item_history.dart';
import 'package:mulga/models/price_item.dart';

/// 데이터 출처. UI에서 샘플 데이터임을 표시하는 데 사용한다.
enum PriceSource { server, sample }

class PriceFeed {
  const PriceFeed({required this.items, required this.source, this.asOf});

  final List<PriceItem> items;
  final PriceSource source;

  /// YYYY-MM-DD (서버 응답 meta.asOf). 폴백일 때는 null.
  final String? asOf;
}

class PriceApi {
  PriceApi({this.baseUrl = defaultBaseUrl, http.Client? client})
    : _client = client ?? http.Client();

  /// 빌드 시 --dart-define=API_BASE_URL=https://... 로 재정의 (배포용)
  static const String defaultBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );
  // 터널 경유 지연을 감안한 여유값. 서버는 캐시를 상시 워밍하므로 보통 <1초
  static const Duration _timeout = Duration(seconds: 6);

  final String baseUrl;
  final http.Client _client;

  /// 서버에서 품목 목록을 가져온다. 실패하면 번들 샘플로 폴백한다.
  Future<PriceFeed> fetchItems() async {
    try {
      final response = await _client
          .get(Uri.parse('$baseUrl/api/items'))
          .timeout(_timeout);
      if (response.statusCode != 200) {
        throw http.ClientException('HTTP ${response.statusCode}');
      }
      final body = jsonDecode(utf8.decode(response.bodyBytes));
      if (body is! Map<String, dynamic> || body['success'] != true) {
        throw const FormatException('예상하지 못한 응답 형식');
      }
      final data = body['data'] as List<dynamic>;
      final meta = body['meta'] as Map<String, dynamic>?;
      return PriceFeed(
        items: data
            .map((raw) => PriceItem.fromJson(raw as Map<String, dynamic>))
            .toList(growable: false),
        source: PriceSource.server,
        asOf: meta?['asOf'] as String?,
      );
    } catch (_) {
      // 서버 미기동/네트워크 오류 시 번들 샘플로 폴백.
      // UI가 source로 구분해 "예시 데이터" 배너를 띄우므로 조용한 실패가 아니다.
      return PriceFeed(items: sampleItems, source: PriceSource.sample);
    }
  }

  /// 품목 가격 이력 조회. 실패하면 null (상세 화면이 안내 문구 표시).
  Future<ItemHistory?> fetchHistory(String itemId, {int days = 400}) async {
    try {
      final response = await _client
          .get(Uri.parse('$baseUrl/api/items/$itemId/history?days=$days'))
          .timeout(_timeout);
      if (response.statusCode != 200) return null;
      final body = jsonDecode(utf8.decode(response.bodyBytes));
      if (body is! Map<String, dynamic> || body['success'] != true) {
        return null;
      }
      return ItemHistory.fromJson(body['data'] as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }
}

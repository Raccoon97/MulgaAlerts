import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mulga/api/price_api.dart';
import 'package:mulga/data/sample_items.dart';
import 'package:mulga/screens/home_screen.dart';
import 'package:mulga/theme.dart';

Widget _buildApp() {
  return MaterialApp(
    theme: buildTheme(Brightness.light),
    home: HomeScreen(
      // 네트워크 없이 샘플 데이터를 주입
      loader: () async =>
          PriceFeed(items: sampleItems, source: PriceSource.sample),
    ),
  );
}

void main() {
  testWidgets('홈 대시보드가 요약과 품목 카드를 표시한다', (tester) async {
    await tester.pumpWidget(_buildApp());
    await tester.pumpAndSettle();

    expect(find.textContaining('물가를알려줘'), findsOneWidget);
    expect(find.textContaining('개 품목 요약'), findsOneWidget);
    // 즐겨찾기(계란, 삼겹살)가 상단 고정으로 노출된다
    expect(find.textContaining('계란'), findsWidgets);
  });

  testWidgets('카테고리 탭 선택 시 해당 품목만 남는다', (tester) async {
    await tester.pumpWidget(_buildApp());
    await tester.pumpAndSettle();

    await tester.tap(find.text('수산'));
    await tester.pumpAndSettle();

    expect(find.textContaining('수산 2개 품목 요약'), findsOneWidget);
    expect(find.textContaining('고등어'), findsWidgets);
  });

  testWidgets('판정 필터 칩 탭 시 저렴 품목만 남는다', (tester) async {
    await tester.pumpWidget(_buildApp());
    await tester.pumpAndSettle();

    await tester.tap(find.textContaining('지금 사면 좋은 품목'));
    await tester.pumpAndSettle();

    // 샘플 데이터에서 저렴 판정은 4건 (양파·감자·바나나·계란)
    expect(find.text('저렴'), findsNWidgets(4));
    expect(find.text('비쌈'), findsNothing);
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mulga/api/price_api.dart';
import 'package:mulga/data/sample_items.dart';
import 'package:mulga/models/item_history.dart';
import 'package:mulga/models/local_price.dart';
import 'package:mulga/screens/home_screen.dart';
import 'package:mulga/screens/item_detail_screen.dart';
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

    // 저렴 품목만 남는다 (화면에 보이는 카드 수는 뷰포트에 따라 다르므로
    // 다른 판정 배지가 없는 것으로 검증)
    expect(find.text('저렴'), findsWidgets);
    expect(find.text('비쌈'), findsNothing);
    expect(find.text('보통'), findsNothing);
  });

  testWidgets('별칭으로 검색하면 해당 품목만 남는다 (달걀→계란)', (tester) async {
    await tester.pumpWidget(_buildApp());
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), '달걀');
    await tester.pumpAndSettle();

    expect(find.textContaining('계란'), findsWidgets);
    expect(find.textContaining('배추'), findsNothing);
    expect(find.text('저렴'), findsOneWidget); // 계란 카드 1장만
  });

  testWidgets('검색 결과가 없으면 안내 문구를 표시한다', (tester) async {
    await tester.pumpWidget(_buildApp());
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), '아보카도');
    await tester.pumpAndSettle();

    expect(find.textContaining('맞는 품목이 없어요'), findsOneWidget);

    // 지우기 버튼으로 초기화하면 전체 목록이 돌아온다
    await tester.tap(find.byTooltip('지우기'));
    await tester.pumpAndSettle();
    expect(find.textContaining('맞는 품목이 없어요'), findsNothing);
    expect(find.textContaining('계란'), findsWidgets);
  });

  testWidgets('홈 카드를 탭하면 상세 화면으로 이동한다', (tester) async {
    await tester.pumpWidget(_buildApp());
    await tester.pumpAndSettle();

    // 즐겨찾기로 상단 고정된 계란 카드를 탭
    await tester.tap(find.textContaining('계란').first);
    await tester.pumpAndSettle();

    expect(find.byType(ItemDetailScreen), findsOneWidget);
    expect(find.text('시점별 비교'), findsOneWidget);
  });

  testWidgets('상세 화면이 차트와 시점 비교를 표시한다', (tester) async {
    final egg = sampleItems.firstWhere((it) => it.id == 'egg');
    await tester.pumpWidget(
      MaterialApp(
        theme: buildTheme(Brightness.light),
        home: ItemDetailScreen(
          item: egg,
          historyLoader: () async => ItemHistory(
            unit: '30구',
            normalPrice: 6830,
            history: const [HistoryPoint(date: '2026-07-17', price: 7345)],
            milestones: const [
              Milestone(label: '당일', daysAgo: 0, price: 7345),
              Milestone(label: '1일전', daysAgo: 1, price: 7373),
              Milestone(label: '1주일전', daysAgo: 7, price: 7379),
              Milestone(label: '1개월전', daysAgo: 30, price: 7383),
              Milestone(label: '1년전', daysAgo: 365, price: 6873),
            ],
            milestonesAsOf: '2026-07-17',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('계란'), findsOneWidget);
    expect(find.text('시점별 비교'), findsOneWidget);
    expect(find.text('1개월전'), findsWidgets);
    expect(find.text('평년'), findsOneWidget);

    // 기간 탭 전환이 동작한다
    await tester.tap(find.text('1년'));
    await tester.pumpAndSettle();
    expect(find.text('1년전'), findsWidgets);
  });

  testWidgets('상세 화면에 동네 매장 실판매가 섹션이 표시된다', (tester) async {
    final egg = sampleItems.firstWhere((it) => it.id == 'egg');
    await tester.pumpWidget(
      MaterialApp(
        theme: buildTheme(Brightness.light),
        home: ItemDetailScreen(
          item: egg,
          cityName: '안산',
          historyLoader: () async => null,
          localLoader: () async => const [
            LocalPrice(
              store: '롯데슈퍼안산점',
              product: 'CJ 1등급 깨끗한 계란(15개)',
              price: 7990,
              surveyDate: '2026-06-26',
            ),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();

    // 섹션은 화면 하단에 있어 스크롤해야 렌더된다
    await tester.dragUntilVisible(
      find.text('안산 매장 실판매가'),
      find.byType(ListView),
      const Offset(0, -200),
    );
    expect(find.text('안산 매장 실판매가'), findsOneWidget);
    expect(find.text('롯데슈퍼안산점'), findsOneWidget);
    expect(find.text('7,990원'), findsOneWidget);
    expect(find.textContaining('2026-06-26 조사'), findsOneWidget);
  });

  testWidgets('이력이 없으면 안내 문구를 표시한다', (tester) async {
    final egg = sampleItems.firstWhere((it) => it.id == 'egg');
    await tester.pumpWidget(
      MaterialApp(
        theme: buildTheme(Brightness.light),
        home: ItemDetailScreen(item: egg, historyLoader: () async => null),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('가격 데이터가 아직 부족해요'), findsOneWidget);
  });
}

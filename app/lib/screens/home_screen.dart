import 'package:flutter/material.dart';

import 'package:mulga/api/price_api.dart';
import 'package:mulga/domain/verdict.dart';
import 'package:mulga/models/price_item.dart';
import 'package:mulga/theme.dart';
import 'package:mulga/widgets/item_card.dart';

const List<String> _categories = ['전체', '채소', '과일', '축산', '수산', '곡물'];

enum SortMode {
  riseDesc('많이 오른 순'),
  riseAsc('많이 내린 순'),
  devAsc('저렴한 순'),
  name('가나다순');

  const SortMode(this.label);
  final String label;
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, this.loader});

  /// 테스트에서 네트워크 없이 데이터를 주입하기 위한 훅
  final Future<PriceFeed> Function()? loader;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  PriceFeed? _feed;
  String _category = '전체';
  SortMode _sort = SortMode.riseDesc;
  Verdict? _verdictFilter;
  final Set<String> _favorites = {'egg', 'pork-belly'};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final loader = widget.loader ?? PriceApi().fetchItems;
    final feed = await loader();
    if (mounted) setState(() => _feed = feed);
  }

  List<PriceItem> get _scopedItems {
    final items = _feed?.items ?? const [];
    return items
        .where((it) => _category == '전체' || it.category == _category)
        .toList(growable: false);
  }

  List<PriceItem> get _visibleItems {
    var items = _scopedItems;
    if (_verdictFilter != null) {
      items = items.where((it) => it.verdict == _verdictFilter).toList();
    }
    double changeRate(PriceItem it) => (it.price - it.prevPrice) / it.prevPrice;
    final sorted = [...items]
      ..sort(switch (_sort) {
        SortMode.riseDesc => (a, b) => changeRate(b).compareTo(changeRate(a)),
        SortMode.riseAsc => (a, b) => changeRate(a).compareTo(changeRate(b)),
        SortMode.devAsc => (a, b) => a.deviation.compareTo(b.deviation),
        SortMode.name => (a, b) => a.name.compareTo(b.name),
      });
    sorted.sort(
      (a, b) => (_favorites.contains(b.id) ? 1 : 0).compareTo(
        _favorites.contains(a.id) ? 1 : 0,
      ),
    );
    return sorted;
  }

  @override
  Widget build(BuildContext context) {
    final feed = _feed;
    return Scaffold(
      body: SafeArea(
        child: feed == null
            ? const Center(child: CircularProgressIndicator())
            : Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 1080),
                  child: CustomScrollView(
                    slivers: [
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                        sliver: SliverToBoxAdapter(child: _buildHeader(feed)),
                      ),
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                        sliver: SliverToBoxAdapter(child: _buildSummary()),
                      ),
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                        sliver: SliverToBoxAdapter(child: _buildControls()),
                      ),
                      SliverPadding(
                        padding: const EdgeInsets.all(20),
                        sliver: SliverGrid(
                          gridDelegate:
                              const SliverGridDelegateWithMaxCrossAxisExtent(
                                maxCrossAxisExtent: 270,
                                mainAxisExtent: 210,
                                crossAxisSpacing: 14,
                                mainAxisSpacing: 14,
                              ),
                          delegate: SliverChildBuilderDelegate((
                            context,
                            index,
                          ) {
                            final item = _visibleItems[index];
                            return ItemCard(
                              item: item,
                              isFavorite: _favorites.contains(item.id),
                              onToggleFavorite: () => setState(() {
                                if (!_favorites.add(item.id)) {
                                  _favorites.remove(item.id);
                                }
                              }),
                            );
                          }, childCount: _visibleItems.length),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
      ),
    );
  }

  Widget _buildHeader(PriceFeed feed) {
    final c = context.mulga;
    final dateLabel = feed.asOf ?? '오늘';
    final sourceLabel = feed.source == PriceSource.sample
        ? ' · 예시 데이터 (서버 미연결)'
        : ' · 전국 평균 소매가';
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: '물가를알려줘',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                        color: c.ink,
                      ),
                    ),
                    TextSpan(
                      text: '.',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: c.accent,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '$dateLabel 기준$sourceLabel',
                style: TextStyle(fontSize: 13, color: c.muted),
              ),
            ],
          ),
        ),
        IconButton(
          tooltip: '새로고침',
          onPressed: () {
            setState(() => _feed = null);
            _load();
          },
          icon: Icon(Icons.refresh_rounded, color: c.muted),
        ),
      ],
    );
  }

  Widget _buildSummary() {
    final c = context.mulga;
    final scoped = _scopedItems;
    final rise = scoped.where((it) => it.movement == Movement.up).length;
    final fall = scoped.where((it) => it.movement == Movement.down).length;
    final flat = scoped.length - rise - fall;
    final cheap = scoped.where((it) => it.verdict == Verdict.cheap).length;
    final pricey = scoped.where((it) => it.verdict == Verdict.pricey).length;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '오늘 ${_category == '전체' ? '' : '$_category '}${scoped.length}개 품목 요약',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: c.ink,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _stat('▲ 상승', rise, c.up),
              _stat('▼ 하락', fall, c.down),
              _stat('— 보합', flat, c.ink),
              _verdictChip(
                '● 지금 사면 좋은 품목 $cheap개',
                Verdict.cheap,
                fg: c.cheap,
                bg: c.cheapBg,
              ),
              _verdictChip(
                '● 기다리면 좋은 품목 $pricey개',
                Verdict.pricey,
                fg: c.pricey,
                bg: c.priceyBg,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _stat(String label, int count, Color emphasis) {
    final c = context.mulga;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: c.bg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: c.line),
      ),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: '$label ',
              style: TextStyle(fontSize: 13, color: c.muted),
            ),
            TextSpan(
              text: '$count',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: emphasis,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _verdictChip(
    String label,
    Verdict verdict, {
    required Color fg,
    required Color bg,
  }) {
    final selected = _verdictFilter == verdict;
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: () => setState(() => _verdictFilter = selected ? null : verdict),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? fg : Colors.transparent),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
            color: fg,
          ),
        ),
      ),
    );
  }

  Widget _buildControls() {
    final c = context.mulga;
    return Row(
      children: [
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final category in _categories) ...[
                  _categoryTab(category),
                  const SizedBox(width: 6),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(width: 10),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: c.line),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<SortMode>(
              value: _sort,
              borderRadius: BorderRadius.circular(10),
              // 명시적 TextStyle은 테마의 fontFamily를 상속하지 않으므로 직접 지정
              style: TextStyle(
                fontSize: 13,
                color: c.ink,
                fontFamily: 'Pretendard',
              ),
              items: [
                for (final mode in SortMode.values)
                  DropdownMenuItem(value: mode, child: Text(mode.label)),
              ],
              onChanged: (mode) =>
                  setState(() => _sort = mode ?? SortMode.riseDesc),
            ),
          ),
        ),
      ],
    );
  }

  Widget _categoryTab(String category) {
    final c = context.mulga;
    final selected = _category == category;
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: () => setState(() => _category = category),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? c.accent : c.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? c.accent : c.line),
        ),
        child: Text(
          category,
          style: TextStyle(
            fontSize: 13.5,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? c.accentInk : c.muted,
          ),
        ),
      ),
    );
  }
}

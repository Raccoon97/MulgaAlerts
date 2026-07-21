import 'package:flutter/material.dart';

import 'package:mulga/api/price_api.dart';
import 'package:mulga/data/regions.dart';
import 'package:mulga/domain/search.dart';
import 'package:mulga/domain/verdict.dart';
import 'package:mulga/models/price_item.dart';
import 'package:mulga/screens/item_detail_screen.dart';
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
  City _city = cityByName('서울');
  SortMode _sort = SortMode.riseDesc;
  Verdict? _verdictFilter;
  String _query = '';
  final TextEditingController _searchController = TextEditingController();
  final Set<String> _favorites = {'egg', 'pork-belly'};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final loader =
        widget.loader ?? () => PriceApi().fetchItems(region: _city.regionCode);
    final feed = await loader();
    if (mounted) setState(() => _feed = feed);
  }

  void _changeCity(City city) {
    final regionChanged = city.regionCode != _city.regionCode;
    setState(() {
      _city = city;
      if (regionChanged) _feed = null; // 로딩 표시
    });
    if (regionChanged) _load();
  }

  Future<void> _showCityPicker() async {
    final selected = await showModalBottomSheet<City>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CityPickerSheet(current: _city),
    );
    if (selected != null) _changeCity(selected);
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
    if (_query.trim().isNotEmpty) {
      items = items
          .where(
            (it) =>
                matchesQuery(itemId: it.id, itemName: it.name, query: _query),
          )
          .toList();
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
                        sliver: SliverToBoxAdapter(child: _buildSearchField()),
                      ),
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
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
                            return GestureDetector(
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => ItemDetailScreen(
                                    item: item,
                                    cityName: _city.name,
                                  ),
                                ),
                              ),
                              child: ItemCard(
                                item: item,
                                isFavorite: _favorites.contains(item.id),
                                onToggleFavorite: () => setState(() {
                                  if (!_favorites.add(item.id)) {
                                    _favorites.remove(item.id);
                                  }
                                }),
                              ),
                            );
                          }, childCount: _visibleItems.length),
                        ),
                      ),
                      if (_visibleItems.isEmpty)
                        SliverPadding(
                          padding: const EdgeInsets.symmetric(vertical: 48),
                          sliver: SliverToBoxAdapter(child: _buildEmptyState()),
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
    // 조사 도시가 아니면 어느 도시 데이터 기준인지 투명하게 표기
    final sourceLabel = feed.source == PriceSource.sample
        ? ' · 예시 데이터 (서버 미연결)'
        : _city.isSurveyed
        ? ' · ${_city.name} 평균 소매가 (KAMIS)'
        : ' · ${_city.name} · 인근 ${_city.surveyRegion.name} 조사가 기준';
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
        // 도시 선택: 전국 시 단위, 미조사 도시는 인근 조사 도시 데이터 기준
        InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: _showCityPicker,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              color: c.surface,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: c.line),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.place_rounded, size: 15, color: c.accent),
                const SizedBox(width: 4),
                Text(
                  _city.name,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: c.ink,
                  ),
                ),
                Icon(Icons.expand_more_rounded, size: 16, color: c.muted),
              ],
            ),
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
            ],
          ),
          const SizedBox(height: 8),
          // 판정 칩 2개는 화면 폭과 무관하게 항상 한 줄 유지
          Row(
            children: [
              Expanded(
                child: _verdictChip(
                  '● 지금 사면 좋은 품목 $cheap개',
                  Verdict.cheap,
                  fg: c.cheap,
                  bg: c.cheapBg,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _verdictChip(
                  '● 기다리면 좋은 품목 $pricey개',
                  Verdict.pricey,
                  fg: c.pricey,
                  bg: c.priceyBg,
                ),
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
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? fg : Colors.transparent),
        ),
        // 좁은 화면에서는 글자를 줄여서라도 줄바꿈 없이 한 줄 유지
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            label,
            maxLines: 1,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: fg,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSearchField() {
    final c = context.mulga;
    return TextField(
      controller: _searchController,
      onChanged: (value) => setState(() => _query = value),
      style: TextStyle(fontSize: 14, color: c.ink, fontFamily: 'Pretendard'),
      decoration: InputDecoration(
        hintText: '품목 검색 (예: 달걀, 호박, 삼겹살)',
        hintStyle: TextStyle(fontSize: 14, color: c.muted),
        prefixIcon: Icon(Icons.search_rounded, color: c.muted, size: 20),
        suffixIcon: _query.isEmpty
            ? null
            : IconButton(
                tooltip: '지우기',
                icon: Icon(Icons.close_rounded, color: c.muted, size: 18),
                onPressed: () {
                  _searchController.clear();
                  setState(() => _query = '');
                },
              ),
        filled: true,
        fillColor: c.surface,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(vertical: 12),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: c.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: c.accent, width: 1.5),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    final c = context.mulga;
    final query = _query.trim();
    return Column(
      children: [
        Icon(Icons.search_off_rounded, size: 36, color: c.muted),
        const SizedBox(height: 10),
        Text(
          query.isEmpty ? '조건에 맞는 품목이 없어요' : "'$query'에 맞는 품목이 없어요",
          style: TextStyle(fontSize: 14, color: c.muted),
        ),
        const SizedBox(height: 4),
        Text(
          '검색어나 필터를 바꿔보세요',
          style: TextStyle(fontSize: 12.5, color: c.muted),
        ),
      ],
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

/// 전국 도시 선택 시트 — 검색 + 조사 도시/인근 기준 구분 표시
class _CityPickerSheet extends StatefulWidget {
  const _CityPickerSheet({required this.current});

  final City current;

  @override
  State<_CityPickerSheet> createState() => _CityPickerSheetState();
}

class _CityPickerSheetState extends State<_CityPickerSheet> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final c = context.mulga;
    final query = _query.trim();
    final filtered = cities
        .where((city) => query.isEmpty || city.name.contains(query))
        .toList(growable: false);
    // 조사 도시를 먼저, 그 안에서는 정의 순서 유지
    final surveyed = filtered.where((city) => city.isSurveyed).toList();
    final nearby = filtered.where((city) => !city.isSurveyed).toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.72,
      decoration: BoxDecoration(
        color: c.bg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: c.line,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            '지역 선택',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: c.ink,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '조사 도시가 아니면 가장 가까운 KAMIS 조사 도시 가격을 보여드려요',
            style: TextStyle(fontSize: 12, color: c.muted),
          ),
          const SizedBox(height: 12),
          TextField(
            autofocus: false,
            onChanged: (value) => setState(() => _query = value),
            style: TextStyle(
              fontSize: 14,
              color: c.ink,
              fontFamily: 'Pretendard',
            ),
            decoration: InputDecoration(
              hintText: '도시 검색 (예: 안산, 성남)',
              hintStyle: TextStyle(fontSize: 14, color: c.muted),
              prefixIcon: Icon(Icons.search_rounded, color: c.muted, size: 20),
              filled: true,
              fillColor: c.surface,
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(vertical: 12),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: c.line),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: c.accent, width: 1.5),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: (surveyed.isEmpty && nearby.isEmpty)
                ? Center(
                    child: Text(
                      "'$query'에 맞는 도시가 없어요",
                      style: TextStyle(fontSize: 13, color: c.muted),
                    ),
                  )
                : ListView(
                    children: [
                      if (surveyed.isNotEmpty) ...[
                        _sectionLabel('KAMIS 조사 도시'),
                        for (final city in surveyed) _cityTile(city),
                      ],
                      if (nearby.isNotEmpty) ...[
                        _sectionLabel('그 외 도시 (인근 조사가 기준)'),
                        for (final city in nearby) _cityTile(city),
                      ],
                      const SizedBox(height: 24),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _sectionLabel(String label) {
    final c = context.mulga;
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 14, 4, 6),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
          color: c.muted,
          letterSpacing: 0.3,
        ),
      ),
    );
  }

  Widget _cityTile(City city) {
    final c = context.mulga;
    final selected = city.name == widget.current.name;
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: () => Navigator.of(context).pop(city),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          color: selected ? c.surface2 : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                city.name,
                style: TextStyle(
                  fontSize: 14.5,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: c.ink,
                ),
              ),
            ),
            if (!city.isSurveyed)
              Text(
                '${city.surveyRegion.name} 기준',
                style: TextStyle(fontSize: 12, color: c.muted),
              ),
            if (selected) ...[
              const SizedBox(width: 8),
              Icon(Icons.check_rounded, size: 18, color: c.accent),
            ],
          ],
        ),
      ),
    );
  }
}

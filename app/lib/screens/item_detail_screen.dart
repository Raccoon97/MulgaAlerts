import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import 'package:mulga/api/price_api.dart';
import 'package:mulga/domain/verdict.dart';
import 'package:mulga/models/item_history.dart';
import 'package:mulga/models/price_item.dart';
import 'package:mulga/theme.dart';
import 'package:mulga/widgets/item_card.dart' show formatWon;

enum ChartPeriod {
  week(7, '1주'),
  month(30, '1개월'),
  quarter(90, '3개월'),
  year(365, '1년');

  const ChartPeriod(this.days, this.label);
  final int days;
  final String label;
}

class ItemDetailScreen extends StatefulWidget {
  const ItemDetailScreen({super.key, required this.item, this.historyLoader});

  final PriceItem item;

  /// 테스트에서 네트워크 없이 이력을 주입하기 위한 훅
  final Future<ItemHistory?> Function()? historyLoader;

  @override
  State<ItemDetailScreen> createState() => _ItemDetailScreenState();
}

class _ItemDetailScreenState extends State<ItemDetailScreen> {
  ItemHistory? _history;
  bool _loading = true;
  ChartPeriod _period = ChartPeriod.month;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final loader =
        widget.historyLoader ?? () => PriceApi().fetchHistory(widget.item.id);
    final history = await loader();
    if (mounted) {
      setState(() {
        _history = history;
        _loading = false;
      });
    }
  }

  /// 일일 이력 + 시점 포인트를 (daysAgo → price)로 병합. 일일 이력이 우선.
  Map<int, int> get _mergedPoints {
    final history = _history;
    if (history == null) return {};
    final points = <int, int>{};
    for (final m in history.milestones) {
      points[m.daysAgo] = m.price;
    }
    final today = DateTime.now();
    for (final h in history.history) {
      final date = DateTime.tryParse(h.date);
      if (date == null) continue;
      final daysAgo = today.difference(date).inDays;
      if (daysAgo >= 0) points[daysAgo] = h.price;
    }
    return points;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.mulga;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 720),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
              children: [
                _buildTopBar(),
                const SizedBox(height: 8),
                _buildHeader(),
                const SizedBox(height: 20),
                _buildPeriodTabs(),
                const SizedBox(height: 12),
                _buildChartCard(),
                const SizedBox(height: 20),
                _buildComparisonCard(),
                const SizedBox(height: 16),
                Text(
                  '자료: KAMIS 농수산물유통정보 · 서울 평균 소매가'
                  '${_history?.milestonesAsOf != null ? ' · 기준일 ${_history!.milestonesAsOf}' : ''}',
                  style: TextStyle(fontSize: 11.5, color: c.muted),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTopBar() {
    final c = context.mulga;
    return Row(
      children: [
        IconButton(
          onPressed: () => Navigator.of(context).pop(),
          icon: Icon(Icons.arrow_back_rounded, color: c.ink),
          tooltip: '뒤로',
        ),
      ],
    );
  }

  Widget _buildHeader() {
    final c = context.mulga;
    final item = widget.item;
    final (badgeLabel, badgeFg, badgeBg) = switch (item.verdict) {
      Verdict.cheap => ('저렴', c.cheap, c.cheapBg),
      Verdict.normal => ('보통', c.ok, c.okBg),
      Verdict.pricey => ('비쌈', c.pricey, c.priceyBg),
    };
    final pct = (item.deviation.abs() * 100).round();
    final hint = switch (item.verdict) {
      Verdict.cheap => '평시보다 $pct% 저렴 — 사기 좋은 시기예요',
      Verdict.pricey => '평시보다 $pct% 비쌈 — 기다려 볼 만해요',
      Verdict.normal => '평시 수준이에요',
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${item.name}  ${item.unit}',
          style: TextStyle(fontSize: 16, color: c.muted),
        ),
        const SizedBox(height: 4),
        Text(
          formatWon(item.price),
          style: TextStyle(
            fontSize: 34,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.8,
            color: c.ink,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: badgeBg,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                badgeLabel,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: badgeFg,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(hint, style: TextStyle(fontSize: 13, color: c.muted)),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildPeriodTabs() {
    final c = context.mulga;
    return Row(
      children: [
        for (final period in ChartPeriod.values) ...[
          InkWell(
            borderRadius: BorderRadius.circular(999),
            onTap: () => setState(() => _period = period),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: _period == period ? c.accent : c.surface,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: _period == period ? c.accent : c.line,
                ),
              ),
              child: Text(
                period.label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: _period == period
                      ? FontWeight.w700
                      : FontWeight.w500,
                  color: _period == period ? c.accentInk : c.muted,
                ),
              ),
            ),
          ),
          const SizedBox(width: 6),
        ],
      ],
    );
  }

  Widget _buildChartCard() {
    final c = context.mulga;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 20, 20, 12),
      height: 260,
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.line),
      ),
      child: _buildChartBody(),
    );
  }

  Widget _buildChartBody() {
    final c = context.mulga;
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    final normalPrice = _history?.normalPrice ?? widget.item.normalPrice;
    final points =
        _mergedPoints.entries.where((e) => e.key <= _period.days).toList()
          ..sort((a, b) => b.key.compareTo(a.key));

    if (points.length < 2) {
      return Center(
        child: Text(
          '이 기간의 가격 데이터가 아직 부족해요\n매일 자동 수집되며 점점 촘촘해집니다',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 13, color: c.muted, height: 1.6),
        ),
      );
    }

    final spots = [
      for (final e in points) FlSpot(-e.key.toDouble(), e.value.toDouble()),
    ];
    final labelByX = {
      for (final m in _history?.milestones ?? <Milestone>[])
        if (m.daysAgo <= _period.days)
          -m.daysAgo.toDouble(): m.daysAgo == 0 ? '오늘' : m.label,
    };
    final prices = [
      ...points.map((e) => e.value),
      (normalPrice * 0.9).round(),
      (normalPrice * 1.1).round(),
    ];
    final minPrice = prices.reduce((a, b) => a < b ? a : b);
    final maxPrice = prices.reduce((a, b) => a > b ? a : b);
    final padding = (maxPrice - minPrice) * 0.15 + 1;

    return LineChart(
      LineChartData(
        minY: minPrice - padding,
        maxY: maxPrice + padding,
        rangeAnnotations: RangeAnnotations(
          horizontalRangeAnnotations: [
            // 평시 밴드 (평년가 ±10%) — 이 안이면 "보통" 구간
            HorizontalRangeAnnotation(
              y1: normalPrice * 0.9,
              y2: normalPrice * 1.1,
              color: c.okBg.withValues(alpha: 0.55),
            ),
          ],
        ),
        extraLinesData: ExtraLinesData(
          horizontalLines: [
            HorizontalLine(
              y: normalPrice.toDouble(),
              color: c.muted.withValues(alpha: 0.6),
              strokeWidth: 1,
              dashArray: const [6, 4],
            ),
          ],
        ),
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          getDrawingHorizontalLine: (value) =>
              FlLine(color: c.line.withValues(alpha: 0.5), strokeWidth: 1),
        ),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(),
          rightTitles: const AxisTitles(),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 52,
              getTitlesWidget: (value, meta) {
                // 축 경계값 라벨은 그리드 라벨과 겹치므로 숨긴다
                if (value == meta.min || value == meta.max) {
                  return const SizedBox.shrink();
                }
                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: Text(
                    _compactWon(value),
                    style: TextStyle(fontSize: 10.5, color: c.muted),
                    textAlign: TextAlign.right,
                  ),
                );
              },
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 26,
              getTitlesWidget: (value, meta) {
                final label = labelByX[value];
                if (label == null) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    label,
                    style: TextStyle(fontSize: 10.5, color: c.muted),
                  ),
                );
              },
            ),
          ),
        ),
        lineTouchData: LineTouchData(
          touchTooltipData: LineTouchTooltipData(
            getTooltipItems: (touched) => [
              for (final spot in touched)
                LineTooltipItem(
                  formatWon(spot.y.round()),
                  TextStyle(
                    color: c.ink,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
            ],
          ),
        ),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            color: c.accent,
            barWidth: 2.5,
            // 시점 간격이 불균등(1일·1주·1개월·1년)해서 곡선 보간 시
            // 촘촘한 구간에서 고리 모양이 생긴다 → 직선 연결
            isCurved: false,
            dotData: FlDotData(
              show: true,
              getDotPainter: (spot, percent, bar, index) => FlDotCirclePainter(
                radius: 3.5,
                color: c.accent,
                strokeWidth: 2,
                strokeColor: c.surface,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildComparisonCard() {
    final c = context.mulga;
    final history = _history;
    final current = widget.item.price;
    final normalPrice = history?.normalPrice ?? widget.item.normalPrice;
    final rows = [...?history?.milestones.where((m) => m.daysAgo > 0)];
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
            '시점별 비교',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: c.ink,
            ),
          ),
          const SizedBox(height: 10),
          if (rows.isEmpty && !_loading)
            Text(
              '비교할 시점 데이터가 없어요',
              style: TextStyle(fontSize: 13, color: c.muted),
            ),
          for (final m in rows) _comparisonRow(m.label, m.price, current),
          _comparisonRow('평년', normalPrice, current, isBaseline: true),
        ],
      ),
    );
  }

  Widget _comparisonRow(
    String label,
    int past,
    int current, {
    bool isBaseline = false,
  }) {
    final c = context.mulga;
    final rate = (current - past) / past;
    final pct = (rate.abs() * 100).toStringAsFixed(1);
    final (deltaText, deltaColor) = rate.abs() < 0.001
        ? ('같음', c.muted)
        : rate > 0
        ? ('▲ +$pct%', c.up)
        : ('▼ −$pct%', c.down);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(
            width: 76,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                color: c.muted,
                fontWeight: isBaseline ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
          Expanded(
            child: Text(
              formatWon(past),
              style: TextStyle(
                fontSize: 14,
                color: c.ink,
                fontWeight: FontWeight.w600,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
          Text(
            deltaText,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: deltaColor,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }

  static String _compactWon(double value) {
    if (value >= 10000) {
      final man = value / 10000;
      return man >= 10 ? '${man.round()}만' : '${man.toStringAsFixed(1)}만';
    }
    return value.round().toString();
  }
}

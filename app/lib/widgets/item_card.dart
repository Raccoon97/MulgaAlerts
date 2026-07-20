import 'package:flutter/material.dart';

import 'package:mulga/domain/verdict.dart';
import 'package:mulga/models/price_item.dart';
import 'package:mulga/theme.dart';

// 품목 아이콘은 emoji 대신 품목명 첫 글자를 쓴다.
// 웹(CanvasKit)에서 emoji 폰트가 보장되지 않아 어디서나 렌더되는 방식을 택했다.

String formatWon(int amount) {
  final digits = amount.toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(',');
    buffer.write(digits[i]);
  }
  return '$buffer원';
}

class ItemCard extends StatelessWidget {
  const ItemCard({
    super.key,
    required this.item,
    required this.isFavorite,
    required this.onToggleFavorite,
  });

  final PriceItem item;
  final bool isFavorite;
  final VoidCallback onToggleFavorite;

  @override
  Widget build(BuildContext context) {
    final c = context.mulga;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.line),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: c.surface2,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  item.name.characters.first,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: c.accent,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: item.name,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: c.ink,
                        ),
                      ),
                      TextSpan(
                        text: '  ${item.unit}',
                        style: TextStyle(fontSize: 12, color: c.muted),
                      ),
                    ],
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              IconButton(
                onPressed: onToggleFavorite,
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                tooltip: isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가',
                icon: Icon(
                  isFavorite ? Icons.star_rounded : Icons.star_outline_rounded,
                  size: 22,
                  color: isFavorite ? c.star : c.line,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    formatWon(item.price),
                    style: TextStyle(
                      fontSize: 21,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.4,
                      color: c.ink,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: _MovementLabel(movement: item.movement, item: item),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            '평시 ${formatWon(item.normalPrice)}',
            style: TextStyle(fontSize: 12.5, color: c.muted),
          ),
          const SizedBox(height: 10),
          _DeviationGauge(deviation: item.deviation, verdict: item.verdict),
          const SizedBox(height: 10),
          Row(
            children: [
              _VerdictBadge(verdict: item.verdict),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _hintText(item),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 11.5, color: c.muted),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _hintText(PriceItem item) {
    final pct = (item.deviation.abs() * 100).round();
    return switch (item.verdict) {
      Verdict.cheap => '평시보다 $pct% 저렴 — 사기 좋은 시기',
      Verdict.pricey => '평시보다 $pct% 비쌈 — 기다려 볼 만해요',
      Verdict.normal => '평시 수준',
    };
  }
}

class _MovementLabel extends StatelessWidget {
  const _MovementLabel({required this.movement, required this.item});

  final Movement movement;
  final PriceItem item;

  @override
  Widget build(BuildContext context) {
    final c = context.mulga;
    final changeRate = (item.price - item.prevPrice) / item.prevPrice;
    final pct = (changeRate.abs() * 100).toStringAsFixed(1);
    final (label, color) = switch (movement) {
      Movement.up => ('▲ +$pct%', c.up),
      Movement.down => ('▼ −$pct%', c.down),
      Movement.flat => ('— 보합', c.muted),
    };
    return Text(
      label,
      style: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        color: color,
        fontFeatures: const [FontFeature.tabularFigures()],
      ),
    );
  }
}

class _VerdictBadge extends StatelessWidget {
  const _VerdictBadge({required this.verdict});

  final Verdict verdict;

  @override
  Widget build(BuildContext context) {
    final c = context.mulga;
    final (label, fg, bg) = switch (verdict) {
      Verdict.cheap => ('저렴', c.cheap, c.cheapBg),
      Verdict.normal => ('보통', c.ok, c.okBg),
      Verdict.pricey => ('비쌈', c.pricey, c.priceyBg),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(7),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: fg),
      ),
    );
  }
}

/// 평시 밴드 게이지: −30%~+30% 축 위에 오늘 편차 위치를 점으로 표시.
/// 가운데 1/3(±10%)이 정상 밴드.
class _DeviationGauge extends StatelessWidget {
  const _DeviationGauge({required this.deviation, required this.verdict});

  final double deviation;
  final Verdict verdict;

  @override
  Widget build(BuildContext context) {
    final c = context.mulga;
    final position = ((deviation + 0.3) / 0.6).clamp(0.03, 0.97);
    final dotColor = switch (verdict) {
      Verdict.cheap => c.cheap,
      Verdict.normal => c.ok,
      Verdict.pricey => c.pricey,
    };
    return SizedBox(
      height: 12,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth;
          return Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                top: 4,
                left: 0,
                right: 0,
                child: Container(
                  height: 4,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(4),
                    gradient: LinearGradient(
                      colors: [c.cheapBg, c.surface2, c.surface2, c.priceyBg],
                      stops: const [0.0, 0.333, 0.666, 1.0],
                    ),
                  ),
                ),
              ),
              for (final x in [width / 3, width * 2 / 3])
                Positioned(
                  left: x,
                  top: 2,
                  child: Container(width: 1, height: 8, color: c.line),
                ),
              Positioned(
                left: position * width - 6,
                top: 0,
                child: Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: dotColor,
                    border: Border.all(color: c.surface, width: 2),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

import 'package:flutter/material.dart';

/// 디자인 시안(docs/design/홈대시보드-시안.html)의 색 토큰.
/// 등락(up/down)은 국내 관례(상승=빨강, 하락=파랑),
/// 판정(cheap/pricey)은 초록/주홍 배지로 축을 분리한다.
@immutable
class MulgaColors extends ThemeExtension<MulgaColors> {
  const MulgaColors({
    required this.bg,
    required this.surface,
    required this.surface2,
    required this.ink,
    required this.muted,
    required this.line,
    required this.accent,
    required this.accentInk,
    required this.cheap,
    required this.cheapBg,
    required this.pricey,
    required this.priceyBg,
    required this.ok,
    required this.okBg,
    required this.up,
    required this.down,
    required this.star,
  });

  final Color bg;
  final Color surface;
  final Color surface2;
  final Color ink;
  final Color muted;
  final Color line;
  final Color accent;
  final Color accentInk;
  final Color cheap;
  final Color cheapBg;
  final Color pricey;
  final Color priceyBg;
  final Color ok;
  final Color okBg;
  final Color up;
  final Color down;
  final Color star;

  static const light = MulgaColors(
    bg: Color(0xFFF6F7F3),
    surface: Color(0xFFFFFFFF),
    surface2: Color(0xFFEFF2EC),
    ink: Color(0xFF20291F),
    muted: Color(0xFF68766A),
    line: Color(0xFFE2E7DD),
    accent: Color(0xFF1E7A46),
    accentInk: Color(0xFFFFFFFF),
    cheap: Color(0xFF1E7A46),
    cheapBg: Color(0xFFE2F2E8),
    pricey: Color(0xFFC9432F),
    priceyBg: Color(0xFFFAE9E5),
    ok: Color(0xFF5A685C),
    okBg: Color(0xFFECEFE9),
    up: Color(0xFFD6403A),
    down: Color(0xFF2E6FBF),
    star: Color(0xFFE8A93C),
  );

  static const dark = MulgaColors(
    bg: Color(0xFF141A15),
    surface: Color(0xFF1C231D),
    surface2: Color(0xFF232B24),
    ink: Color(0xFFE7EDE6),
    muted: Color(0xFF94A296),
    line: Color(0xFF2B342C),
    accent: Color(0xFF4CC57F),
    accentInk: Color(0xFF10190F),
    cheap: Color(0xFF5ECD8C),
    cheapBg: Color(0xFF1D3326),
    pricey: Color(0xFFF08A76),
    priceyBg: Color(0xFF3A241E),
    ok: Color(0xFFA9B5AA),
    okBg: Color(0xFF262E27),
    up: Color(0xFFF07A72),
    down: Color(0xFF6FA8E8),
    star: Color(0xFFE8A93C),
  );

  @override
  MulgaColors copyWith() => this;

  @override
  MulgaColors lerp(ThemeExtension<MulgaColors>? other, double t) =>
      t < 0.5 ? this : (other as MulgaColors? ?? this);
}

ThemeData buildTheme(Brightness brightness) {
  final colors = brightness == Brightness.dark
      ? MulgaColors.dark
      : MulgaColors.light;
  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    scaffoldBackgroundColor: colors.bg,
    colorScheme: ColorScheme.fromSeed(
      seedColor: colors.accent,
      brightness: brightness,
      surface: colors.bg,
    ),
    fontFamily: 'Pretendard',
    fontFamilyFallback: const ['Apple SD Gothic Neo', 'Malgun Gothic'],
    extensions: [colors],
  );
}

extension MulgaColorsContext on BuildContext {
  MulgaColors get mulga => Theme.of(this).extension<MulgaColors>()!;
}

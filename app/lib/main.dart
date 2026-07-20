import 'package:flutter/material.dart';

import 'package:mulga/screens/home_screen.dart';
import 'package:mulga/theme.dart';

void main() {
  runApp(const MulgaApp());
}

class MulgaApp extends StatelessWidget {
  const MulgaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '물가를알려줘',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      home: const HomeScreen(),
    );
  }
}

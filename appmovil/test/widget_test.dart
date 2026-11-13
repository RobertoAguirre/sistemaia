import 'package:flutter_test/flutter_test.dart';
import 'package:velocimetro/main.dart';

void main() {
  testWidgets('Muestra pantalla del velocímetro', (WidgetTester tester) async {
    await tester.pumpWidget(const VelocimetroApp());

    expect(find.text('Velocímetro'), findsOneWidget);
    expect(find.text('Iniciar GPS'), findsOneWidget);
    expect(find.text('km/h'), findsWidgets);
  });
}

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  runApp(const VelocimetroApp());
}

class VelocimetroApp extends StatelessWidget {
  const VelocimetroApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Velocímetro',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF07140C),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF009A49),
          secondary: Color(0xFF2DBE6C),
          surface: Color(0xFF0F2418),
        ),
        useMaterial3: true,
      ),
      home: const VelocimetroPage(),
    );
  }
}

enum UnidadVelocidad { kmh, mph }

class VelocimetroPage extends StatefulWidget {
  const VelocimetroPage({super.key});

  @override
  State<VelocimetroPage> createState() => _VelocimetroPageState();
}

class _VelocimetroPageState extends State<VelocimetroPage> {
  static const double _maxKmh = 180;

  StreamSubscription<Position>? _posicionSub;
  double _velocidadMs = 0;
  double _maxMs = 0;
  double? _precisionM;
  bool _midiendo = false;
  String? _error;
  UnidadVelocidad _unidad = UnidadVelocidad.kmh;

  double get _factor => _unidad == UnidadVelocidad.kmh ? 3.6 : 2.236936;
  String get _etiquetaUnidad => _unidad == UnidadVelocidad.kmh ? 'km/h' : 'mph';
  double get _velocidad => (_velocidadMs * _factor).clamp(0, 999);
  double get _maxima => (_maxMs * _factor).clamp(0, 999);
  double get _maxEscala =>
      _unidad == UnidadVelocidad.kmh ? _maxKmh : _maxKmh / 1.60934;

  @override
  void dispose() {
    _posicionSub?.cancel();
    super.dispose();
  }

  Future<bool> _asegurarPermisos() async {
    final servicioActivo = await Geolocator.isLocationServiceEnabled();
    if (!servicioActivo) {
      setState(() => _error = 'Activa el GPS del dispositivo.');
      return false;
    }

    var permiso = await Geolocator.checkPermission();
    if (permiso == LocationPermission.denied) {
      permiso = await Geolocator.requestPermission();
    }

    if (permiso == LocationPermission.denied) {
      setState(() => _error = 'Se necesita permiso de ubicación.');
      return false;
    }

    if (permiso == LocationPermission.deniedForever) {
      setState(
        () => _error =
            'Permiso denegado permanentemente. Actívalo en Ajustes.',
      );
      return false;
    }

    return true;
  }

  Future<void> _iniciar() async {
    setState(() {
      _error = null;
      _midiendo = true;
    });

    final ok = await _asegurarPermisos();
    if (!ok) {
      setState(() => _midiendo = false);
      return;
    }

    const ajustes = LocationSettings(
      accuracy: LocationAccuracy.bestForNavigation,
      distanceFilter: 0,
    );

    await _posicionSub?.cancel();
    _posicionSub = Geolocator.getPositionStream(locationSettings: ajustes)
        .listen(
      (posicion) {
        final velocidad = posicion.speed.isNaN || posicion.speed < 0
            ? 0.0
            : posicion.speed;
        setState(() {
          _velocidadMs = velocidad;
          _precisionM = posicion.accuracy;
          if (velocidad > _maxMs) _maxMs = velocidad;
        });
      },
      onError: (Object e) {
        setState(() {
          _error = 'Error de GPS: $e';
          _midiendo = false;
        });
      },
    );
  }

  Future<void> _detener() async {
    await _posicionSub?.cancel();
    _posicionSub = null;
    setState(() {
      _midiendo = false;
      _velocidadMs = 0;
    });
  }

  void _reiniciarMaxima() {
    setState(() => _maxMs = 0);
  }

  void _alternarUnidad() {
    setState(() {
      _unidad = _unidad == UnidadVelocidad.kmh
          ? UnidadVelocidad.mph
          : UnidadVelocidad.kmh;
    });
  }

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme;

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            children: [
              Row(
                children: [
                  Text(
                    'Velocímetro',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                        ),
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: _alternarUnidad,
                    child: Text(_etiquetaUnidad.toUpperCase()),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Expanded(
                child: Center(
                  child: AspectRatio(
                    aspectRatio: 1,
                    child: CustomPaint(
                      painter: VelocimetroPainter(
                        velocidad: _velocidad,
                        maxEscala: _maxEscala,
                        activo: _midiendo,
                        colorAguja: color.primary,
                        colorArco: color.secondary,
                      ),
                      child: Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const SizedBox(height: 48),
                            Text(
                              _velocidad.toStringAsFixed(0),
                              style: const TextStyle(
                                fontSize: 72,
                                fontWeight: FontWeight.w800,
                                height: 1,
                              ),
                            ),
                            Text(
                              _etiquetaUnidad,
                              style: TextStyle(
                                fontSize: 18,
                                color: Colors.white.withValues(alpha: 0.7),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Row(
                children: [
                  Expanded(
                    child: _InfoCard(
                      titulo: 'Máxima',
                      valor: '${_maxima.toStringAsFixed(0)} $_etiquetaUnidad',
                      onTap: _reiniciarMaxima,
                      ayuda: 'Toca para reiniciar',
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _InfoCard(
                      titulo: 'Precisión GPS',
                      valor: _precisionM == null
                          ? '—'
                          : '±${_precisionM!.toStringAsFixed(0)} m',
                    ),
                  ),
                ],
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.orange.shade300),
                ),
              ],
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton(
                  onPressed: _midiendo ? _detener : _iniciar,
                  style: FilledButton.styleFrom(
                    backgroundColor:
                        _midiendo ? Colors.redAccent : color.primary,
                    foregroundColor: Colors.white,
                  ),
                  child: Text(
                    _midiendo ? 'Detener' : 'Iniciar GPS',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _midiendo
                    ? 'Midiendo con GPS del dispositivo'
                    : 'Presiona Iniciar para medir velocidad',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.55),
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({
    required this.titulo,
    required this.valor,
    this.onTap,
    this.ayuda,
  });

  final String titulo;
  final String valor;
  final VoidCallback? onTap;
  final String? ayuda;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF0F2418),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                titulo,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.white.withValues(alpha: 0.55),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                valor,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (ayuda != null) ...[
                const SizedBox(height: 2),
                Text(
                  ayuda!,
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.white.withValues(alpha: 0.35),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class VelocimetroPainter extends CustomPainter {
  VelocimetroPainter({
    required this.velocidad,
    required this.maxEscala,
    required this.activo,
    required this.colorAguja,
    required this.colorArco,
  });

  final double velocidad;
  final double maxEscala;
  final bool activo;
  final Color colorAguja;
  final Color colorArco;

  static const double _inicio = math.pi * 0.75;
  static const double _barrido = math.pi * 1.5;

  @override
  void paint(Canvas canvas, Size size) {
    final centro = Offset(size.width / 2, size.height / 2);
    final radio = size.shortestSide * 0.42;

    final fondo = Paint()
      ..color = const Color(0xFF1A3D2A)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 18
      ..strokeCap = StrokeCap.round;

    final arco = Paint()
      ..color = colorArco.withValues(alpha: activo ? 0.9 : 0.35)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 18
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(center: centro, radius: radio),
      _inicio,
      _barrido,
      false,
      fondo,
    );

    final fraccion = (velocidad / maxEscala).clamp(0.0, 1.0);
    canvas.drawArc(
      Rect.fromCircle(center: centro, radius: radio),
      _inicio,
      _barrido * fraccion,
      false,
      arco,
    );

    final marcas = Paint()
      ..color = Colors.white.withValues(alpha: 0.45)
      ..strokeWidth = 2;

    for (var i = 0; i <= 9; i++) {
      final t = i / 9;
      final angulo = _inicio + _barrido * t;
      final externo = Offset(
        centro.dx + math.cos(angulo) * (radio - 28),
        centro.dy + math.sin(angulo) * (radio - 28),
      );
      final interno = Offset(
        centro.dx + math.cos(angulo) * (radio - 40),
        centro.dy + math.sin(angulo) * (radio - 40),
      );
      canvas.drawLine(interno, externo, marcas);
    }

    final anguloAguja = _inicio + _barrido * fraccion;
    final punta = Offset(
      centro.dx + math.cos(anguloAguja) * (radio - 48),
      centro.dy + math.sin(anguloAguja) * (radio - 48),
    );

    final aguja = Paint()
      ..color = colorAguja
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round;

    canvas.drawLine(centro, punta, aguja);
    canvas.drawCircle(centro, 8, Paint()..color = colorAguja);
    canvas.drawCircle(centro, 3.5, Paint()..color = const Color(0xFF07140C));
  }

  @override
  bool shouldRepaint(covariant VelocimetroPainter oldDelegate) {
    return oldDelegate.velocidad != velocidad ||
        oldDelegate.maxEscala != maxEscala ||
        oldDelegate.activo != activo;
  }
}

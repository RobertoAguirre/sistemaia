# Velocímetro GPS (Flutter)

App Android que mide la velocidad con el GPS físico del dispositivo.

## Requisitos

- Flutter 3.38+
- Android SDK
- JDK (incluido con Android Studio)

## Variables de entorno recomendadas

```bash
export PATH="$HOME/development/flutter/bin:$PATH"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH:$ANDROID_HOME/platform-tools"
```

## Comandos

```bash
cd appmovil
flutter pub get
flutter build apk --release
```

APK generado en:

`build/app/outputs/flutter-apk/app-release.apk`

## Uso

1. Instala el APK en un teléfono Android.
2. Concede permiso de ubicación.
3. Activa el GPS y pulsa **Iniciar GPS**.

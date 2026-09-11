# 권한 설정 (출시 전 필수)

## Android — android/app/src/main/AndroidManifest.xml
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.INTERNET"/>
```
※ 마이크 외 권한 요청 금지(스토어 심사 감점).

## iOS — ios/Runner/Info.plist
```xml
<key>NSMicrophoneUsageDescription</key>
<string>밈을 따라 외친 목소리를 채점하기 위해 마이크를 사용해요. 녹음은 채점 후 바로 삭제돼요.</string>
```
※ 용도 설명이 모호하면 Apple 리젝. 위 문구처럼 구체적으로.

# Release builds shrink and rename classes with R8. MediaPipe Tasks reads its protobuf messages by
# field name (for example `platform_`), so renaming them breaks the face landmarker at startup.
-keep class com.google.mediapipe.** { *; }
-keep class com.google.protobuf.** { *; }
-dontwarn com.google.mediapipe.**

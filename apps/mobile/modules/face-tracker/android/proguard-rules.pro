# Release builds shrink and rename classes with R8. MediaPipe Tasks reads its protobuf messages by
# field name (for example `platform_`), so renaming them breaks the face landmarker at startup.
-keep class com.google.mediapipe.** { *; }
-keep class com.google.protobuf.** { *; }
# MediaPipe's graph logs through Flogger, which finds its caller by walking the stack for its own
# class names; renamed, it throws "no caller found on the stack" and the landmarker crashes.
-keep class com.google.common.flogger.** { *; }
-dontwarn com.google.mediapipe.**

# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ── Audit A6: minifyEnabled turned on -- these keep rules exist so R8
# doesn't strip/rename classes that Capacitor's JS↔native bridge and
# Firebase/Play-Integrity (App Check) find via reflection at runtime.
# Without these, the app can build fine and still silently break at
# runtime (login/chat/Firestore calls failing with no visible error).

# Capacitor core + all plugins (bridge dispatches to these via reflection)
-keep class com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin { public *; }
-keepclassmembers class * extends com.getcapacitor.Plugin { public *; }

# WebView JS interface methods (Capacitor's bridge object exposed to JS)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface

# Firebase + Google Play Services (used by @capacitor-firebase/app-check /
# Play Integrity attestation)
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Kotlin/reflection metadata some of the above libraries rely on
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes InnerClasses
-keepattributes EnclosingMethod


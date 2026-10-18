# Demo APK and the laptop server

Demo only, not for real patients. The APK is signed with the debug key, so it is for installing on test phones, not for a store.

## Run the server on the laptop

```powershell
cd server
$env:SHIFA_DEV_LOGIN = "1"
.venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
.venv\Scripts\python -m app.seed_cases      # once: three fake demo cases (danger, safe, not sure)
```

`--host 0.0.0.0` lets other devices on the Wi-Fi reach it. Windows Firewall may ask to allow Python on private networks: allow it.

## Connect the phone

1. Phone and laptop on the same Wi-Fi (not a guest network, not mobile data).
2. Find the laptop address: `ipconfig`, the IPv4 address of the Wi-Fi adapter (for example `192.168.18.84`).
3. Check from the phone's browser: `http://<laptop-ip>:8000/health` shows `{"status":"ok"}`.
4. In the app: Profile, Server (demo). The API address is filled in with the address the APK was built with. If the laptop address is different, type the new one. Then tap Sign in as Patient or Sign in as Doctor.

If the laptop address changes (new Wi-Fi, reconnect), only the address in that screen needs changing.

## Build the APK

From `mobile/android` (the `android` folder is generated and not committed; it needs JDK 17 or 21 and the Android SDK):

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:EXPO_PUBLIC_API_URL = "http://<laptop-ip>:8000"      # default address inside the app
$env:EXPO_PUBLIC_ALLOW_LOCAL_HTTP = "1"                   # demo build: allow plain http to private addresses only
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64
```

The APK is `mobile/android/app/build/outputs/apk/release/app-release.apk`.

Two things make plain `http://` to the laptop work in this build, and both are for demos only:

- `EXPO_PUBLIC_ALLOW_LOCAL_HTTP=1` at build time. Without it a release build refuses http. With it, only localhost and private addresses (10.x, 172.16-31.x, 192.168.x) are accepted; any other address must be https.
- `android:usesCleartextTraffic="true"` on the `<application>` element of `android/app/src/main/AndroidManifest.xml`. Android blocks plain http in release builds without it. It is a local edit of a generated file; add it again after `expo prebuild`.

Set `EXPO_PUBLIC_AUTO_UPLOAD=off` at build time to switch off the automatic upload at the end of the safety flow.

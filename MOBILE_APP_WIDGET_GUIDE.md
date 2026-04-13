# Block9 Native App + Android Widget Guide

This repository now includes a Capacitor Android shell and a home-screen widget that displays today's schedule.

## What was added

- Capacitor config for native app wrapping.
- Android project in `android/`.
- Widget API route: `/api/widget/today-schedule`.
- Android app widget: "Today's Schedule".

## 1) Server setup (Vercel)

1. Open Vercel project settings for Block9.
2. Ensure these env vars exist:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Optional hardening:
   - Add `WIDGET_API_KEY` with a strong random value.
4. Redeploy after env updates.

Quick check in browser:
- `https://block9app.vercel.app/api/widget/today-schedule`
- If `WIDGET_API_KEY` is set, use:
  - `https://block9app.vercel.app/api/widget/today-schedule?key=YOUR_KEY`

## 2) Local prerequisites

- Node.js 20+
- Android Studio (latest stable)
- Android SDK installed (API 34+ is fine)

## 3) Configure widget endpoint and key for Android build

Edit `android/gradle.properties` and add:

```properties
BLOCK9_WIDGET_ENDPOINT=https://block9app.vercel.app/api/widget/today-schedule
BLOCK9_WIDGET_API_KEY=
```

If you set `WIDGET_API_KEY` in Vercel, put the same value in `BLOCK9_WIDGET_API_KEY`.

## 4) Sync and open Android project

From the repo root:

```bash
npm run cap:sync:android
npm run android:open
```

Then in Android Studio:

1. Wait for Gradle sync.
2. Run on device/emulator.

## 5) Add the widget on your phone

1. Long-press the home screen.
2. Tap Widgets.
3. Find Block9.
4. Add "Today's Schedule" widget.
5. Tap **Refresh** inside the widget if needed.

## 6) Release build (Play Store)

In Android Studio:

1. Build > Generate Signed Bundle/APK.
2. Choose Android App Bundle (AAB).
3. Upload to Google Play Console.

## Notes

- Current widget displays top items for today's schedule and a "+N more" suffix.
- Widget opens Block9 app when tapped.
- Timezone used by API is `Asia/Manila`.
- iOS home-screen widgets are possible but require a separate iOS WidgetKit target (not included yet).

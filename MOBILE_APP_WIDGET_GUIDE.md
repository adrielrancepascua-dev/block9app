# Block9 Android App and Widget: Super Simple Guide

This is the easiest way to think about it:

- The website is already your app.
- We wrapped it so Android can install it like a real app.
- We also added a widget that shows today’s schedule on the home screen.

## What you need

- A Windows PC
- Your phone
- Android Studio
- Internet connection
- Your Block9 Vercel deployment

## Step 1: Put the needed secret values in Vercel

Go to your Vercel project and make sure these are set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WIDGET_API_KEY` is optional, but recommended

If you change any of these, redeploy the app.

## Step 2: Decide the widget key

If you want the widget to be protected, generate a random key and use the same value in two places:

- Vercel env var: `WIDGET_API_KEY`
- Android file: `android/gradle.properties`

If you do not want protection right now, leave it blank.

## Step 3: Edit the Android config file

Open `android/gradle.properties` and add these lines:

```properties
BLOCK9_WIDGET_ENDPOINT=https://block9app.vercel.app/api/widget/today-schedule
BLOCK9_WIDGET_API_KEY=
```

If you made a widget key, paste the same value after `BLOCK9_WIDGET_API_KEY=`.

## Step 4: Sync the Android project

Open a terminal in the `next-app` folder and run:

```bash
npm run cap:sync:android
```

This updates the Android project with the latest web app files.

## Step 5: Open Android Studio

Run:

```bash
npm run android:open
```

Android Studio will open.

## Step 6: Fix the Java prompt if it appears

If Android Studio says Java is missing:

1. Open Android Studio.
2. Let it install what it wants.
3. If needed, set the JDK inside Android Studio.

You do not need to manually build anything in the terminal if Android Studio is already handling it.

## Step 7: Run the app on your phone

1. Plug your phone into the PC with USB.
2. Turn on Developer Options and USB debugging on the phone.
3. In Android Studio, click Run.
4. Pick your phone.

If you do not want to use a real phone yet, use an emulator in Android Studio.

## Step 8: Add the widget

1. Long-press the home screen.
2. Tap Widgets.
3. Find Block9.
4. Add the widget called “Today's Schedule.”
5. If it says loading, wait a few seconds or tap Refresh.

## What the widget does

- Shows today’s classes/schedule.
- Opens Block9 when tapped.
- Has a refresh button.

## If you want the Play Store later

You can do that after the app works on your phone.

The rough order is:

1. Get the app running on your phone.
2. Make sure the widget works.
3. Create a signed Android App Bundle in Android Studio.
4. Upload it to Google Play.

## Short version

If you only want the next thing to do, it is this:

1. Set the Vercel env vars.
2. Edit `android/gradle.properties`.
3. Run `npm run cap:sync:android`.
4. Run `npm run android:open`.
5. Press Run in Android Studio.

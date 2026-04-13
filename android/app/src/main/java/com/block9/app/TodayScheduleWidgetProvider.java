package com.block9.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.text.TextUtils;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URLEncoder;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class TodayScheduleWidgetProvider extends AppWidgetProvider {
    private static final String ACTION_WIDGET_REFRESH = "com.block9.app.ACTION_WIDGET_REFRESH";
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        updateWidgets(context, appWidgetManager, appWidgetIds, true);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);

        if (intent == null) return;
        if (!ACTION_WIDGET_REFRESH.equals(intent.getAction())) return;

        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] widgetIds = intent.getIntArrayExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS);

        if (widgetIds == null || widgetIds.length == 0) {
            ComponentName thisWidget = new ComponentName(context, TodayScheduleWidgetProvider.class);
            widgetIds = manager.getAppWidgetIds(thisWidget);
        }

        updateWidgets(context, manager, widgetIds, false);
    }

    private void updateWidgets(
            Context context,
            AppWidgetManager appWidgetManager,
            int[] appWidgetIds,
            boolean showLoading
    ) {
        if (appWidgetIds == null || appWidgetIds.length == 0) return;

        for (int widgetId : appWidgetIds) {
            RemoteViews views = buildBaseViews(context, widgetId);
            if (showLoading) {
                views.setTextViewText(R.id.widget_title, context.getString(R.string.widget_today_schedule_title));
                views.setTextViewText(R.id.widget_date, formatTodayLabel());
                views.setTextViewText(R.id.widget_content, context.getString(R.string.widget_loading));
            }
            appWidgetManager.updateAppWidget(widgetId, views);
        }

        final int[] targetIds = appWidgetIds.clone();
        EXECUTOR.execute(() -> {
            WidgetPayload payload = fetchPayload(context);
            for (int widgetId : targetIds) {
                RemoteViews views = buildBaseViews(context, widgetId);
                views.setTextViewText(R.id.widget_title, payload.titleText);
                views.setTextViewText(R.id.widget_date, payload.dateLabel);
                views.setTextViewText(R.id.widget_content, payload.bodyText);
                appWidgetManager.updateAppWidget(widgetId, views);
            }
        });
    }

    private RemoteViews buildBaseViews(Context context, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today_schedule);

        PendingIntent openAppIntent = buildOpenAppIntent(context, widgetId);
        views.setOnClickPendingIntent(R.id.widget_root, openAppIntent);
        views.setOnClickPendingIntent(R.id.widget_refresh_button, buildRefreshIntent(context, widgetId));

        return views;
    }

    private PendingIntent buildOpenAppIntent(Context context, int widgetId) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        return PendingIntent.getActivity(
                context,
                widgetId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private PendingIntent buildRefreshIntent(Context context, int widgetId) {
        Intent intent = new Intent(context, TodayScheduleWidgetProvider.class);
        intent.setAction(ACTION_WIDGET_REFRESH);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, new int[]{widgetId});

        return PendingIntent.getBroadcast(
                context,
                widgetId + 20000,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private WidgetPayload fetchPayload(Context context) {
        String endpoint = BuildConfig.WIDGET_ENDPOINT;

        if (TextUtils.isEmpty(endpoint)) {
            return new WidgetPayload(
                    context.getString(R.string.widget_today_schedule_title),
                    formatTodayLabel(),
                    context.getString(R.string.widget_fetch_failed)
            );
        }

        if (!TextUtils.isEmpty(BuildConfig.WIDGET_API_KEY)) {
            String separator = endpoint.contains("?") ? "&" : "?";
            endpoint = endpoint + separator + "key=" + urlEncode(BuildConfig.WIDGET_API_KEY);
        }

        HttpURLConnection connection = null;
        InputStream stream = null;

        try {
            URL url = new URL(endpoint);
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(8000);
            connection.setRequestMethod("GET");
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("User-Agent", "Block9Widget/1.0");

            int status = connection.getResponseCode();
            stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
            String response = readText(stream);

            if (status < 200 || status >= 300) {
                return new WidgetPayload(
                        context.getString(R.string.widget_today_schedule_title),
                        formatTodayLabel(),
                        context.getString(R.string.widget_fetch_failed)
                );
            }

            JSONObject root = new JSONObject(response);
            JSONArray schedules = root.optJSONArray("schedules");
            String date = root.optString("date");
            int total = schedules == null ? 0 : schedules.length();

            if (total == 0) {
                return new WidgetPayload(
                        context.getString(R.string.widget_today_schedule_title),
                        formatDateLabel(date),
                        context.getString(R.string.widget_no_schedule)
                );
            }

            JSONObject first = schedules.optJSONObject(0);
            if (first == null) {
                return new WidgetPayload(
                        context.getString(R.string.widget_today_schedule_title),
                        formatDateLabel(date),
                        context.getString(R.string.widget_no_schedule)
                );
            }

            String startLabel = first.optString("start_label", "TBA");
            String subject = trimWithEllipsis(first.optString("subject", "Class"), 24);
            String room = trimWithEllipsis(first.optString("room", ""), 20);

            StringBuilder summary = new StringBuilder();
            summary.append("Next ").append(startLabel).append(" • ").append(subject);

            if (!TextUtils.isEmpty(room)) {
                summary.append("\n").append(room);
            }

            int remaining = total - 1;
            if (remaining > 0) {
                summary.append("\n+").append(remaining).append(" more class");
                if (remaining > 1) {
                    summary.append("es");
                }
            } else {
                summary.append("\nOnly class today");
            }

            return new WidgetPayload(
                    buildTitle(total),
                    formatDateLabel(date),
                    summary.toString()
            );
        } catch (Exception ignored) {
            return new WidgetPayload(
                    context.getString(R.string.widget_today_schedule_title),
                    formatTodayLabel(),
                    context.getString(R.string.widget_fetch_failed)
            );
        } finally {
            try {
                if (stream != null) stream.close();
            } catch (Exception ignored) {
            }
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private String readText(InputStream inputStream) throws Exception {
        if (inputStream == null) return "";

        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line);
            }
        }
        return builder.toString();
    }

    private String formatTodayLabel() {
        return new SimpleDateFormat("EEE, MMM d", Locale.US).format(new Date());
    }

    private String formatDateLabel(String rawDate) {
        if (TextUtils.isEmpty(rawDate)) {
            return formatTodayLabel();
        }

        try {
            Date parsed = new SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(rawDate);
            if (parsed == null) return formatTodayLabel();
            return new SimpleDateFormat("EEE, MMM d", Locale.US).format(parsed);
        } catch (Exception ignored) {
            return formatTodayLabel();
        }
    }

    private String urlEncode(String value) {
        try {
            return URLEncoder.encode(value, StandardCharsets.UTF_8.name());
        } catch (Exception ignored) {
            return value;
        }
    }

    private String trimWithEllipsis(String text, int maxLength) {
        if (TextUtils.isEmpty(text) || text.length() <= maxLength) {
            return text;
        }
        return text.substring(0, Math.max(0, maxLength - 3)).trim() + "...";
    }

    private String buildTitle(int totalClasses) {
        if (totalClasses <= 0) {
            return "Today's Schedule";
        }
        return totalClasses == 1
                ? "Today • 1 class"
                : "Today • " + totalClasses + " classes";
    }

    private static class WidgetPayload {
        final String titleText;
        final String dateLabel;
        final String bodyText;

        WidgetPayload(String titleText, String dateLabel, String bodyText) {
            this.titleText = titleText;
            this.dateLabel = dateLabel;
            this.bodyText = bodyText;
        }
    }
}

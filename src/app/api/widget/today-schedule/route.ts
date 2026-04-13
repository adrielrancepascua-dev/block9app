import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface WidgetScheduleRow {
  id: string;
  subject: string;
  room: string | null;
  start_time: string;
  end_time: string;
}

const MANILA_OFFSET_MINUTES = 8 * 60;

const formatClock = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBA";

  return d.toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const getManilaDayRange = () => {
  const now = new Date();

  // Convert "now" to Manila-local clock by shifting from UTC.
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const manilaNow = new Date(utcMs + MANILA_OFFSET_MINUTES * 60_000);

  const year = manilaNow.getUTCFullYear();
  const month = manilaNow.getUTCMonth();
  const day = manilaNow.getUTCDate();

  const dayStartUtcMs = Date.UTC(year, month, day, 0, 0, 0) - MANILA_OFFSET_MINUTES * 60_000;
  const nextDayStartUtcMs = Date.UTC(year, month, day + 1, 0, 0, 0) - MANILA_OFFSET_MINUTES * 60_000;

  const dateLabel = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return {
    dateLabel,
    startIso: new Date(dayStartUtcMs).toISOString(),
    endExclusiveIso: new Date(nextDayStartUtcMs).toISOString(),
  };
};

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const requiredWidgetKey = process.env.WIDGET_API_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        message:
          "Widget endpoint is not configured on the server. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 500 }
    );
  }

  if (requiredWidgetKey) {
    const url = new URL(request.url);
    const incomingKey = url.searchParams.get("key")?.trim();

    if (!incomingKey || incomingKey !== requiredWidgetKey) {
      return NextResponse.json({ message: "Unauthorized widget key." }, { status: 401 });
    }
  }

  try {
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { dateLabel, startIso, endExclusiveIso } = getManilaDayRange();

    const { data, error } = await adminClient
      .from("schedules")
      .select("id, subject, room, start_time, end_time")
      .gte("start_time", startIso)
      .lt("start_time", endExclusiveIso)
      .order("start_time", { ascending: true });

    if (error) throw error;

    const schedules = ((data || []) as WidgetScheduleRow[]).map((item) => ({
      id: item.id,
      subject: item.subject,
      room: item.room,
      start_time: item.start_time,
      end_time: item.end_time,
      start_label: formatClock(item.start_time),
      end_label: formatClock(item.end_time),
    }));

    return NextResponse.json(
      {
        date: dateLabel,
        timezone: "Asia/Manila",
        total: schedules.length,
        schedules,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (err: any) {
    console.error("Widget schedule fetch failed:", err?.message || err);
    return NextResponse.json({ message: "Could not load today's schedule right now." }, { status: 500 });
  }
}
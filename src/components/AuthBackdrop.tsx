import { CLASS_PHOTO } from "@/utils/brand";

export default function AuthBackdrop() {
  return (
    <div className="auth-backdrop" aria-hidden="true">
      {/* Raw img so portrait mode can pan the full photo width. next/image's fill box would crop it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={CLASS_PHOTO}
        alt=""
        width={1920}
        height={1440}
        fetchPriority="high"
        decoding="async"
        className="auth-backdrop__photo"
      />
      <div className="auth-backdrop__scrim" />
    </div>
  );
}

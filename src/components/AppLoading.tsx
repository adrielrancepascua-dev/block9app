export default function AppLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#07111f] text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-sky-300" />
        <p className="text-sm text-white/75">{label}</p>
      </div>
    </div>
  );
}

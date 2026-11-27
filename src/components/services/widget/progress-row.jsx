export default function ProgressRow({ title, percent, details, error = false, errorText }) {
  return (
    <div className="px-2 py-1">
      <div className="flex justify-between gap-2 leading-tight">
        <span className="whitespace-nowrap overflow-hidden text-ellipsis font-medium" title={title}>
          {title ?? ""}
        </span>
        <span className="shrink-0">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 mt-1 rounded-full bg-theme-300/40 dark:bg-theme-900/40 overflow-hidden"
      >
        <div
          className={`h-full rounded-full ${error ? "bg-red-500" : "bg-emerald-500"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-0.5 opacity-70">{details}</div>
      {error && errorText && <div className="text-red-500">{errorText}</div>}
    </div>
  );
}

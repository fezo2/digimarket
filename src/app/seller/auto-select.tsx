"use client";

// A filter drop-down that applies itself as soon as it changes.
export function Select({
  name,
  value,
  options,
  label,
}: {
  name: string;
  value?: string;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <select
      name={name}
      aria-label={label}
      defaultValue={value ?? ""}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="input w-auto max-w-60 min-w-36 font-semibold"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

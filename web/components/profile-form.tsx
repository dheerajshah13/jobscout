import { Check, MapPin, Search, Wallet } from "lucide-react";
import type { Profile } from "@jobscout/core";
import { saveProfile } from "../app/onboarding/actions";

type Props = {
  profile: Profile | null;
  next: string;
  submitLabel: string;
  message?: string;
};

export function ProfileForm({ profile, next, submitLabel, message }: Props) {
  return (
    <form action={saveProfile} className="mt-8 space-y-5 rounded-lg border border-line bg-white p-6 shadow-soft">
      <input type="hidden" name="next" value={next} />

      {message ? (
        <div className="rounded-md border border-coral/40 bg-coral/5 px-4 py-3 text-sm text-coral">{message}</div>
      ) : null}

      <ListField
        icon={<Search size={18} />}
        label="Target titles"
        name="targetTitles"
        placeholder="Frontend Developer, Full Stack Developer"
        defaultValue={profile?.targetTitles.join(", ") ?? ""}
      />
      <ListField
        icon={<Check size={18} />}
        label="Skills"
        name="skills"
        placeholder="TypeScript, React, Postgres, German"
        defaultValue={profile?.skills.join(", ") ?? ""}
      />
      <ListField
        icon={<MapPin size={18} />}
        label="Locations"
        name="locations"
        placeholder="Berlin, Munich"
        defaultValue={profile?.locations.join(", ") ?? ""}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
            <Wallet size={18} />
            Salary floor (EUR/year, optional)
          </span>
          <input
            className="w-full rounded-md border border-line px-4 py-3 text-ink outline-pine"
            name="salaryFloor"
            type="number"
            min={0}
            step={1000}
            placeholder="65000"
            defaultValue={profile?.salaryFloor ?? ""}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-ink">Remote preference</span>
          <select
            className="w-full rounded-md border border-line px-4 py-3 text-ink outline-pine"
            name="remotePref"
            defaultValue={profile?.remotePref ?? "remote_de"}
          >
            <option value="none">On-site only</option>
            <option value="hybrid">Hybrid</option>
            <option value="remote_de">Remote in Germany</option>
            <option value="full">Fully remote (any location)</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-ink">Seniority (optional)</span>
        <select
          className="w-full rounded-md border border-line px-4 py-3 text-ink outline-pine"
          name="seniority"
          defaultValue={profile?.seniority ?? ""}
        >
          <option value="">Not specified</option>
          <option value="junior">Junior</option>
          <option value="mid">Mid</option>
          <option value="senior">Senior</option>
          <option value="lead">Lead / Principal</option>
        </select>
      </label>

      <button
        type="submit"
        className="inline-flex w-full items-center justify-center rounded-md bg-pine px-5 py-3 font-semibold text-white"
      >
        {submitLabel}
      </button>
    </form>
  );
}

function ListField({
  icon,
  label,
  name,
  placeholder,
  defaultValue
}: {
  icon: React.ReactNode;
  label: string;
  name: string;
  placeholder: string;
  defaultValue: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        {icon}
        {label}
      </span>
      <input
        className="w-full rounded-md border border-line px-4 py-3 text-ink outline-pine"
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required
      />
      <span className="mt-1 block text-xs text-ink/50">Comma-separated.</span>
    </label>
  );
}

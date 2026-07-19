"use client";

import { useMemo, useState } from "react";

type RoleSearchInputProps = {
  defaultValue?: string;
  suggestions: readonly string[];
  className?: string;
};

export function RoleSearchInput({ defaultValue = "", suggestions, className }: RoleSearchInputProps) {
  const [value, setValue] = useState(defaultValue);
  const [focused, setFocused] = useState(false);

  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (query.length < 2) return [];

    return suggestions
      .filter((suggestion) => suggestion.toLowerCase().includes(query))
      .slice(0, 8);
  }, [suggestions, value]);

  const showSuggestions = focused && matches.length > 0;

  return (
    <div className="relative flex-1">
      <input
        autoComplete="off"
        className={className}
        type="search"
        name="q"
        placeholder="Search by title, skill, or company"
        value={value}
        onBlur={() => setFocused(false)}
        onChange={(event) => setValue(event.target.value)}
        onFocus={() => setFocused(true)}
      />
      {showSuggestions ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-line bg-white shadow-soft">
          {matches.map((suggestion) => (
            <button
              className="block w-full px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-paper"
              key={suggestion}
              onMouseDown={(event) => {
                event.preventDefault();
                setValue(suggestion);
                setFocused(false);
              }}
              type="button"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

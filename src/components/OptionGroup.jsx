import { useRef } from 'react';

/**
 * A set of mutually exclusive choices, rendered as a radiogroup.
 *
 * The options were loose <button>s: a screen reader announced three unrelated
 * buttons with no indication that one was selected or that they belong
 * together. role="radio" plus aria-checked fixes the announcement, but it also
 * promises arrow-key navigation — so this implements the roving tabindex that
 * makes the promise true. One Tab stop enters the group, arrows move within it.
 *
 * Shared by Activity, Surface and Bike so the three cannot drift apart.
 */
export default function OptionGroup({ label, options, selected, onSelect, columns = 3 }) {
  const containerRef = useRef(null);

  const move = (delta) => {
    const idx = options.findIndex((o) => o.value === selected);
    const from = idx === -1 ? 0 : idx;
    const next = options[(from + delta + options.length) % options.length];
    onSelect(next.value);
    // Selection follows focus in a radiogroup, so focus has to follow with it.
    containerRef.current
      ?.querySelector(`[data-value="${CSS.escape(next.value)}"]`)
      ?.focus();
  };

  const onKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'Home':
        e.preventDefault();
        onSelect(options[0].value);
        break;
      case 'End':
        e.preventDefault();
        onSelect(options[options.length - 1].value);
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`grid gap-1.5 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
    >
      {options.map(({ value, label: optionLabel, description, emoji, icon: Icon }) => {
        const isSelected = selected === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            // Roving tabindex: only the selected option is in the tab order,
            // so Tab moves past the whole group rather than through it.
            tabIndex={isSelected ? 0 : -1}
            data-value={value}
            onClick={() => onSelect(value)}
            // description was in `title` alone, which never reaches a screen
            // reader reliably and is invisible on touch. It is part of the
            // accessible name here instead.
            aria-label={description ? `${optionLabel} — ${description}` : optionLabel}
            title={description}
            className={`flex items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition-all ${
              Icon ? 'py-2' : 'flex-col gap-0.5 py-2 px-1'
            } ${
              isSelected
                ? 'bg-lime-400/10 border-lime-400/40 text-lime-300'
                : 'bg-gray-900/60 border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300'
            }`}
          >
            {Icon ? (
              <Icon size={13} aria-hidden="true" />
            ) : (
              <span className="text-sm leading-none" aria-hidden="true">{emoji}</span>
            )}
            <span className={Icon ? '' : 'mt-0.5'}>{optionLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

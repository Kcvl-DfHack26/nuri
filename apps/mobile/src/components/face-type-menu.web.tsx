import type { FaceTypeMenuProps } from './face-type-menu';

export function FaceTypeMenu({
  label,
  selection,
  options,
  onSelect,
  disabled,
  children,
}: FaceTypeMenuProps) {
  return (
    <div className="relative focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-ink-primary">
      {children}
      <select
        aria-label={label}
        value={selection.id}
        disabled={disabled}
        className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-default"
        onChange={(event) => {
          onSelect(event.currentTarget.value);
        }}
      >
        {options.map(({ id, title }) => (
          <option key={id} value={id}>
            {title}
          </option>
        ))}
      </select>
    </div>
  );
}

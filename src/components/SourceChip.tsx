import { SourceAvatar } from "./SourceAvatar";
import { CloseIcon } from "./icons";
import type { SearchSource } from "../types";

interface SourceChipProps {
  source: SearchSource;
  onRemove?: () => void;
}

export function SourceChip({ source, onRemove }: SourceChipProps) {
  return (
    <span className="chip">
      <SourceAvatar name={source.name} domain={source.domain} size={20} />
      <span className="chip-name">{source.name}</span>
      {onRemove === undefined ? null : (
        <button
          type="button"
          className="icon-btn"
          style={{ width: 20, height: 20 }}
          onClick={onRemove}
          aria-label={`Remove ${source.name} from this search`}
        >
          <CloseIcon size={12} />
        </button>
      )}
    </span>
  );
}

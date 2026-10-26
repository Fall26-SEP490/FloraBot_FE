import { Button, Search, X } from '@florabot/ui';

interface CatalogSearchBarProps {
  draft: string;
  setDraft: (value: string) => void;
  onSubmit: (query: string) => void;
  onClear: () => void;
}

export function CatalogSearchBar({ draft, setDraft, onSubmit, onClear }: CatalogSearchBarProps) {
  return (
    <form
      className="catalog-search-bar-wrap"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft);
      }}
    >
      <div className="catalog-search-input-box">
        <Search size={18} className="catalog-search-icon" aria-hidden="true" />
        <label htmlFor="flower-search" className="sr-only">
          Tìm mẫu hoa, shop hoặc tủ nhận
        </label>
        <input
          id="flower-search"
          className="catalog-search-input"
          type="search"
          maxLength={100}
          placeholder="Tìm hoa, shop hoặc tủ nhận…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        {draft && (
          <button
            type="button"
            className="catalog-search-clear-btn"
            aria-label="Xóa nội dung tìm kiếm"
            onClick={onClear}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <Button type="submit" className="catalog-search-submit-btn">
        Tìm hoa
      </Button>
    </form>
  );
}

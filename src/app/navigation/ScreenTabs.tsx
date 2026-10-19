import { SCREENS } from '../components/icons';
import { useUI } from '../stores/uiStore';

export function ScreenTabs() {
  const ui = useUI();
  return (
    <div className="flex gap-1 px-1.5 py-1 border-b border-[var(--border)] bg-[var(--panel)] overflow-x-auto scroll shrink-0" role="tablist" aria-label="Management screens">
      {SCREENS.map(({ id, label, icon: Icon }) => (
        <button key={id} role="tab" aria-selected={ui.screen === id} className={`btn btn-sm shrink-0 ${ui.screen === id ? 'active' : 'btn-ghost'}`} onClick={() => ui.setScreen(id)} data-testid={`tab-${id}`}>
          <Icon size={14} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

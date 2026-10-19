import { Trophy } from 'lucide-react';
import { ACHIEVEMENTS } from '../../engine/data/achievements';
import { useGame } from '../hooks/useGame';

export function AchievementsScreen() {
  const s = useGame((s) => s);
  const n = ACHIEVEMENTS.filter((a) => s.achievements[a.id] !== undefined).length;
  return (
    <div className="p-3 flex flex-col gap-3" data-testid="achievements-screen">
      <p className="muted">{n} / {ACHIEVEMENTS.length} achievements unlocked. Achievements persist through prestige.</p>
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {ACHIEVEMENTS.map((a) => {
          const got = s.achievements[a.id] !== undefined;
          return (
            <div key={a.id} className={`panel2 p-2 flex gap-2 items-start ${got ? '' : 'opacity-50'}`}>
              <Trophy size={22} className={got ? 'text-amber-400' : 'muted'} aria-hidden />
              <div><div className="font-semibold">{a.name}</div><div className="muted text-[0.86em]">{a.desc}</div>{got && <div className="text-green-400 text-[0.78em]">Unlocked</div>}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

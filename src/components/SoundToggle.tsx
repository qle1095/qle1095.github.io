import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { setSfxEnabled, sfxEnabled } from '../lib/sfx';

export default function SoundToggle() {
  const [on, setOn] = useState(sfxEnabled());
  const Icon = on ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      className="sound-toggle"
      aria-label={on ? 'Mute sound effects' : 'Enable sound effects'}
      aria-pressed={on}
      title={on ? 'Mute sound effects' : 'Enable sound effects'}
      onClick={() => {
        const next = !on;
        setOn(next);
        setSfxEnabled(next);
      }}
    >
      <Icon size={18} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

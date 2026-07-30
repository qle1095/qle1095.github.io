import { useState } from 'react';
import { setSfxEnabled, sfxEnabled } from '../lib/sfx';

export default function SoundToggle() {
  const [on, setOn] = useState(sfxEnabled());
  return (
    <button
      className="sound-toggle"
      aria-label={on ? 'Mute sound effects' : 'Enable sound effects'}
      title={on ? 'Mute sound effects' : 'Enable sound effects'}
      onClick={() => {
        const next = !on;
        setOn(next);
        setSfxEnabled(next);
      }}
    >
      {on ? '🔊' : '🔇'}
    </button>
  );
}

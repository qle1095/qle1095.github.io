import { profile } from '../data/journey';

export default function Hero({ staticMode = false }: { staticMode?: boolean }) {
  return (
    <header className="hero">
      <p className="hero-kicker">{profile.location}</p>
      <h1 className="hero-name">{profile.name}</h1>
      <p className="hero-tagline">{profile.tagline}</p>
      <p className="hero-intro">{profile.intro}</p>
      <p className="hero-scroll-hint">
        {staticMode ? 'Scroll to read the journey ↓' : 'Scroll to begin the journey ↓'}
      </p>
    </header>
  );
}

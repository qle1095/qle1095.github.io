import { profile } from '../data/journey';

export default function Hero({ staticMode = false }: { staticMode?: boolean }) {
  return (
    <header className="hero">
      <p className="hero-kicker">The career journey of</p>
      <h1 className="hero-name">
        Levi Q<em> Le</em>
      </h1>
      <p className="hero-tagline">
        {profile.tagline} <span>· {profile.location}</span>
      </p>
      <p className="hero-intro">{profile.intro}</p>
      <p className="hero-scroll-hint">
        {staticMode ? 'Scroll to read' : 'Scroll to walk'}
      </p>
    </header>
  );
}

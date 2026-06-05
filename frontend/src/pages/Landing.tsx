import { Link } from 'react-router-dom';
import { useAuth } from '../store/auth';

export default function Landing() {
  const user = useAuth((s) => s.user);

  return (
    <div className="landing">
      <header className="landing-nav">
        <Link to="/" className="brand">
          <div className="logo">E</div>
          <div className="name">
            <strong>goofykittycos.com</strong>
            <span>Tools for relentless small teams</span>
          </div>
        </Link>
        <nav style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          {user ? (
            <Link className="cta-btn" to="/workspace/calendar">Open Workspace →</Link>
          ) : (
            <Link className="cta-btn" to="/signin">Sign in</Link>
          )}
        </nav>
      </header>

      <main className="landing-hero">
        <div>
          <span className="hero-pill">Project · ENTJ Workspace</span>
          <h1>Shared Calendar for Startups.<br/>Built for command and clarity.</h1>
          <p className="hero-sub">
            One pane of glass for your team's time. Pixel-precise calendar, instant overlap
            on mutual free hours, structured notes &amp; alarms, and no-code shortcuts to the tools you already use.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <Link className="cta-btn primary-cta" to={user ? '/workspace/calendar' : '/signin'}>
              {user ? 'Continue to workspace →' : 'Get started — it’s free'}
            </Link>
            <a className="cta-btn" href="#features">See the features</a>
          </div>
        </div>
        <div className="hero-card">
          <PreviewMockCalendar />
        </div>
      </main>

      <section id="features" className="landing-features">
        <h2>What you get</h2>
        <div className="features-grid">
          <Feature title="Composite calendar" body="Overlay teammates' schedules. Cyan cells = everyone's free. Click a green slot to instantly send an invite." />
          <Feature title="Pixel-perfect time" body="15-minute granularity. Events render at their exact start and span their real duration — no fake hour blocks." />
          <Feature title="Traveler-aware sleep" body="Set your off-hours once. They auto-follow your local timezone when you move. Collisions are flagged in deep grey." />
          <Feature title="Notes, bookmarks & alarms" body="Private remarks, peer notes, structured {link_name, url} bookmarks, and alarms that link straight to the meeting URL." />
          <Feature title="No-code application icons" body="Pin Slack, Notion, GitHub, or anything else as a one-click sidebar shortcut. No code, no extension required." />
          <Feature title="Built for real teams" body="Email-driven invitations, real-time presence, JWT auth, immutable usernames — the basics done right." />
        </div>
      </section>

      <section id="pricing" className="landing-pricing">
        <h2>Pricing</h2>
        <p className="muted">Free during the v3 beta. <Link to={user ? '/workspace/calendar' : '/signin'}>Hop in →</Link></p>
      </section>

      <footer className="landing-footer">
        <span>© goofykittycos.com — built for ENTJs in startup mode.</span>
      </footer>
    </div>
  );
}

const Feature = ({ title, body }: { title: string; body: string }) => (
  <div className="feature-card">
    <strong>{title}</strong>
    <p>{body}</p>
  </div>
);

// A tiny static mock of the calendar to put in the hero.
const PreviewMockCalendar = () => (
  <svg viewBox="0 0 320 200" width="100%" height="auto" style={{ display: 'block', borderRadius: 8 }}>
    <rect x="0" y="0" width="320" height="200" fill="#FFFFFF" stroke="#E5E7EB"/>
    <rect x="0" y="0" width="320" height="22" fill="#F9FAFB" />
    {[40, 80, 120, 160, 200, 240, 280].map((x, i) => (
      <g key={i}>
        <line x1={x} y1="22" x2={x} y2="200" stroke="#F3F4F6" />
        <text x={x + 20} y="16" textAnchor="middle" fontSize="9" fill="#6B7280">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</text>
      </g>
    ))}
    {[60, 100, 140, 180].map((y, i) => (
      <line key={i} x1="0" x2="320" y1={y} y2={y} stroke="#F3F4F6" />
    ))}
    <rect x="44" y="40" width="34" height="32" rx="3" fill="#FEE2E2" stroke="#FCA5A5"/>
    <text x="61" y="58" textAnchor="middle" fontSize="9" fill="#991B1B">Stand-up</text>
    <rect x="84" y="60" width="34" height="60" rx="3" fill="#FEF3C7" stroke="#FCD34D"/>
    <text x="101" y="86" textAnchor="middle" fontSize="9" fill="#92400E">Design</text>
    <rect x="164" y="50" width="34" height="40" rx="3" fill="#D1FAE5" stroke="#6EE7B7"/>
    <text x="181" y="74" textAnchor="middle" fontSize="9" fill="#065F46">Focus</text>
    <rect x="244" y="100" width="34" height="22" rx="3" fill="#FEE2E2" stroke="#FCA5A5"/>
    <text x="261" y="114" textAnchor="middle" fontSize="9" fill="#991B1B">Sync</text>
  </svg>
);

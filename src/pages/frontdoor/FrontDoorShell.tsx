import { ReactNode, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { PublicBank } from '../../data/frontDoor';
import { applyBankTheme } from '../../theme/bankTheme';

export const PRODUCT_NAME = import.meta.env.VITE_PRODUCT_NAME?.trim() || 'Harbor CRM';

/** A bank's logo, or its first letter on the bank's colour when it has none. */
export function BankMark({ bank, size = 44 }: { bank: Pick<PublicBank, 'name' | 'logoUrl'>; size?: number }) {
  return (
    <span className={`fd-bankmark${bank.logoUrl ? ' has-logo' : ''}`} style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {bank.logoUrl ? <img src={bank.logoUrl} alt="" /> : bank.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

export function ProductMark() {
  return (
    <span className="fd-product">
      <i aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2l8.5 10L12 22 3.5 12z" fill="currentColor" /></svg>
      </i>
      {PRODUCT_NAME}
    </span>
  );
}

const TIDES = [
  { opacity: 0.06, d: 'M0 120 C160 60 300 170 460 110 S720 60 800 100 V400 H0Z' },
  { opacity: 0.08, d: 'M0 200 C140 150 320 240 480 190 S700 150 800 190 V400 H0Z' },
  { opacity: 0.1, d: 'M0 280 C180 230 300 320 500 270 S700 240 800 275 V400 H0Z' },
  { opacity: 0.14, d: 'M0 345 C200 310 320 380 520 340 S720 320 800 345 V400 H0Z' },
];

/** The right-hand side before a bank is known: the product's own picture, gently alive. */
function PlatformStage() {
  return (
    <div className="fd-stage-platform">
      <div className="fd-orb fd-orb-a" />
      <div className="fd-orb fd-orb-b" />
      <svg className="fd-tides" viewBox="0 0 800 400" preserveAspectRatio="none" aria-hidden="true">
        {TIDES.map((tide, i) => (
          <path key={tide.d} opacity={tide.opacity} d={tide.d} style={{ animationDelay: `${i * -3}s` }} />
        ))}
      </svg>
      <div className="fd-glass-stack" aria-hidden="true">
        <motion.div className="fd-glass fd-glass-1" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
          <small>Open pipeline</small>
          <strong>2.07M</strong>
          <span className="fd-spark"><i style={{ height: '38%' }} /><i style={{ height: '55%' }} /><i style={{ height: '46%' }} /><i style={{ height: '72%' }} /><i style={{ height: '64%' }} /><i style={{ height: '90%' }} /></span>
        </motion.div>
        <motion.div className="fd-glass fd-glass-2" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
          <small>New leads this week</small>
          <strong>48</strong>
          <em>12 qualified</em>
        </motion.div>
        <motion.div className="fd-glass fd-glass-3" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
          <span className="fd-dot" /> Customer onboarding approved
        </motion.div>
      </div>
      <div className="fd-pitch">
        <h2>One platform. Every bank its own.</h2>
        <p>Leads, customers, deals and service for your branch teams, in your bank's own colours.</p>
      </div>
    </div>
  );
}

/**
 * The right-hand side once the bank is known. This is the moment the page becomes the
 * bank's: its colour sweeps across, its picture slides in and its name settles.
 */
function BankStage({ bank }: { bank: PublicBank }) {
  return (
    <motion.div
      className="fd-stage-bank"
      initial={{ clipPath: 'circle(0% at 0% 62%)' }}
      animate={{ clipPath: 'circle(150% at 0% 62%)' }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{ duration: 0.75, ease: [0.65, 0, 0.35, 1] }}
    >
      {bank.loginImageUrl ? (
        <motion.img
          className="fd-bank-image"
          src={bank.loginImageUrl}
          alt=""
          initial={{ x: 80, scale: 1.08, opacity: 0 }}
          animate={{ x: 0, scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      ) : (
        <motion.span className="fd-bank-letter" aria-hidden="true" initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
          {bank.name.trim().charAt(0).toUpperCase()}
        </motion.span>
      )}
      <div className="fd-bank-shade" />
      <motion.div className="fd-bank-caption" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.55, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <BankMark bank={bank} size={52} />
        <div>
          <strong>{bank.name}</strong>
          <span>on {PRODUCT_NAME}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * The frame of every page a person sees before they are signed in: the form on the
 * left, the picture on the right. Give it a bank and the whole page takes that bank's
 * colour, logo and image.
 */
export function FrontDoorShell({ bank, children, testId, footer }: { bank: PublicBank | null; children: ReactNode; testId?: string; footer?: ReactNode }) {
  // One colour re-themes the page; leaving the bank returns it to the Harbor default.
  useEffect(() => {
    applyBankTheme(bank?.color ?? null, false);
  }, [bank?.id, bank?.color]);

  return (
    <MotionConfig reducedMotion="user">
      <div className={`fd-shell${bank ? ' is-bank' : ''}`}>
        <main className="fd-side" data-testid={testId}>
          <header className="fd-top">
            <AnimatePresence mode="wait" initial={false}>
              {bank ? (
                <motion.div
                  key={bank.id}
                  className="fd-top-bank"
                  aria-label={bank.name}
                  initial={{ opacity: 0, scale: 0.6, y: 14 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.25 }}
                >
                  <BankMark bank={bank} />
                  <span>
                    <strong>{bank.name}</strong>
                    <small>on {PRODUCT_NAME}</small>
                  </span>
                </motion.div>
              ) : (
                <motion.div key="product" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Link to="/login" className="fd-home" aria-label={PRODUCT_NAME}>
                    <ProductMark />
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </header>
          <div className="fd-panel">{children}</div>
          <footer className="fd-foot">{footer}</footer>
        </main>
        <aside className="fd-stage" aria-hidden="true">
          <PlatformStage />
          <AnimatePresence>{bank && <BankStage key={bank.id} bank={bank} />}</AnimatePresence>
        </aside>
      </div>
    </MotionConfig>
  );
}

/** One step of a front-door form: slides in from the side the person is moving toward. */
export function Step({ id, back, children }: { id: string; back?: boolean; children: ReactNode }) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, x: back ? -28 : 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: back ? 28 : -28, transition: { duration: 0.14 } }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

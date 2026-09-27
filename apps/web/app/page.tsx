import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { BarChart3, BrainCircuit, Check, Code2, Palette } from "lucide-react"
import { LandingHeader } from "@/components/landing/LandingHeader"
import { LandingReveal } from "@/components/landing/LandingReveal"
import "./landing.css"
import "./landing-sections.css"

export const metadata: Metadata = {
  title: "پرودچی | مهارت محصول را با تصمیم‌های واقعی بساز",
  description: "با سناریوهای واقعی در مدیریت محصول، طراحی محصول و تک لید، تصمیم بگیر، بازخورد بگیر و مسیر رشد مهارتت را ببین.",
}

const roles = [
  { name: "مدیریت محصول", detail: "مسئله را بشناس، اولویت را انتخاب کن و اثر تصمیم را بسنج.", number: "۰۱", icon: BarChart3 },
  { name: "طراحی محصول", detail: "کاربر را بفهم، راه‌حل بساز و ایده‌هایت را بیازما.", number: "۰۲", icon: Palette },
  { name: "تک لید", detail: "میان معماری، کیفیت و نیازهای تیم تصمیم بگیر.", number: "۰۳", icon: Code2 },
]

export default function LandingPage() {
  return (
    <div className="landing" dir="rtl">
      <LandingHeader />
      <LandingReveal />

      <main>
        <section className="landing-hero landing-container" aria-labelledby="hero-title">
          <div className="landing-hero-intro">
            <div className="landing-hero-copy">
              <p className="landing-hero-kicker">تمرین تصمیم‌گیری برای دنیای محصول</p>
              <h1 id="hero-title">تصمیم بگیر،<br /><span>مهارت محصول</span> بساز.</h1>
            </div>
            <div className="landing-hero-aside">
              <p>وارد یک سناریوی واقعی شو. مسیر را با انتخاب‌هایت پیش ببر، بازخورد بگیر و ببین مهارتت چطور رشد می‌کند.</p>
              <div className="landing-hero-actions">
                <Link href="/app/signup" className="landing-hero-cta">شروع مسیر من <span aria-hidden="true">←</span></Link>
                <a href="#how" className="landing-hero-more">روش کار را ببین <span aria-hidden="true">↖</span></a>
              </div>
            </div>
          </div>
          <div className="landing-hero-scene">
            <aside className="landing-hero-tracks" aria-label="مسیرهای تخصصی">
              <div className="landing-hero-tracks-inner">
                <div className="landing-hero-track-count"><strong>۳</strong><span>مسیر تخصصی<br />برای تمرین</span></div>
                <p>از نقش خودت شروع کن.</p>
                <ul>
                  <li>مدیریت محصول</li>
                  <li>طراحی محصول</li>
                  <li>تک لید</li>
                </ul>
                <a href="#paths" className="landing-hero-track-link">آشنایی با مسیرها <span aria-hidden="true">↖</span></a>
              </div>
            </aside>
            <div className="landing-hero-visual-frame">
              <div className="landing-hero-visual">
                <Image src="/landing-path.png" alt="تصویری از یک مسیر سبز چندشاخه که با هر تصمیم به مرحلهٔ بعد می‌رسد" width={1536} height={1024} priority sizes="(max-width: 640px) 100vw, (max-width: 900px) 68vw, 67vw" />
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="landing-how" aria-labelledby="how-title">
          <div className="landing-container">
            <div className="landing-how-heading landing-reveal">
              <div>
                <p className="landing-eyebrow">یادگیری در عمل</p>
                <h2 id="how-title">هیچ تصمیمی<br /><span>در خلأ گرفته نمی‌شود.</span></h2>
              </div>
              <p>هر چالش، تو را وسط یک موقعیت واقعی می‌گذارد. انتخاب می‌کنی، نتیجه را می‌بینی و با بازخورد جلو می‌روی.</p>
            </div>
            <div className="landing-process-grid">
              <article className="landing-process-frame landing-process-primary landing-reveal">
                <div className="landing-process-inner">
                  <div className="landing-process-top"><span>۰۱ / موقعیت</span><span className="landing-process-spark" aria-hidden="true">✳</span></div>
                  <div className="landing-process-main">
                    <h3>در دلِ مسئله قرار بگیر.</h3>
                    <p>با همان محدودیت‌ها و ابهام‌هایی روبه‌رو شو که تصمیم‌های کاری را سخت می‌کنند.</p>
                  </div>
                  <div className="landing-scenario-card" aria-label="نمونه‌ای از یک موقعیت تمرینی">
                    <span>نمونهٔ یک موقعیت</span>
                    <strong>زمان تیم محدود است. کدام مسئله را اول حل می‌کنی؟</strong>
                    <span className="landing-scenario-dots" aria-hidden="true"><i /><i /><i /></span>
                  </div>
                </div>
              </article>
              <article className="landing-process-frame landing-process-choice landing-reveal">
                <div className="landing-process-inner">
                  <div className="landing-process-top"><span>۰۲ / انتخاب</span><span className="landing-process-small-mark" aria-hidden="true">↙</span></div>
                  <div className="landing-process-content"><h3>راهت را خودت انتخاب کن.</h3><p>هر انتخاب، ادامهٔ سناریو را شکل می‌دهد.</p></div>
                  <div className="landing-choice-visual" aria-hidden="true"><span /><span /><span /></div>
                </div>
              </article>
              <article className="landing-process-frame landing-process-feedback landing-reveal">
                <div className="landing-process-inner">
                  <div className="landing-process-top"><span>۰۳ / بازخورد</span><span className="landing-process-small-mark" aria-hidden="true">✺</span></div>
                  <div className="landing-process-content"><h3>چرایی‌اش را بفهم و رشد کن.</h3><p>بازخورد بگیر، امتیاز تجربه جمع کن و قدم بعدی‌ات را روشن‌تر ببین.</p></div>
                  <div className="landing-feedback-visual" aria-hidden="true"><span><Check size={18} strokeWidth={1.5} /></span><span>بازخورد تصمیم</span><strong>+ امتیاز</strong></div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="paths" className="landing-paths landing-container" aria-labelledby="paths-title">
          <div className="landing-paths-heading landing-reveal">
            <div><p className="landing-eyebrow">مسیر خودت را انتخاب کن</p><h2 id="paths-title">برای هر نقش،<br />یک مسیر واقعی.</h2></div>
            <p>چالش‌ها با تصمیم‌هایی طراحی شده‌اند که در همان نقش با آن‌ها روبه‌رو می‌شوی.</p>
          </div>
          <div className="landing-role-grid">
            {roles.map(({ name, detail, number, icon: Icon }) => (
              <Link href="/app/signup" className="landing-role-frame landing-reveal" key={name} aria-label={`شروع مسیر ${name}`}>
                <div className="landing-role-inner">
                  <div className="landing-role-top"><span>مسیر {number}</span><span className="landing-role-icon"><Icon size={27} strokeWidth={1.4} aria-hidden /></span></div>
                  <div className="landing-role-motif" aria-hidden="true"><i /><i /><i /></div>
                  <div className="landing-role-bottom"><h3>{name}</h3><p>{detail}</p><span className="landing-role-action">شروع این مسیر <span aria-hidden="true">←</span></span></div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="landing-growth" aria-labelledby="growth-title">
          <div className="landing-container landing-growth-frame landing-reveal">
            <div className="landing-growth-inner">
              <div className="landing-growth-copy">
                <p className="landing-eyebrow">رشد، قابل دیدن می‌شود</p>
                <h2 id="growth-title">پیشرفتت<br /><span>فقط یک عدد نیست.</span></h2>
                <p>با هر چالش، تصویر روشن‌تری از توانمندی‌هایت می‌سازی؛ می‌فهمی کجا قوی هستی و قدم بعدی‌ات چیست.</p>
                <div className="landing-growth-features"><span><i /> چالش‌های روزانه</span><span><i /> بازخورد تصمیم‌ها</span><span><i /> نقشهٔ مهارت</span></div>
              </div>
              <div className="landing-growth-art" aria-hidden="true">
                <div className="landing-growth-art-top"><span>مسیر رشد تو</span><span className="landing-growth-art-dot" /></div>
                <div className="landing-growth-orbit"><div className="landing-growth-core"><BrainCircuit size={54} strokeWidth={1.1} /><span>هر تصمیم،<br />یک قدم</span></div><span className="landing-orbit-label landing-orbit-label-one">تمرین</span><span className="landing-orbit-label landing-orbit-label-two">بازخورد</span><span className="landing-orbit-label landing-orbit-label-three">رشد</span></div>
                <div className="landing-growth-art-bottom"><span>ببین از کجا شروع کردی</span><span aria-hidden="true">↗</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-final landing-container" aria-labelledby="final-title">
          <div className="landing-final-frame landing-reveal">
            <div className="landing-final-inner">
              <div className="landing-final-copy"><p className="landing-eyebrow">از همین‌جا شروع می‌شود</p><h2 id="final-title">اولین تصمیم،<br /><span>شروع‌کردن است.</span></h2><p>نقشت را انتخاب کن و اولین سناریویت را حل کن.</p><Link href="/app/signup" className="landing-final-cta">شروع رایگان <span aria-hidden="true">←</span></Link></div>
              <div className="landing-final-mark" aria-hidden="true"><span>۰۱</span><i /><i /></div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer"><div className="landing-container landing-footer-inner"><div><strong>پرودچی</strong><span>تمرین کن. تصمیم بگیر. رشد کن.</span></div><Link href="/app/login">ورود به اپ <span aria-hidden="true">↖</span></Link></div></footer>
    </div>
  )
}

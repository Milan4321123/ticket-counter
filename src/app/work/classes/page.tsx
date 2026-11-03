import Link from 'next/link';
import DemoNav from '@/components/studio/DemoNav';
import { Mukta } from 'next/font/google';
import ClassBooking from './ClassBooking';
import '@/app/studio/studio.css';
import './classes.css';

// Studio demo #5: a class booking app (lib/projects.ts → "Class booking app")
// for a made-up Nepali culture school in Frankfurt — Nepali for kids and
// adults, dance, madal and harmonium. Students and parents browse, book a trial
// or a term, wait for a full class and carry a QR pass; the teacher view takes
// the register and posts notes. Rules in booking.ts, words in content.ts; it
// all runs in the visitor's browser and nothing is sent.
//
// Same thin MartNepali frame as the other demos: the "Demo project" strip above
// and "want one like this?" below are ordinary site copy; the app in between is
// translate="no" and switches English / नेपाली / Deutsch itself.
//
// No prices, fees, quotes or packages anywhere — not even for the made-up
// classes: the operator is a student and the studio is free while it grows.

const mukta = Mukta({ weight: ['400', '500', '600', '700', '800'], subsets: ['devanagari', 'latin'], display: 'swap', variable: '--cb-mukta' });

const title = 'Class booking app — demo project';
const description =
  'A class booking app for a Nepali culture school, built by MartNepali as a demo: classes and a weekly timetable, trial and term bookings with a QR pass, a waitlist that moves by itself, reminders, and a teacher view for the register and class notes — in English, नेपाली and Deutsch.';
const cover = {
  url: '/media/studio/projects/classes.jpg',
  width: 1200,
  height: 800,
  alt: 'A class booking app for a made-up Nepali school in Frankfurt: a colourful weekly timetable and a booking card with a QR pass',
};

export const metadata = {
  title,
  description,
  alternates: { canonical: '/work/classes' },
  openGraph: { type: 'website', title, description, url: '/work/classes', images: [cover] },
  twitter: { card: 'summary_large_image', title, description, images: [cover.url] },
};

export default function ClassesDemoPage() {
  return (
    <div className={`cb-page ${mukta.variable}`}>
      <div className="cb-frame-top">
        <div className="cb-frame-inner">
          <span className="cb-frame-badge">Demo project</span>
          <span className="cb-frame-text">Built by MartNepali · a made-up school, nothing is sent</span>
          <Link href="/work" className="cb-frame-link">
            ← All demos
          </Link>
        </div>
      </div>

      <ClassBooking />

      <section className="cb-frame-end" aria-labelledby="cb-end-h">
        <div className="cb-frame-end-inner">
          <p className="cb-frame-kicker">MartNepali Studio · Demo project</p>
          <h2 id="cb-end-h">Want a booking app for your classes?</h2>
          <p>
            For a Nepali Pathshala, a dance group, a music school or a weekend language class: your timetable, your
            teachers and your rooms — with bookings, a waitlist, reminders and a register on the teacher’s phone.
          </p>
          <ul>
            <li>Made for the phone first</li>
            <li>A teacher view for the register</li>
            <li>English, नेपाली and Deutsch</li>
          </ul>
          <div className="cb-frame-ctas">
            <Link href="/contact?intent=app" className="btn btn-brand">
              Kura garau
            </Link>
            <Link href="/studio#projects" className="btn">
              See all our work
            </Link>
          </div>
          <p className="cb-frame-free">Free while we grow.</p>
          <DemoNav current="classes" />
        </div>
      </section>
    </div>
  );
}

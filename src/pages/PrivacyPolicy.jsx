import React from 'react';
import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">Implemnt</span>
          </Link>
        </div>
      </nav>

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-slate-500 mb-10">Last updated: May 8, 2026</p>

          <div className="prose prose-slate max-w-none space-y-8 text-slate-700 text-sm leading-relaxed">

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Introduction</h2>
              <p>Implemnt ("we", "our", or "us") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard data when you use our platform at implemnt.ai.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">2. Information We Collect</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Account information:</strong> name and email address when you sign up.</li>
                <li><strong>Calendar data:</strong> meeting events accessed via Google Calendar OAuth to schedule recording bots.</li>
                <li><strong>Meeting recordings and transcripts:</strong> audio and text from meetings where a bot is present, used to generate insights.</li>
                <li><strong>Usage data:</strong> interactions with the platform for product improvement.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">3. How We Use Your Information</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>To provide core platform features: meeting transcription, call summaries, and rule-based action item extraction.</li>
                <li>To sync data with third-party tools you connect (e.g., Monday.com).</li>
                <li>To send you product updates and notifications (you may opt out at any time).</li>
                <li>To improve the reliability of configured keyword rules and workflow features.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">4. Data Sharing</h2>
              <p>We do not sell your personal data. We share data only with:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Service providers who help us operate the platform (e.g., Recall AI for meeting bots).</li>
                <li>Third-party integrations you explicitly authorize (e.g., Monday.com, HubSpot).</li>
                <li>Legal authorities if required by law.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Google OAuth Scopes</h2>
              <p>When you connect Google Calendar, we request access to read your calendar events solely to identify meeting links and schedule recording bots. We do not modify, delete, or share your calendar data.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">6. Data Retention</h2>
              <p>We retain your data for as long as your account is active. You may request deletion of your account and associated data at any time by contacting us at privacy@implemnt.ai.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">7. Security</h2>
              <p>We use industry-standard encryption and access controls to protect your data. However, no method of transmission over the internet is 100% secure.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">8. Your Rights</h2>
              <p>Depending on your location, you may have rights to access, correct, or delete your personal data. Contact us at privacy@implemnt.ai to exercise these rights.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">9. Contact Us</h2>
              <p>If you have questions about this Privacy Policy, please contact us at <a href="mailto:privacy@implemnt.ai" className="text-indigo-600 hover:underline">privacy@implemnt.ai</a>.</p>
            </section>
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-100 py-6 px-6 text-center">
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} Implemnt. All rights reserved. · <Link to="/" className="hover:underline">Home</Link></p>
      </footer>
    </div>
  );
}

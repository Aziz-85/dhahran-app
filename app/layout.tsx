import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getMessages } from '@/lib/get-messages';
import { getDir } from '@/lib/i18n';
import { getAppVersion } from '@/lib/get-app-version';
import type { Locale } from '@/lib/i18n';
import './globals.css';
import { I18nProvider } from './providers';

export const metadata: Metadata = {
  title: 'Dhahran Team',
  description: 'Scheduling and task management',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const locale: Locale = cookieStore.get('dt_locale')?.value === 'ar' ? 'ar' : 'en';
  const messages = await getMessages(locale);
  const dir = getDir(locale);
  const version = getAppVersion();

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased flex flex-col">
        <I18nProvider initialLocale={locale} initialMessages={messages}>
          <div className="flex-1 min-h-0">{children}</div>
          <footer className="mt-auto py-2 text-center text-xs text-slate-400" dir="ltr">
            Version {version}
          </footer>
        </I18nProvider>
      </body>
    </html>
  );
}

import './globals.css';
import ClientProviders from '../components/ClientProviders';

export const metadata = {
  title: 'Cosmo Store Billing',
  description: 'Billing software built with Next.js',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#ffffff',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}

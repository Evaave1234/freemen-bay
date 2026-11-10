import "./globals.css";

export const metadata = {
  title: "Freemans Bay Beginner Badminton",
  description: "Sign up for beginner badminton at Freemans Bay School · 初学者羽毛球报名",
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏸</text></svg>" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import "./globals.css";
import AdminNav from "@/components/AdminNav";

export const metadata = { title: "AutoServe — Admin" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AdminNav />
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}

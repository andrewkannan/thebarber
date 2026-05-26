import './globals.css'

export const metadata = {
  title: 'The Barber',
  description: 'Sleek & Fast Barber Booking System',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
